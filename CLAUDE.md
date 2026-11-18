# CLAUDE.md — Working brief for AI coding agents

Short, accurate context for this repository. For depth, read
[`ENGINEERING_GUIDE.md`](./ENGINEERING_GUIDE.md). For user-facing behavior, read
[`README.md`](./README.md). For free/fast API endpoints for answers, vision,
coding and reasoning, read [`PROVIDERS.md`](./PROVIDERS.md).

**Status:** feature-complete rebuild; installer builds and has been tested
end-to-end (transcription, answer, screen analysis, chat, custom API, PDF resume,
hide/restore). Version 1.2.0 — transcription supports a selectable **Local
(offline whisper.cpp)** or **API (OpenAI-compatible `/audio/transcriptions`)**
provider. The API mode manages **multiple saved endpoints** (Settings → API →
Transcription → Add / Edit / Use / Delete; persisted as `transcriptionProfiles`
with `selectedTranscriptionProfile`; legacy flat fields are migrated once into a
named profile on first launch of v1.2.0). Verified end-to-end with Groq's free
`whisper-large-v3`: real-speech sentence transcribed exactly (HTTP 200), both
NVIDIA custom chat models `OK` via in-app Test, `test-transcription` IPC OK
(success on Groq key, clean HTTP 401 on a bad key), profile add / switch /
delete selection logic exercised via IPC, API path drops phantom fillers on
near-silent clips.

---

## What this is

A Windows desktop interview assistant (Electron overlay):

1. Captures system audio loopback (+ optional mic) in the renderer.
2. Transcribes with a **selectable provider** — offline whisper.cpp
   (`whisper-cli.exe`, bundled Base model) or an OpenAI-compatible
   speech-to-text API (OpenAI `whisper-1`, Groq `whisper-large-v3`,
   self-hosted faster-whisper). Default is Local; switch in
   Settings → API → Transcription (takes effect on the next audio chunk, no
   restart). The API mode supports **multiple saved endpoints** (Add / Edit /
   Use / Delete; `transcriptionProfiles` + `selectedTranscriptionProfile` in
   settings; flat legacy fields auto-migrate once into a named profile).
3. Answers with a **user-supplied** AI endpoint (OpenAI-compatible custom API, or
   OpenAI/Anthropic/Google/NVIDIA keys). No bundled subscription, no login.
4. Can answer from a screenshot for vision models ("Analyse Screen").
5. Runs as a transparent, always-on-top, click-through overlay with an optional
   "Ultra Undetectable Mode" (excluded from screen capture).

It reproduces the behavior/layout of the reference app
`interviewhelpai-Windows.exe` v1.3.5 (Electron 43.4.1) without copying its code.
The `Billing` tab is replaced by an `API` tab.

---

## Commands

```powershell
npm install                 # deps (no native modules)
npm run typecheck           # tsc across main/preload/renderer
npm run build               # esbuild main+preload, vite renderer -> dist/
npm run dev                 # source run (Vite + electron)
npx electron-builder --win nsis   # installer -> release/InterviewCopilot Setup <ver>.exe
```

Verification tools (app must run with `--remote-debugging-port=<port>`):

```powershell
node tools/cdp_smoke.cjs 9223 out=screens     # screenshot + DOM/node count
node tools/mock_provider.cjs                  # fake OpenAI endpoint on :8787
powershell -File tools/make_speech.ps1        # real 16 kHz speech WAV for testing
node tools/cdp_audio_e2e.cjs 9223 20000       # audio -> transcript assertions
powershell -File tools/win_visible.ps1 -ProcessName InterviewCopilot   # hidden?
node tools/cdp_test_apis.cjs 9224             # flip provider, test-transcription + test-model
node tools/cdp_test_profiles.cjs 9224         # saved transcription profile add/switch/delete flows
```

---

## File map (current architecture)

| Path | Responsibility |
| --- | --- |
| `src/main/main.ts` | Window creation, IPC handlers, global shortcuts, tray, screenshots, `handleAsk` orchestration, 120 s watchdog |
| `src/main/ai/AIProviderManager.ts` | Provider registry, `resolveProvider`, streaming + vision, custom endpoints |
| `src/main/whisper/WhisperTranscriber.ts` | 3 s buffering, silence gate, filler/hallucination filter, WAV writing, `whisper-cli` spawn, lazy model download, or POSTs WAV to an OpenAI-compatible `/audio/transcriptions` endpoint when `transcriptionProvider: 'api'` (IPC: `test-transcription` → `testApiConnection()`) |
| `src/main/settings/SettingsManager.ts` | electron-store defaults + `settingsVersion` migrations |
| `src/main/context/ContextManager.ts` | Resume/JD parsing (pdf-parse v1, mammoth, txt) |
| `src/main/stealth/StealthManager.ts` | Win32 helpers (capture exclusion, toolwindow) — only capture exclusion is wired |
| `src/main/paths.ts` | Packaged-aware resource paths (`app.isPackaged` → `process.resourcesPath`) |
| `src/preload/preload.ts` | `contextBridge` → `window.electronAPI` |
| `src/preload/types.ts` | **byte-identical duplicate** of `src/shared/types.ts` |
| `src/shared/types.ts` | IPC contract + `Settings` (single source of truth) |
| `src/renderer/src/App.tsx` | Overlay state machine, click-through hit-testing, UI command dispatch |
| `src/renderer/src/components/*` | `CommandBar`, `Dashboard`, `CommandsTab`, `SettingsTab`, `ApiTab`, `ChatPanel`, `AnswerView`, `Keycap` |
| `src/renderer/src/hooks/useAudioCapture.ts` | Loopback/mic → 16 kHz PCM s16le → IPC |
| `resources/whisper/` | `whisper-cli.exe` + DLLs + `models/ggml-base.bin` (141 MB) |
| `tools/` | Verification scripts (see above) |

