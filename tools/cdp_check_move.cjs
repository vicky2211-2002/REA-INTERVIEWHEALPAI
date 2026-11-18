#!/usr/bin/env node
/**
 * Verify the ±25% horizontal movement clamp (v1.2.6) via CDP.
 * Leaves windowOffsetX exactly where it started.
 */
const PORT = process.argv[2] || '9228';

(async () => {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  if (!page) {
    console.error('No page target.');
    process.exit(1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => (ws.onopen = resolve));

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
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || 'evaluation failed');
    }
    return result.result.value;
  };

  const start = (await evaluate('window.electronAPI.getSettings()')).windowOffsetX;
  console.log('windowOffsetX at start:', start);

  // Push right well beyond any possible limit (25 nudges x 40 px = +1000 px)
  await evaluate('(async () => { for (let i = 0; i < 25; i++) { window.electronAPI.moveX(40); await new Promise(r => setTimeout(r, 20)); } })()');
  await new Promise((r) => setTimeout(r, 300));
  const rightMax = (await evaluate('window.electronAPI.getSettings()')).windowOffsetX;
  console.log('after +1000px nudges:', rightMax);

  // Push left the same distance to measure the negative side
  await evaluate('(async () => { for (let i = 0; i < 50; i++) { window.electronAPI.moveX(-40); await new Promise(r => setTimeout(r, 20)); } })()');
  await new Promise((r) => setTimeout(r, 300));
  const leftMax = (await evaluate('window.electronAPI.getSettings()')).windowOffsetX;
  console.log('after -2000px nudges:', leftMax);

  // Restore original offset exactly
  const restoreDelta = start - leftMax;
  await evaluate(`window.electronAPI.moveX(${restoreDelta})`);
  await new Promise((r) => setTimeout(r, 200));
  const restored = (await evaluate('window.electronAPI.getSettings()')).windowOffsetX;
  console.log('restored to:', restored);

  const symmetric = rightMax === -leftMax;
  console.log('symmetric limits:', symmetric ? 'YES' : 'NO');
  console.log('25%-screen sized limits (~384 @1536 DIP):', `+${rightMax} / ${leftMax}`);
  process.exit(restored === start && symmetric ? 0 : 1);
})().catch((error) => {
  console.error('move clamp check failed:', error.message);
  process.exit(1);
});
