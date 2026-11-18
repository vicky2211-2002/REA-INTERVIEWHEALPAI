#!/usr/bin/env node
/**
 * Verifies saved transcription profile add / select / switch / delete flows
 * against a running InterviewCopilot instance (--remote-debugging-port=<port>).
 * Keys are never printed.
 *
 *   node tools/cdp_test_profiles.cjs <port>
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

  console.log('=== A) baseline ===');
  console.log(await evaluate(`window.electronAPI.getSettings().then(s => JSON.stringify({
    settingsVersion: undefined,
    profiles: (s.transcriptionProfiles || []).map(p => ({ id: p.id, name: p.name, model: p.model, keySet: !!p.apiKey })),
    selected: s.selectedTranscriptionProfile,
    provider: s.transcriptionProvider,
  }))`));

  console.log('=== B) add dummy profile (bad key) and select it ===');
  const dummyId = 'profile-test-' + Date.now();
  console.log(await evaluate(`(async () => {
    const s = await window.electronAPI.getSettings();
    const dummy = { id: ${JSON.stringify(dummyId)}, name: 'Dummy bad-key', baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'gsk_invalid_test_key_000000000000000000000000', model: 'whisper-large-v3' };
    const next = await window.electronAPI.updateSettings({
      transcriptionProfiles: [...(s.transcriptionProfiles || []), dummy],
      selectedTranscriptionProfile: dummy.id,
    });
    return JSON.stringify({ selected: next.selectedTranscriptionProfile, count: next.transcriptionProfiles.length });
  })()`));

  console.log('=== C) test-transcription against dummy (expect failure, bad key) ===');
  console.log(await evaluate(`window.electronAPI.testTranscription().then(r => JSON.stringify(r))`));

  console.log('=== D) switch back to the real (first) profile and test ===');
  console.log(await evaluate(`(async () => {
    const s = await window.electronAPI.getSettings();
    const real = s.transcriptionProfiles.find(p => p.id !== ${JSON.stringify(dummyId)});
    const next = await window.electronAPI.updateSettings({ selectedTranscriptionProfile: real.id });
    return 'selected: ' + next.selectedTranscriptionProfile;
  })()`));
  console.log(await evaluate(`window.electronAPI.testTranscription().then(r => JSON.stringify(r))`));

  console.log('=== E) delete the dummy profile ===');
  console.log(await evaluate(`(async () => {
    const s = await window.electronAPI.getSettings();
    const next = await window.electronAPI.updateSettings({
      transcriptionProfiles: s.transcriptionProfiles.filter(p => p.id !== ${JSON.stringify(dummyId)}),
    });
    return JSON.stringify({ count: next.transcriptionProfiles.length, selected: next.selectedTranscriptionProfile });
  })()`));

  console.log('=== F) final state ===');
  console.log(await evaluate(`window.electronAPI.getSettings().then(s => JSON.stringify({
    profiles: (s.transcriptionProfiles || []).map(p => p.name),
    selected: s.selectedTranscriptionProfile,
    provider: s.transcriptionProvider,
  }))`));

  ws.close();
}

main().catch((error) => {
  console.error('test failed:', error.message);
  process.exit(1);
});