`resources/ffmpeg/` is legacy and is **not** packaged — never reintroduce FFmpeg
for audio; loopback happens in the renderer.

---

## Invariants — breaking these breaks the app

1. `src/shared/types.ts` and `src/preload/types.ts` stay **identical**. They are
   bundled separately; drift produces silent IPC mismatches.
2. Every interactive container carries `data-ui`. Click-through is decided by
   `document.elementFromPoint(...).closest('[data-ui]')`; without the attribute a
   panel is invisible to the mouse.
3. `html`, `body`, `#root` stay transparent — the overlay must not tint the screen.
4. IPC channel names match on both sides (`ask`, `audio-chunk`, `ai-response-chunk`,
   `ai-response-end`, `ai-response-error`, `ai-transcript`, `set-ignore-mouse`, …).
5. Audio stays 16 kHz / mono / 2 bytes per sample. If that changes, update
   `writeWav()` in `WhisperTranscriber.ts` too.
6. `extraResources` must keep shipping only `ggml-base.bin` / `ggml-tiny.bin`.
   `ggml-large-v3.bin` is ~3 GB and must never enter the installer or git.
7. `pdf-parse` stays on v1 and is imported as `pdf-parse/lib/pdf-parse.js`
   (v2 needs `DOMMatrix`/`ImageData`, which do not exist in Electron main).
8. whisper.cpp boolean flags (`-nt`, `-np`, `-pp`) take **no** value; passing one
   makes `whisper-cli` treat it as an input file and fail with
   `1 input file(s) failed`.
9. The overlay window is created only inside `app.whenReady()` (`screen` module).
10. Do not lower the silence gate (`isSilent`, RMS < 0.004) to "get more
    transcript" — whisper then hallucinates `you` / `Thank you.` on noise.

---

## Settings and state

| What | Where |
| --- | --- |
| Settings | `%APPDATA%\interview-copilot\interview-copilot-settings.json` |
| Lazy Whisper models | `%APPDATA%\interview-copilot\whisper-models` |
| Temp WAVs | `%TEMP%\interview-copilot-whisper` |

`settingsVersion` is `2`; migration 2 changes the default Whisper model from
`large-v3` to `base` so a fresh install does not attempt a 3 GB download.

Model resolution in `settings.selectedModel`:

- `openai:gpt-4o` / `anthropic:…` / `google:…` / `nvidia:…` → built-in provider
- `custom:<id>` → entry from `customModels`
- bare name → generic OpenAI-compatible endpoint

If nothing resolves, the app shows
`No AI model selected. Open the API tab and add your key.`

---

## Build facts

- Electron **28.0.0** pinned (reference uses 43; behavior used here exists in both).
- Renderer: React 18 + Tailwind 3 + Vite 5 (`base: './'` for `file://`).
- Main/preload: esbuild, single CJS bundle each, `--target=node18`,
  `--external:electron`.
- Installer: NSIS, per-user, `asInvoker`, unsigned → SmartScreen warns.
- Size: Electron ~90 MB + Whisper ~11 MB + `ggml-base.bin` 141 MB + asar ~54 MB
  ⇒ **~212 MB** installer.

---

## Known limitations

Electron 28 (not 43); unsigned with no auto-update; screenshots are primary
display only; no OCR for scanned PDFs; Whisper Base bundled (bigger models
download on demand); `StealthManager` task-manager/Alt-Tab hiding exists as code
but is not wired; UI is English-only (answers can be any output language).

---

## Related documents

| File | Content |
| --- | --- |
| `README.md` | User guide: shortcuts, API setup, transcription, build |
| `ENGINEERING_GUIDE.md` | Architecture, build method, update playbook, verification toolkit, reverse-engineering notes |
| `MULTI_AGENT_PROJECT_PLAN.md` | Historical plan; header table records what shipped |
| `AGENT_SKILLS_SETUP.md` | Optional agent-role catalog (generic tooling reference) |
