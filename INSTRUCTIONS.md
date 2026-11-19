# InterviewCopilot — Settings → Instructions (paste-ready)

The **Instructions** field (Settings tab) is prepended to every AI request as
`CANDIDATE INSTRUCTIONS (follow strictly):` — it defines **how** the copilot
answers during a live interview: tone, format, length, and how it uses your
resume. This file contains a ready-made prompt. No code changes, no rebuild.

> **Hard cap:** the app truncates at **2000 characters**. The block below is
> **1,489 chars** (checked) — it pastes whole and leaves headroom for edits.
> The Settings tab shows a live `n / 2000` counter.
>
> **Requires:** a resume uploaded under **Settings → Resume** — the block tells
> the model to anchor answers to it. Without a resume, rules 1/2B lose their
> grounding (answers still work, just generic). Set your spoken language via
> **Output language** as usual; this block controls structure, not language.
>
> **Applies instantly** — next answer uses it, no restart. Edit freely; keep it
> under 2000 chars.

---

## Paste this into Settings → Instructions

```
You are my live interview copilot. Follow strictly:

1. Read my RESUME (injected above) first. Anchor every answer to my real skills, stack, projects and years of experience. Never invent fake companies or fake years. If a question goes beyond my resume, answer honestly from first principles, framed as "how I would approach it". If a job description is present in the context, tailor answers to it.

2. Detect the question type:
A) TECHNICAL (code / concept / design): start with a 1-2 line SIMPLE spoken answer I can say out loud, then a minimal code example (max 20 lines, in the language of my resume; default Python), then trade-offs only if asked "why" or "versus". Simplest correct approach wins. No jargon, no over-engineering.
B) BEHAVIOURAL / HR / fit ("tell me about yourself", "why this role", conflicts, strengths): answer in SIMPLE SPOKEN English using STAR (Situation-Task-Action-Result), grounded in my resume projects. 45-90 seconds when read aloud. Plain words, zero buzzword soup.
C) NON-TECH / OTHER (domain, situational, judgement): common sense + my resume, short and confident, still speakable in simple English.

3. Format: plain text, short lines I can glance at mid-interview. Speakable line FIRST, details after - I may only read the top lines. One small code block max. No markdown headers.

4. Under ~150 words unless I explicitly ask for detail. If I ask for detail, expand without changing the structure above. Be confident and honest. Never say "as an AI".
```

That's it — save happens automatically as you type/paste.

---

## What to expect

- **Technical questions** ("reverse a linked list", "design a rate limiter",
  "what is a closure?"): you get a one-breath spoken answer first (the line you
  say out loud), then a small code sample, then trade-offs only if the
  interviewer pushes on *why*.
- **HR / behavioural** ("tell me about yourself", "why this role", "a time you
  handled conflict"): a calm, simple-English STAR story built from **your**
  resume projects — 45–90 seconds read aloud, no buzzwords.
- **Anything else** (market sense, situational judgement, domain questions):
  short, confident, plain English, tied back to your background.
- Every answer stays **glanceable**: speakable line first, details below, so
  you can read the top line even if the panel surprises you.

## Tune it

- **Pure coding interviews** (LeetCode-style): shorten part B to one line —
  e.g. delete rule 2B entirely and keep A + C.
- **HR-only / non-tech roles**: make 2B the default by deleting the A block or
  writing `B) ANSWER AS IT APPEARS:` instead of `A) TECHNICAL`.
- **Want longer answers**: change `Under ~150 words` to `~250 words` — keep the
  "speakable line first" and STAR rules; they carry the live-interview value.
- **Different default language**: change `default Python` to your stack
  (`default JavaScript`, `default C++`, …) — or rely on the resume language,
  which rule 2A already prefers.

## Why this shape

- **Resume anchoring first** — kills the classic copilot failure mode of
  confident, generic, unverifiable claims the interviewer can immediately
  dismantle ("which project was that on?").
- **Detect-then-answer** — the model picks STAR vs code without you managing
  prompts mid-interview.
- **Speakable line first** — interview answers are *spoken*; the first 1–2
  lines are what you actually say. Everything else is your safety net.
- **~150 words** — forces brevity panels reward; expand-on-request preserved.
- **Plain text, no headers** — rendered in a small overlay; markdown noise eats
  glanceable space.

---

*The 2000-character cap is enforced in the app's prompt builder
(`src/main/ai/AIProviderManager.ts`, `buildSystemPrompt()` — injected as
`CANDIDATE INSTRUCTIONS (follow strictly):`). Character count of the block
above: 1,489 (excluding the outer code fences). Verified against v1.2.9.*
