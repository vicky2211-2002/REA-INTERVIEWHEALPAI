#!/usr/bin/env node
/**
 * Minimal OpenAI-compatible mock provider.
 *
 *   node tools/mock_provider.cjs [port] [logFile]
 *
 * Verifies streaming, vision (image parts) and custom endpoints without a paid
 * key. In the app's API tab use:
 *
 *   base URL  http://127.0.0.1:8787/v1
 *   API key   mock-key
 *   model     mock-model
 *
 * Every request is appended to the log file as one JSON line:
 *   { url, model, stream, hasImage, messageCount }
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.argv[2] || 8787);
const LOG = process.argv[3] || path.join(__dirname, 'mock_requests.log');

fs.writeFileSync(LOG, '');

function log(obj) {
  fs.appendFileSync(LOG, JSON.stringify(obj) + '\n');
}

const ANSWER = [
  '**Situation.** On my last team two engineers disagreed on the data model for a billing migration, and the deadline was three weeks out.',
  '',
  '**Action.** I ran a 45-minute session where each side wrote the trade-offs down before speaking, then we agreed on explicit criteria: migration risk, query cost, and rollback safety.',
  '',
  '**Result.** We chose a hybrid schema, shipped a day early, and the approach became the template for later migrations.',
].join('\n');

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
    });
    return res.end();
  }

  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    let payload = {};
    try {
      payload = JSON.parse(body || '{}');
    } catch {
      /* ignore malformed body */
    }

    const messages = payload.messages || [];
    const last = messages[messages.length - 1] || {};
    const hasImage =
      Array.isArray(last.content) &&
      last.content.some((part) => part && part.type === 'image_url');

    log({ url: req.url, model: payload.model, stream: !!payload.stream, hasImage, messageCount: messages.length });

    if (req.url.includes('/models')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ data: [{ id: 'mock-model' }] }));
    }

    if (!payload.stream) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify({
          id: 'chatcmpl-mock',
          object: 'chat.completion',
          model: payload.model || 'mock-model',
          choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
          usage: { total_tokens: 5 },
        }),
      );
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const text = hasImage
      ? '**Screen answer.** The visible question asks about conflict resolution. Use STAR: the disagreement, the criteria you agreed on, and the measurable result.'
      : ANSWER;

    const words = text.split(' ');
    let i = 0;

    const timer = setInterval(() => {
      if (i >= words.length) {
        clearInterval(timer);
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      const chunk = (i === 0 ? '' : ' ') + words[i];
      i += 1;
      res.write(
        `data: ${JSON.stringify({
          id: 'chatcmpl-mock',
          object: 'chat.completion.chunk',
          model: payload.model || 'mock-model',
          choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }],
        })}\n\n`,
      );
    }, 45);

    res.on('close', () => clearInterval(timer));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock provider on http://127.0.0.1:${PORT} (log: ${LOG})`);
});
