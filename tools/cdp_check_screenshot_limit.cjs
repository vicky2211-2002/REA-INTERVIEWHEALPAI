#!/usr/bin/env node
/**
 * Verify the 10-screenshot cap (v1.2.9) via CDP.
 * Asserts: 10 captures all stick, capture 11/12 keep the array at 10,
 * and the tray is restored to empty afterwards.
 * Refuses to run if screenshots already exist (would drop the user's
 * oldest shots) — restart the app or reset context (Ctrl+R) first.
 * Every request has a timeout so the script can never hang silently.
 *   node tools/cdp_check_screenshot_limit.cjs 9228 [logfile]
 */
const fs = require('fs');
const PORT = process.argv[2] || '9228';
const LOG = process.argv[3] || null;
const log = (s) => {
  console.log(s);
  if (LOG) fs.appendFileSync(LOG, s + '\n', 'utf8');
};

(async () => {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  if (!page) {
    console.error('No page target.');
    process.exit(1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('ws error'));
  });

  let nextId = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`timeout on ${method}`));
        }
      }, 15000);
      pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || 'evaluation failed');
    }
    return result.result.value;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // NEVER pull the raw array over CDP (it is several MB of base64 strings);
  // only the length crosses the wire.
  const count = async () => evaluate('window.electronAPI.getScreenshots().then(a => a.length)');
  const blindCleanup = async () => {
    log('cleanup: deleting test shots...');
    for (let i = 0; i < 12; i++) {
      try { await evaluate('window.electronAPI.deleteLastScreenshot()'); } catch { /* best effort */ }
      await sleep(80);
    }
  };

  const before = await count();
  log(`screenshots before: ${before}`);
  if (before !== 0) {
    log(`Aborting: ${before} screenshot(s) already in context. Restart the app or Ctrl+R first.`);
    process.exit(2);
  }

  let failed = false;
  const expectCount = async (label, want) => {
    const got = await count();
    const ok = got === want;
    log(`${label}: ${got} (expected ${want}) ${ok ? 'OK' : 'FAIL'}`);
    if (!ok) failed = true;
  };

  try {
    for (let i = 1; i <= 10; i++) {
      await evaluate('window.electronAPI.captureScreen()');
      await sleep(1500); // human pacing: Electron/DWM screen capture is not built for sub-second rapid-fire
      await expectCount(`after capture ${i}`, i);
      if (failed) break;
    }

    try {
      const innerText = await evaluate("document.body ? document.body.innerText : ''");
      log(innerText.includes('/10') ? 'toast shows /10: YES' : 'toast shows /10: not visible in DOM (non-fatal)');
    } catch {
      log('toast DOM probe skipped (non-fatal)');
    }

    if (!failed) {
      for (const n of [11, 12]) {
        await evaluate('window.electronAPI.captureScreen()');
        await sleep(1500);
        await expectCount(`after capture ${n} (cap)`, 10);
      }
    }
  } catch (err) {
    log(`FATAL: ${err.message}`);
    failed = true;
  } finally {
    await blindCleanup();
    try {
      const end = await count();
      log(`restored to: ${end}`);
      if (end !== 0) failed = true;
    } catch {
      log('final count read failed (cleanup best-effort done)');
      failed = true;
    }
  }

  log(failed ? 'LIMIT CHECK FAILED' : 'ALL CHECKS PASS');
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('limit check failed:', err.message);
  process.exit(1);
});
