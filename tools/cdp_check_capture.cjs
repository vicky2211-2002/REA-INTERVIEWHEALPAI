#!/usr/bin/env node
/**
 * Verify the screenshot capture pipeline end-to-end via CDP.
 * Runs the same main-process captureScreen() used by the Ctrl+H shortcut.
 *   node tools/cdp_check_capture.cjs 9228
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

  const before = await evaluate('window.electronAPI.getScreenshots()');
  console.log('screenshots before:', before.length);

  await evaluate('window.electronAPI.captureScreen()');
  const after = await evaluate('window.electronAPI.getScreenshots()');
  console.log('screenshots after capture:', after.length);
  const dataUrlPrefix = (after[after.length - 1] || '').slice(0, 22);
  console.log('captured dataUrl prefix:', dataUrlPrefix);

  // Clean up the test screenshot so it is not attached to the user's next answer
  await evaluate('window.electronAPI.deleteLastScreenshot()');
  const cleaned = await evaluate('window.electronAPI.getScreenshots()');
  console.log('screenshots after cleanup:', cleaned.length);

  process.exit(after.length === before.length + 1 && cleaned.length === before.length ? 0 : 1);
})().catch((err) => {
  console.error('capture check failed:', err.message);
  process.exit(1);
});
