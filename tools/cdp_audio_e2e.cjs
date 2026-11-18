#!/usr/bin/env node
/**
 * Audio → transcript end-to-end test.
 *
 *   node tools/cdp_audio_e2e.cjs [port] [playbackMs]
 *
 * Starts listening (if needed), subscribes to transcript pushes, then waits.
 * Play real speech through the speakers while it waits, e.g.:
 *
 *   powershell -ExecutionPolicy Bypass -File tools/make_speech.ps1
 *   $p = Start-Process node -ArgumentList "tools/cdp_audio_e2e.cjs","9223","20000" -NoNewWindow -PassThru
 *   (New-Object Media.SoundPlayer "$env:TEMP\opencode\speech16k.wav").PlaySync()
 *   $p.WaitForExit()
 */
const PORT = process.argv[2] || '9223';
const PLAYBACK_MS = Number(process.argv[3] || 20000);

let ws;
let nextId = 0;
const pending = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    return 'ERR ' + (result.exceptionDetails.exception?.description || '');
  }
  return result.result.value;
}

async function main() {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target on port ' + PORT);

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

  console.log('subscribe:', await evaluate(`(() => {
    window.__transcripts = [];
    window.__whisper = [];
    window.electronAPI.onTranscript((segments) => {
      window.__transcripts = segments.map((s) => s.speaker + ': ' + s.text);
    });
    window.electronAPI.onWhisperStatus((status) => window.__whisper.push(status));
    return 'ok';
  })()`));

  const state = await evaluate(`(() => {
    if (document.querySelector('button[title="Stop listening"]')) return 'listening';
    if (document.querySelector('button[title="Start listening"]')) return 'idle';
    return 'none';
  })()`);
  console.log('state:', state);

  if (state === 'idle') {
    console.log('click:', await evaluate(
      `(() => { const b = document.querySelector('button[title="Start listening"]'); b.click(); return 'clicked'; })()`,
    ));
    await sleep(1500);
  }

  console.log(`waiting ${PLAYBACK_MS} ms — play speech now…`);
  await sleep(PLAYBACK_MS);

  console.log('whisper status:', await evaluate('JSON.stringify(window.__whisper)'));
  const transcripts = await evaluate('JSON.stringify(window.__transcripts)');
  console.log('transcripts:', transcripts);

  const list = JSON.parse(transcripts || '[]');
  if (list.length === 0) {
    console.error('No transcript produced — check audio playback, loopback source, and the Whisper model.');
  }

  ws.close();
}

main().catch((error) => {
  console.error('audio test failed:', error.message);
  process.exit(1);
});
