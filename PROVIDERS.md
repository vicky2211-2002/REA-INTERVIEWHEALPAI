# Free API Providers & Models — Verified November 2026

Everything below works in **InterviewCopilot** via **Settings → API → Custom API**
(paste `Base URL` + `Model` + your key → **Add** → **Test**). No code changes.

> **How to read this:** ✅ = tested against the real API on 2026-11-18 (from a
> script and/or the app's own Test button). *docs* = taken from official
> documentation only, not run by us. Speeds are ballpark (shared free capacity
> fluctuates). Free tiers change without notice — re-verify with **Test**
> before relying on a model.

> **Keys** go ONLY in the local settings file
> (`%APPDATA%\interview-copilot\interview-copilot-settings.json`) — never in this repo.

---

## TL;DR — pick per use case

| Goal | Provider | Base URL | Model | Speed | Status |
|---|---|---|---|---|---|
| **Answer** — best quality (you have this) | NVIDIA NIM | `https://integrate.api.nvidia.com/v1` | `mistralai/mistral-large-4-1t-a52b` | ~1.2 s | ✅ |
| **Answer** — fast free | Groq | `https://api.groq.com/openai/v1` | `qwen/qwen3.8-27b` | ~0.5 s | ✅ |
| **Answer** — fastest possible (~3000 tok/s) | Cerebras | `https://api.cerebras.ai/v1` | `gpt-oss-120b` | ~1–3 s | *docs* |
| **Answer** — newest free multimodal | Google AI Studio | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemini-3.8-flash` | fast | *docs* |
| **Coding** — long-horizon SWE, free | Google AI Studio | `…generativelanguage…/v1beta/openai/` | `gemini-3.8-flash` / `gemini-4-hydrogen` | fast | *docs* |
| **Coding** — fast, free, your NIM key | NVIDIA NIM | `https://integrate.api.nvidia.com/v1` | `poolside/laguna-xs-2.1` | ~0.4 s | ✅ |
| **Coding** — free code model | OpenRouter | `https://openrouter.ai/api/v1` | `cohere/north-mini-code:free` | shared | *docs* |
| **Image upload / vision** — reads text ✅ | NVIDIA NIM | `https://integrate.api.nvidia.com/v1` | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | ~1.6 s | ✅ (read "GIT" from image) |
| **Image upload / vision** | NVIDIA NIM | `https://integrate.api.nvidia.com/v1` | `nvidia/nemotron-3.5-super-vl-120b-a12b` | ~1.1 s | ✅ |
| **Image upload / vision** — free, multimodal | Google AI Studio | `…generativelanguage…/v1beta/openai/` | `gemini-3.8-flash` or `gemini-4-hydrogen` | fast | *docs* |
| **Reasoning** — fastest | Groq | `https://api.groq.com/openai/v1` | `openai/gpt-oss-120b` | ~0.8 s | ✅ |
| **Reasoning** — fastest possible | Cerebras | `https://api.cerebras.ai/v1` | `gpt-oss-120b` | ~3000 tok/s | *docs* |
| **Reasoning** — with vision | NVIDIA NIM | `https://integrate.api.nvidia.com/v1` | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | ~1.6 s | ✅ (17×23 → 391) |
| **Speech-to-text** (the app's STT) | Groq | `https://api.groq.com/openai/v1` | `whisper-large-v3` / `-turbo` | audio | ✅ exact sentence |
| **STT** alternative | Google AI Studio | native API only | `gemini-3.5-transcribe` (free) | audio | *docs* — **not** `/audio/transcriptions`-compatible, so not usable by the app's Whisper path |

---

## 1. Google AI Studio / Gemini API — free, multimodal, 1M tokens

- **Sign up:** [aistudio.google.com](https://aistudio.google.com) → **Get API key** (no credit card).
- **Base URL:** `https://generativelanguage.googleapis.com/v1beta/openai/`
- **Model list call:** `GET …/v1beta/openai/models` with your key.

Free of charge (Standard tier, verified on the official pricing page 2026-11-18):

| Model | Best for | Notes |
|---|---|---|
| `gemini-3.8-flash` | Answers, coding, agents, vision | "Most intelligent Flash", long-horizon SWE, free |
| `gemini-4-hydrogen` | Everyday coding / agentic, vision | Free tier, unified 1M ctx |
| `gemini-3.6-flash` | Answers, vision | Previous-gen Flash, free |
| `gemini-3.5-flash-lite` | High volume, translation | Free |
| `gemini-3.1-flash-lite` | Cheapest/fastest, high volume | Free |
| `gemini-3.8-live` | Real-time dialogue | Free |

**NOT free:** `gemini-4-carbon`, `gemini-4-argon` (paid only).

Why Gemini for images/uploads: all the above are **natively multimodal**
(text+image+video+audio in) — no separate vision model needed. Pass the
screenshot as an `image_url` data URI — exactly what the app does for **Analyse
Screen** and image attachments, so a Gemini key is the one-line way to get free
vision.

**Reasoning:** Gemini supports OpenAI `reasoning_effort` (`low`/`medium`/`high`)
on these models, so reasoning depth can be tuned per request.

Caveats:
- Free tier content is used to improve Google products.
- Daily request caps apply; Priority/Batch tiers have separate meters.
- Free **STT exists** (`gemini-3.5-transcribe`, free) but it is **not** the
  OpenAI `/audio/transcriptions` shape the app's Whisper path uses — keep
  **Groq `whisper-large-v3`** for transcription (free, verified end-to-end).

## 2. Groq — free, blazing fast text

- **Sign up:** [console.groq.com](https://console.groq.com) → API Keys (free plan).
- **Base URL:** `https://api.groq.com/openai/v1`

Available on your free key right now (queried `…/models` 2026-11-18):

| Model | Best for | Speed | Status |
|---|---|---|---|
| `openai/gpt-oss-120b` | Reasoning, complex answers | ~500 tok/s (~0.8 s) | ✅ |
| `openai/gpt-oss-20b` | Cheap/fast answers | ~1000 tok/s (~0.4 s) | ✅ |
| `qwen/qwen3.8-27b` | Fast general answers | ~450 tok/s (~0.5 s) | ✅ |
| `whisper-large-v3` / `whisper-large-v3-turbo` | Speech-to-text | audio | ✅ (app uses this) |

Notes:
- **No vision model on Groq free tier currently** (Llama-4 Scout/Maverick are gone).
- Reasoning models (`gpt-oss-*`) burn tokens on thinking — use the app's normal
  streaming (its answer path requests plenty of tokens); tiny `max_tokens` test
  calls return empty content. If you 8-token test, you'll see `""` — not a bug.
- Free plan has rate limits (dashboard shows your usage); 429 = switch provider.

## 3. NVIDIA NIM — free developer tier (you already have a key)

- **Sign up:** [build.nvidia.com](https://build.nvidia.com) → profile → **Get API Key** (`nvapi-…`). Free with rate limits.
- **Base URL:** `https://integrate.api.nvidia.com/v1`

32 models available on your key (queried 2026-11-18). What actually matters:

| Model | Best for | Speed | Status |
|---|---|---|---|
| `mistralai/mistral-large-4-1t-a52b` | Answer (your current pick) | ~1.2 s | ✅ |
| `poolside/laguna-xs-2.1` | Coding (agentic code model) | ~0.4 s | ✅ |
| `minimaxai/minimax-m3.1-flash` | Fast answers | ~0.5 s | ✅ |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | Reasoning **+ vision** | ~1.6 s | ✅ (17×23 → 391; read "GIT" off an image) |
| `nvidia/nemotron-3.5-super-vl-120b-a12b` | Vision / image upload | ~1.1 s | ✅ |
| `nvidia/nemotron-3-ultra-550b-a55b` | Max-quality answers (your 2nd saved model) | shared queue | ✅ earlier (HTTP 200 "OK") |
| `nvidia/cosmos-reason2-8b` | Reasoning | — | untested |
| `google/gemma-4-31b-it` | Vision, quality | **~52 s** | ✅ but far too slow — avoid |
| `z-ai/glm-5.3-flash` | — | **timeout >60 s** | ❌ avoid on free queue |
| `moonshotai/kimi-k3.1-pro` | — | **timeout >60 s** | ❌ avoid on free queue |
| `bigcode/starcoder2-15b` | Legacy code | — | untested |

Reality check on the free tier: it is **shared capacity** — the same model can
answer in 0.4 s at one time and hit a 60 s timeout at another. Keep
`poolside/laguna-xs-2.1` and `minimax-m3.1-flash` as fast picks; if you see
`429`/timeouts, flip to Groq.

**Not available:** Speech-to-text — `…/audio/transcriptions` returns
**HTTP 404** (verified 2026-11-18). NIM is for answers/vision/reasoning only.
Your Groq key handles transcription.

## 4. OpenRouter — free auto-router + 17 free models today

- **Sign up:** [openrouter.ai](https://openrouter.ai) → account → **Keys** (free).
- **Base URL:** `https://openrouter.ai/api/v1`

Free models right now (queried public `…/api/v1/models`, 478 total, 17 free on 2026-11-18):

| Model | Modality | Best for |
|---|---|---|
| `openrouter/free` | text+image → text (200k ctx) | Auto-picks among free models — easiest single entry |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | text (1M) | Frontier reasoning/answers |
| `nvidia/nemotron-3.5-lightning:free` | text (1M) | Fast answers |
| `nvidia/nemotron-3.5-super-vl:free` | text+image+video (1M) | Vision |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | text+image+audio+video (256k) | Reasoning + vision |
| `google/gemma-4-31b-it:free` / `google/gemma-4-26b-a4b-it:free` | text+image+video (262k) | Vision |
| `cohere/north-mini-code:free` | text (256k) | Coding |
| `thinkingmachines/inkling-2-small:free` | text+image (1M) | General |
| `baidu/ernie-5.5-flash-preview:free` | text (1M) | General |
| `inclusionai/ling-3.2-flash:free` | text+image (1M) | General |
| `liquid/lfm-3-1.7b:free` | text (262k) | Tiny/edge |
| `particle-ai/particle-1:free` | text+image (1M) | General |
| `recursive/flint-v1.0:free` | text (262k) | General |

Caveats: shared free capacity, lower rate limits, and the fleet rotates — run
`openrouter/free` for least effort, or pin a specific model and **Test** it.
Free models require an OpenRouter account but $0.

## 5. Cerebras — free, datacenter-class speed

- **Sign up:** [cloud.cerebras.ai](https://cloud.cerebras.ai) → API keys (free trial tier).
- **Base URL:** `https://api.cerebras.ai/v1`

Free Shared Inference (verified on official docs 2026-11-18):

| Model | Speed | Free ctx |
|---|---|---|
| `gpt-oss-120b` | **~3000 tok/s** | 65k |
| `qwen-3.8-27b` | ~1850 tok/s | 64k |

Best for the "faster model" requirement: same open weights as Groq but on
wafer-scale engines. If you want the single fastest free answer box, this is it.

## 6. Optional / not recommended

- **Z.ai (bigmodel.cn)** — GLM-Flash free tier exists, but the console is
  Chinese and requires phone verification; `z-ai/glm-5.3-flash` on your NIM key
  timed out >60 s when tested. Skip unless you specifically want GLM.
- **SambaNova Cloud** — free tier existed; current docs moved, unverified.
- **Cloudflare Workers AI** — ~10k neurons/day free, OpenAI-compatible-ish
  endpoint — plausible but unverified here.
- **GitHub Models** — **retired 2026-07-30**; ignore guides that reference it.
  Azure AI Foundry is the documented successor (paid mostly).

---

## Wiring it into the app (2 minutes)

1. **Settings → API → Custom API**: paste the **Base URL** and the **exact model id** above, then your key.
2. Click **Add** → model appears in the dropdown as `custom:<model>`.
3. Click **Test** (green button) — expect a short reply; `401` = wrong key,
   `404` = wrong model id/base URL, `429` = rate limit, `timeout` = free queue
   is busy (try Groq/Cerebras instead).
4. **Analyse Screen / image attachments** only work if the *selected* model is
   vision-capable → pick `nemotron-3-nano-omni-30b-a3b-reasoning`,
   `nemotron-3.5-super-vl-120b-a12b`, or a Gemini model, not a text-only one.
5. Switching models is instant (next request uses the new model) — keep two
   free providers per role and flip when you hit a limit.

## Recommended starter packs

**A. Zero new signups (keys you already have)** — all verified ✅
`mistralai/mistral-large-4-1t-a52b` (answers) + `nemotron-3-nano-omni-30b-a3b-reasoning`
(vision/reasoning) + `poolside/laguna-xs-2.1` (coding) + Groq `qwen/qwen3.8-27b`
(fast backup) + Groq `whisper-large-v3` (speech).

**B. One Google signup** — `gemini-3.8-flash` for everything (it answers, codes,
reasons, and reads screenshots; free), Groq `whisper-large-v3` stays for speech.

**C. Speed demon** — Cerebras `gpt-oss-120b` for answers/reasoning/coding,
Groq `whisper-large-v3-turbo` for speech, Gemini Flash only if you need vision.

---

*Verified 2026-11-18 against the live endpoints using keys stored in the local
settings file. Model availability, free limits, and pricing change — always
re-check with the in-app **Test** button before an interview.*
