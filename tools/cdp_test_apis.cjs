#!/usr/bin/env node
/**
 * End-to-end API verification for a running InterviewCopilot instance.
 *
 *   node tools/cdp_test_apis.cjs <port>
 *
 * Exercises the SAME IPC handlers the UI buttons use:
 *   updateSettings → whisperTranscriber.updateSettings
 *   test-model     → aiProviderManager.testModel
 *   test-transcription → whisperTranscriber.testApiConnection
 * Keys are never printed (only lengths/booleans).
 */
const PORT = process.argv[2] || '9223';

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
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('No page target. Start the app with --remote-debugging-port=' + PORT);

  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => (ws.onopen = resolve));
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
  };

  await send('Runtime.enable');
  await new Promise((r) => setTimeout(r, 800));

  console.log('=== 1) settings before ===');

  const cfg = await evaluate(`window.electronAPI.getSettings().then(s => JSON.stringify({
    transcriptionProvider: s.transcriptionProvider,
    transcriptionApiBaseUrl: s.transcriptionApiBaseUrl,
    transcriptionApiModel: s.transcriptionApiModel,
    transcriptionApiKeySet: !!s.transcriptionApiKey,
    transcriptionApiKeyLength: (s.transcriptionApiKey || '').length,
    selectedModel: s.selectedModel,
    customBaseUrl: s.customBaseUrl,
    customModels: (s.customModels || []).map(m => ({ id: m.id, model: m.model, baseUrl: m.baseUrl, keySet: !!m.apiKey })),
  }))`);
  console.log(cfg);

  console.log('=== 2) flip transcriptionProvider -> api (via updateSettings IPC) ===');
  const after = await evaluate(`window.electronAPI.updateSettings({ transcriptionProvider: 'api' }).then(s => s.transcriptionProvider)`);
  console.log('provider now:', after);

  console.log('=== 3) test-transcription (1s silent WAV through real IPC) ===');
  const t = await evaluate(`window.electronAPI.testTranscription()`);
  console.log(JSON.stringify(t));

  console.log('=== 4) getAvailableModels ===');
  const models = await evaluate(`window.electronAPI.getAvailableModels().then(m => m.map(x => x.id))`);
  console.log(JSON.stringify(models));

  console.log('=== 5) test-model for each custom model ===');
  const parsed = JSON.parse(cfg);
  for (const m of parsed.customModels) {
    const id = 'custom:' + m.id;
    const res = await evaluate(`window.electronAPI.testModel(${JSON.stringify(id)}, 'Reply with exactly: OK')`);
    console.log(id, '=>', JSON.stringify(res));
  }

  console.log('=== 6) settings after ===');
  const after2 = await evaluate(`window.electronAPI.getSettings().then(s => JSON.stringify({
    transcriptionProvider: s.transcriptionProvider,
    transcriptionApiModel: s.transcriptionApiModel,
    selectedModel: s.selectedModel,
  }))`);
  console.log(after2);

  ws.close();
}

main().catch((error) => {
  console.error('test failed:', error.message);
  process.exit(1);
});
