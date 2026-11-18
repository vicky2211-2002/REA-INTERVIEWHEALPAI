#!/usr/bin/env node
/**
 * Screenshot + DOM smoke test for a running InterviewCopilot instance.
 *
 *   node tools/cdp_smoke.cjs 9223 [outDir]
 *
 * The app must be started with --remote-debugging-port=<port>.
 * Prints visible text and a node count; saves <outDir>/01_home.png.
 */
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || '9223';
const OUT = process.argv[3] || path.join(__dirname, 'screen');

let ws;
let nextId = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || 'evaluation failed');
  }
  return result.result.value;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  if (!page) {
    console.error('No page target. Is the app running with --remote-debugging-port?');
    process.exit(1);
  }

  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => (ws.onopen = resolve));
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise((r) => setTimeout(r, 1200));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(OUT, '01_home.png');
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));

  const info = await evaluate(`JSON.stringify({
    text: document.body.innerText.replace(/\\n{2,}/g, '\\n').slice(0, 1200),
    nodes: document.querySelectorAll('#root *').length,
    size: innerWidth + 'x' + innerHeight,
    dpr: devicePixelRatio,
  })`);

  const parsed = JSON.parse(info);
  console.log('screenshot:', file);
  console.log('viewport:', parsed.size, 'dpr', parsed.dpr, '| nodes:', parsed.nodes);
  console.log('text:', parsed.text.replace(/\n/g, ' | '));

  if (parsed.nodes === 0) {
    console.error('Renderer rendered nothing — check the build and the console.');
    process.exit(2);
  }

  ws.close();
}

main().catch((error) => {
  console.error('smoke test failed:', error.message);
  process.exit(1);
});
