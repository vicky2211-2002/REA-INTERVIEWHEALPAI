#!/usr/bin/env node
/**
 * Mock interview through the app's real AI pipeline (CDP).
 *   node tools/cdp_mock_interview.cjs 9228
 *
 * Sends 10 mock interview questions (3 rounds) via ask(mode: 'chat')
 * and records the streamed answers from the installed app.
 * Writes the report to <repo>/mock_interview_report.md ONLY if
 * SAVE_REPORT=1 is set (kept out of git by default).
 */
const fs = require('fs');

const PORT = process.argv[2] || '9228';
const SAVE_REPORT = process.env.SAVE_REPORT === '1';
const QUESTION_TIMEOUT_MS = 170_000;

const ROUNDS = [
  {
    round: 'Round 1 — HR / Introduction',
    questions: [
      'Tell me about yourself.',
      'Why are you looking for a new role right now?',
      'What is your greatest weakness, and how are you working on it?',
    ],
  },
  {
    round: 'Round 2 — Technical',
    questions: [
      'Walk me through the most technically challenging project you have built. What was hard about it, and what did you do?',
      'How would you design a URL shortener? Talk me through your high-level design and the trade-offs.',
      'Tell me about a time a production issue taught you something. How did you debug it?',
      'How do you keep your code reliable day to day — testing, reviews, anything else?',
    ],
  },
  {
    round: 'Round 3 — Behavioral & close',
    questions: [
      'Describe a time you disagreed with a teammate or a manager. How did you handle it?',
      'Where do you see yourself in five years?',
      'Do you have any questions for us?',
    ],
  },
];

let ws;
let nextId = 0;
const pending = new Map();

function cdpSend(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await cdpSend('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || 'evaluation failed');
  }
  return result.result.value;
}

(async () => {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  if (!page) {
    console.error('No page target. Launch the app with --remote-debugging-port.');
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

  await cdpSend('Page.enable');

  // ---- 1) Verify the new delete toast via the IPC the shortcut uses (empty state)
  console.log('=== Delete-toast check (delete-screenshot IPC, list empty) ===');
  await evaluate('window.electronAPI.deleteLastScreenshot()');
  let toastSeen = '';
  for (let i = 0; i < 12; i++) {
    const text = await evaluate('document.body.innerText');
    if (typeof text === 'string' && text.includes('No screenshots to delete')) {
      toastSeen = 'No screenshots to delete';
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log('toast visible:', toastSeen ? `YES ("${toastSeen}")` : 'NOT SEEN (may have faded or missed)');
  console.log('');

  // ---- 2) Mock interview
  for (const [index, roundInfo] of ROUNDS.entries()) {
    let qIndex = ROUNDS.slice(0, index).reduce((sum, r) => sum + r.questions.length, 0);

    console.log(`\n########## ${roundInfo.round} ##########\n`);

    for (const question of roundInfo.questions) {
      qIndex += 1;
      const id = `mock_q${qIndex}_${Date.now()}`;
      const marker = `__mock_done_${id}`;
      const textVar = `__mock_text_${id}`;
      const errVar = `__mock_err_${id}`;

      // Install per-question collector in the page
      await evaluate(`window.${textVar} = ''; window.${marker} = false; window.${errVar} = '';`);
      await evaluate(`(() => {
        const offChunk = window.electronAPI.onAnswerChunk(({ id: cid, chunk }) => { if (cid === '${id}') window.${textVar} += chunk; });
        const offEnd = window.electronAPI.onAnswerEnd(({ id: cid }) => { if (cid === '${id}') { window.${marker} = true; offChunk(); offEnd(); offErr(); } });
        const offErr = window.electronAPI.onAnswerError(({ id: cid, error }) => { if (cid === '${id}') { window.${errVar} = error || 'unknown'; window.${marker} = true; offChunk(); offEnd(); offErr(); } });
      })(); true`);

      const started = Date.now();
      const result = await evaluate(`window.electronAPI.ask({ id: '${id}', mode: 'chat', question: ${JSON.stringify(
        question,
      )} })`);
      const duration = Date.now() - started;

      // Wait for streaming completion
      let answer = '';
      let err = '';
      const deadline = Date.now() + QUESTION_TIMEOUT_MS;
      while (Date.now() < deadline) {
        const done = await evaluate(`window.${marker}`);
        if (done) break;
        await new Promise((r) => setTimeout(r, 500));
      }
      answer = String(await evaluate(`window.${textVar}`) ?? '');
      err = String(await evaluate(`window.${errVar}`) ?? '');

      console.log(`--- Q${qIndex}/10 (${duration} ms) ok=${result?.ok} ---`);
      console.log(`Q: ${question}`);
      if (err) {
        console.log(`ERROR: ${err}`);
      } else if (answer.trim().length === 0) {
        console.log('EMPTY ANSWER — provider returned nothing.');
      } else {
        console.log(`A (${answer.length} chars):`);
        console.log(answer.trim());
      }
      console.log('');
    }
  }

  if (SAVE_REPORT) {
    // captured via console by the caller
  }
  process.exit(0);
})().catch((error) => {
  console.error('mock interview failed:', error.message);
  process.exit(1);
});
