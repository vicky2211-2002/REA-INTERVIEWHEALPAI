# InterviewCopilot — Engineering Guide

Everything needed to understand, modify, verify, and rebuild this app without
breaking it — including how the original desktop app was reverse engineered and
how to inspect any Electron app you want to compare against.

- [1. What this app is](#1-what-this-app-is)
- [2. Tech stack](#2-tech-stack)
- [3. Repository layout](#3-repository-layout)
- [4. How it was built (end-to-end)](#4-how-it-was-built-end-to-end)
- [5. Runtime architecture](#5-runtime-architecture)
- [6. Update playbook (do not break it)](#6-update-playbook-do-not-break-it)
- [7. Verification toolkit](#7-verification-toolkit)
- [8. Reverse engineering an Electron app](#8-reverse-engineering-an-electron-app)
- [9. Packaging and release](#9-packaging-and-release)
- [10. Troubleshooting](#10-troubleshooting)
- [11. Known limitations and roadmap](#11-known-limitations-and-roadmap)

---

## 1. What this app is

A Windows desktop interview assistant:

1. Captures **system audio (loopback)** and optionally the microphone.
2. Transcribes it with a **selectable provider** — offline whisper.cpp
   (default), or an OpenAI‑compatible `/audio/transcriptions` API.
3. Generates answers with an **AI model the user configures** (any
   OpenAI-compatible endpoint, or OpenAI/Anthropic/Google/NVIDIA keys).
4. Can also answer from a **screenshot** ("Analyse Screen") for vision models.
5. Lives in a **transparent, always-on-top, click-through overlay** that can be
   hidden from screen shares.

It is a clean-room reimplementation of the behavior and layout of a reference
commercial app (`interviewhelpai-Windows.exe`, v1.3.5). No code was copied from
it; the reference was inspected (packaging format, Electron version, rendered
DOM) and the equivalent UX was rebuilt in this repository's own code.

Two deliberate product differences:

| Area | Reference app | This app |
| --- | --- | --- |
| Billing / Pro tab | `Billing` | `API` — you supply the model endpoint |
| AI access | Bundled subscription | Your own key (or local Ollama/LM Studio) |
| Transcription | Cloud service | **Local whisper.cpp** (Base bundled; larger models lazy‑download) **or API** — selected in Settings → API → Transcription; either way 3 s WAV chunks |

---

## 2. Tech stack

| Layer | Choice | Version | Why |
| --- | --- | --- | --- |
| Desktop runtime | Electron | 28.0.0 | Same class of app as the reference (Chromium + Node); transparent windows, `desktopCapturer`, `setContentProtection` |
| UI | React + TypeScript | 18.2 / 5.9 | Component state for overlay panels; TS catches IPC drift |
| Styling | Tailwind CSS | 3.3 | Reference uses utility classes; fast pixel tuning |
| Icons | lucide-react | 0.294 | Matches the reference's icon set |
| Markdown | react-markdown + remark-gfm | 10 / 4 | Streamed answers with tables, lists, code |
| Build (renderer) | Vite | 5 | `base: './'` so the app loads from `file://` |
| Build (main/preload) | esbuild | 0.21 | Single CJS bundle per process, `--external:electron` |
| Packaging | electron-builder | 24.13 (NSIS) | Per-user installer, no admin prompt |
| Settings | electron-store | 8 | JSON store in `%APPDATA%` |
| Speech | whisper.cpp CLI + GGML models | `whisper-cli.exe` | Offline, CPU-friendly, 3 s chunks |
| AI SDKs | openai 4.x, @anthropic-ai/sdk 0.14, @google/generative-ai 0.2 | — | Streaming + vision |
| Documents | pdf-parse 1.1.1 (`lib` entry), mammoth 1.13 | — | Resume PDF/DOCX extraction |

Notes that matter:

- **Node target is `node18`** in esbuild. Keep it aligned if you bump Electron.
- **Electron is pinned at 28** while the reference ships 43. Behavior used here
  exists in both; bumping is optional (see §6.4). Do not bump casually.
- **pdf-parse must stay on v1.** v2 pulls a pdfjs build that needs `DOMMatrix`
  and `ImageData`, which the Electron main process does not provide.
- No native modules, so `npmRebuild: false` is safe and installs are fast.

---

## 3. Repository layout

```
InterviewCopilot/
├─ src/
│  ├─ main/                    Electron main process (Node context)
│  │  ├─ main.ts               window, IPC, shortcuts, tray, screenshots, ask orchestration
│  │  ├─ paths.ts              packaged-aware resource paths
│  │  ├─ ai/AIProviderManager.ts   providers, model resolution, streaming, vision
│  │  ├─ whisper/WhisperTranscriber.ts  buffering, silence gate, WAV, whisper-cli
│  │  ├─ settings/SettingsManager.ts    electron-store defaults + migrations
│  │  ├─ context/ContextManager.ts      resume/JD parsing helpers
│  │  └─ stealth/StealthManager.ts      Win32 helpers (capture exclusion, toolwindow)
│  ├─ preload/
│  │  ├─ preload.ts            contextBridge → window.electronAPI
│  │  └─ types.ts              DUPLICATE of src/shared/types.ts (must stay identical)
│  ├─ renderer/                Vite root
│  │  ├─ index.html            transparent background, Inter font, CSP
│  │  └─ src/
│  │     ├─ App.tsx            state machine for the whole overlay
│  │     ├─ components/        CommandBar, Dashboard, CommandsTab, SettingsTab,
│  │     │                     ApiTab, ChatPanel, AnswerView, Keycap
│  │     ├─ hooks/useAudioCapture.ts   loopback/mic → 16 kHz PCM → IPC
│  │     └─ index.css          tokens, markdown styles, animations
│  ├─ shared/types.ts          IPC contract + Settings shape (single source of truth)
│  └─ types/pdf-parse.d.ts     local typings for pdf-parse v1
├─ resources/
│  ├─ whisper/                 whisper-cli.exe + DLLs + models/ggml-base.bin
│  ├─ icon.ico / icon.png / tray-icon.png
│  └─ ffmpeg/                  LEGACY, no longer packaged (safe to delete)
├─ tools/                      verification scripts (see §7)
├─ dist/                       build output (main.js, preload.js, renderer/)
├─ release/                    electron-builder output (installer + win-unpacked)
├─ ENGINEERING_GUIDE.md        this file
├─ README.md                   user-facing overview
├─ CLAUDE.md                   short brief for AI coding agents
├─ MULTI_AGENT_PROJECT_PLAN.md historical plan + final status
└─ AGENT_SKILLS_SETUP.md       optional agent-role catalog
```

---

## 4. How it was built (end-to-end)

This is the repeatable method. Use it whenever you want to match another desktop
app's behavior.

### Step 1 — Identify what the reference actually is

```powershell
Get-ChildItem "$env:LOCALAPPDATA\Programs\InterviewHelpAI"
Get-ChildItem "$env:LOCALAPPDATA\Programs\InterviewHelpAI\resources"
```

Presence of `icudtl.dat`, `snapshot_blob.bin`, `v8_context_snapshot.bin`,
`libEGL.dll`, `resources/app.asar` ⇒ it is an **Electron** app. The Chromium
version and Electron version are in the user agent (see §8):

```
interviewhelpai/1.3.5 Chrome/150.0.7871.224 Electron/43.4.1
```

Conclusion: "make it a real desktop app, not a web page" does **not** require a
different language — it requires the same *window model* (transparent, frameless,
always-on-top overlay) and the same *UI composition*.

### Step 2 — Get the real rendered UI

Never design from marketing screenshots. Launch the reference with a debugging
port and read its DOM:

```powershell
Start-Process "$env:LOCALAPPDATA\Programs\InterviewHelpAI\InterviewHelpAI.exe" `
  -ArgumentList "--remote-debugging-port=9222"
```

Then use `Page.captureScreenshot` + `Runtime.evaluate` (see `tools/cdp_smoke.cjs`
for the pattern). This gave exact measurements:

- viewport `1536x816`, `devicePixelRatio 1.25`
- transparent `body` (`rgba(0,0,0,0)`), Inter font
- command bar centered at top: logo · Answer · Analyse Screen · Chat · Show/Hide · `00:00` · mic
- dashboard card ≈1248 px wide starting at y≈78, tabs `All Commands | Settings | Billing`
- dark chat bar, white answer card, `data-*`-free utility classes (Tailwind)

### Step 3 — Rebuild the window and the flows

Implemented in this order (kept, because each step is independently verifiable):

1. **Overlay window** — full-work-area, `transparent`, `frame: false`,
   `alwaysOnTop('screen-saver')`, `skipTaskbar`, `show: false` → `showInactive()`.
2. **Click-through** — window ignores the mouse, renderer re-enables it over `[data-ui]`.
3. **Audio** — Web Audio loopback in the renderer (no FFmpeg, no Stereo Mix).
4. **Transcription** — 3 s buffers → WAV → `whisper-cli.exe` **or**
   `POST {baseUrl}/audio/transcriptions` (multipart) → transcript segments.
   The provider is `settings.transcriptionProvider` (`'local'` default, `'api'`
   optional). In API mode the whisper binary/model is never touched; a test
   clip can be sent via IPC `test-transcription` → `testApiConnection()`.
5. **AI** — provider manager with streaming; custom OpenAI-compatible endpoint.
6. **Screens** — `desktopCapturer` thumbnails, attached as vision input.
7. **Chrome** — tray, global shortcuts, settings persistence, stealth toggle.
8. **Packaging** — esbuild + Vite + electron-builder, models as extra resources.

### Step 4 — Verify, don't assume

Every claim in this repo was checked against a running instance: real speech
played through the speakers produced a real transcript; a mock OpenAI-compatible
server proved streaming/vision; the packaged build was re-tested from a clean
`%APPDATA%`. See §7 for the exact scripts.

### Step 5 — Package and re-test the package

Development success does not imply packaged success: resource paths change
(`app.isPackaged` → `process.resourcesPath`), the asar is read-only, and the
renderer loads from `file://`. Always smoke-test `release/win-unpacked`.

---

## 5. Runtime architecture

### 5.1 Window and click-through

```
main.ts
 ├─ BrowserWindow({ transparent, frame:false, alwaysOnTop, skipTaskbar })
 ├─ setAlwaysOnTop(true, 'screen-saver')
 ├─ setIgnoreMouseEvents(true, { forward: true })   after did-finish-load
 └─ ipcMain.on('set-ignore-mouse', (_, ignore) => win.setIgnoreMouseEvents(ignore, {forward:true}))
```

Renderer (`App.tsx`):

```ts
document.elementFromPoint(x, y)?.closest('[data-ui]')  // interactive?
```

`ignoring` starts as `true`, so the first mouse move over real UI restores clicks
and moving back to empty space lets clicks reach the window underneath. **Any new
interactive container must carry `data-ui`**, otherwise it is unclickable.

### 5.2 Audio → transcript

```
useAudioCapture.ts                 main.ts                    WhisperTranscriber.ts
AudioContext(16000)  ──PCM s16──▶  'audio-chunk'  ──────────▶  buffer 3 s
  ├ getUserMedia(chromeMediaSource:'desktop', sourceId)          ├ RMS < 0.004 → discard
  └ optional getUserMedia(mic)                                   ├ write 44-byte WAV header
                                                                 └ provider === 'local' ?
                                                                      spawn whisper-cli -m -f -l -nt -np
                                                                      : POST {base}/audio/transcriptions (multipart)
                                                                      → stdout / JSON {"text":…}
                                                                      → filler filter → segment
```

- The loopback source id comes from `desktopCapturer.getSources` in main
  (`get-loopback-source`). It is the **primary display**, so system audio is
  captured regardless of which app is playing it.
- `AudioContext({ sampleRate: 16000 })` makes Chromium resample for us; the
  renderer only converts Float32 → Int16.
- The graph is kept alive with a zero-gain node so nothing is echoed back.
- **Silence gate** (`isSilent`, RMS < 0.004 ≈ −48 dBFS) is essential: without it
  whisper "hears" words in noise and emits phantom segments ("you",
  "Thank you."). A filler list filters what still slips through.
- `isHallucination` also drops `[MUSIC]`, `(silence)` style annotations.
- **Transcription providers**: `transcriptionProvider` in settings is `'local'`
  (default; whisper.cpp, works offline) or `'api'` (OpenAI-compatible speech-to-text —
  OpenAI `whisper-1`, Groq `whisper-large-v3`, self-hosted faster-whisper). API mode
  POSTs each 3 s WAV (`response_format=json`, optional `language`) with
  `Authorization: Bearer <key>`; set Base URL to the `/v1` root — the code appends
  `/audio/transcriptions`. `initialize()` short-circuits in API mode (no whisper
  binary/model needed); missing keys throw a clear error that surfaces as a toast.
  `test-transcription` IPC → `testApiConnection()` sends a 1 s silent WAV so users
  can verify URL/key/model before relying on it. The spoken-language setting applies
  to both providers; keys never leave the local settings file. The API path applies
  the same `isHallucination` filter as the local path (drops "you"/"Thank you."
  fillers from near-silent audio). **Verified Nov 2026** with Groq free tier
  (`whisper-large-v3`, exact transcription of a synthesized SAPI sentence);
  NVIDIA NIM has no STT endpoint (HTTP 404) — NVIDIA keys work for answers only.
- **Saved transcription endpoints (v1.2.0)**: the API mode manages a list of
  `transcriptionProfiles: TranscriptionProfile[]` (`id, name, baseUrl, apiKey,
  model`) plus `selectedTranscriptionProfile` (id of the active profile). The
  effective config is resolved lazily at chunk time (`activeApiProfile()` in
  `WhisperTranscriber`): selected profile → first saved profile → legacy flat
  `transcriptionApi*` fields. A one-time v3 `settingsVersion` migration seeds a
  named profile from non-empty legacy flat fields, so existing users keep their
  working Groq configuration and can add more endpoints. The renderer manages
  profiles with the same Add / Edit / Use / Delete UX as custom chat models
  (Settings → API → Transcription); arrays replace wholesale through
  `update-settings` IPC (no dedicated add/remove IPC needed), and the transcriber
  re-reads fresh settings on every chunk, so edits and switches take effect
  immediately. Legacy flat fields remain as a last-resort fallback if every saved
  profile is deleted.

### 5.3 Model resolution (AI)

```
settings.selectedModel = "openai:gpt-4o"          → built-in provider
                       = "custom:<id>"            → providers.get("custom_<id>")
                       = "<bare-model-name>"      → generic custom endpoint
```

`getAvailableModels()` only lists providers that are actually usable:

- built-in providers appear when their key is set,
- custom models appear as `custom:<id>` when added with key + base URL,
- no usable provider ⇒ empty list ⇒ first-run opens the **API** tab.

On startup, if the saved model is not in that list it is replaced by the first
available one (or `''`). `''` produces the error
`No AI model selected. Open the API tab and add your key.`

### 5.4 Ask pipeline

```
renderer runAnswer('answer'|'screen')
   → (screen only) captureScreen()  → desktopCapturer thumbnail, last 5 kept
   → electronAPI.ask({id, mode, question})
main handleAsk()
   → builds prompt from last 12 transcript segments + mode instructions
   → generateResponseStream(...)  or  generateResponseStreamWithVision(...)
   → send('ai-response-chunk', {id, chunk})   (streamed)
   → send('ai-response-end' | 'ai-response-error')
   → 120 s watchdog guarantees the UI never stays stuck "streaming"
```

`answer` requires transcript context (otherwise it returns a helpful error).
`screen` works with no transcript. `chat` sends the user's text plus the last
6 chat turns.

### 5.5 Settings

`electron-store` file: `%APPDATA%\interview-copilot\interview-copilot-settings.json`.

Defaults live in `SettingsManager.DEFAULT_SETTINGS`. Migrations use
`settingsVersion` (currently `3`: `2` moved `whisperModel` from `large-v3` →
`base`; `3` seeds a saved transcription profile from the legacy flat
`transcriptionApi*` fields when the user had configured the API, keeping the
profile list the single source of truth in the UI while the flat fields remain
a fallback). The `transcriptionProvider` block (`transcriptionApiBaseUrl/Key/Model`) added in
v1.1.0 has no migration of its own — absent keys fall back to the defaults via electron-store
(`'local'`, `whisper-1`), so existing installs keep local offline transcription.

### 5.6 Shortcuts (registered in main, dispatched as `ui-command`)

`Ctrl+Enter` answer · `Ctrl+Shift+Enter` analyse screen · `Ctrl+Alt+Enter` chat ·
`Ctrl+R` reset · `Ctrl+Shift+L` listening · `Ctrl+H` screenshot · `Ctrl+Delete`
delete screenshot · `Ctrl+\` show/hide window · `Ctrl+Q` quit ·
`Ctrl+Shift+Alt+O` restore · `Ctrl+Shift+↑/↓/←/→` scroll · `Ctrl+←/→` move ·
`Ctrl+[/]` opacity.

---

## 6. Update playbook (do not break it)

### 6.0 Non-negotiable invariants

| Invariant | Why |
| --- | --- |
| `src/shared/types.ts` **and** `src/preload/types.ts` are byte-identical | preload is bundled separately; drift = silent IPC mismatch |
| Every interactive container keeps `data-ui` | otherwise it is transparent to clicks |
| `html/body/#root` stay transparent | the overlay must not dim the screen |
| IPC channel names match on both sides (`ask`, `audio-chunk`, `ai-response-*`, …) | no compile-time check across the bridge |
| `extraResources` filters still list only `ggml-base.bin` / `ggml-tiny.bin` | `ggml-large-v3.bin` is 3 GB and must never ship |
| pdf-parse stays on v1 (`lib/pdf-parse.js`) | v2 needs DOM globals in main |
| whisper.cpp boolean flags get **no value** | `--print-progress false` is parsed as an input file |
| Window is created only after `app.whenReady()` | `screen` cannot be used earlier |

### 6.1 Standard change loop

```powershell
npm install            # only after reviewing dependency diffs
npm run typecheck      # fails fast on IPC/typing drift
npm run build          # esbuild main + preload, vite renderer
npm run dev            # or: node tools/cdp_smoke.cjs
```

Then run the functional checks in §7 that correspond to what you touched, and
finally package (§9).

### 6.2 Common change recipes

**Add a setting**
1. `src/shared/types.ts` → add the field to `Settings`.
2. Copy it verbatim to `src/preload/types.ts` (keep files identical).
3. `SettingsManager.DEFAULT_SETTINGS` → add a default.
4. If existing users need a change, bump `settingsVersion` and migrate in
   `loadSettings()`.
5. Use it in main and/or renderer.

**Add an AI provider**
1. Extend the `AIProvider` union in `types.ts`.
2. Add a `BUILTIN_PROVIDERS` entry (name, models, `requiresApiKey`, `baseUrl`).
3. Add `init<Provider>()` and call it from `initializeProviders()`.
4. Extend `hasProviderKey()`.
5. Implement a `BaseProvider` subclass (streaming + optional vision).

**Add a UI panel**
1. Create it under `src/renderer/src/components/`.
2. Put `data-ui` on the outermost interactive element.
3. Keep it inside the fixed width used by the other panels (1240 px dashboard,
   960 px chat, 980 px answer) so the overlay stays centered.

**Change the audio pipeline**
Never send raw Float32 over IPC — the main process writes a 16 kHz mono s16le
WAV header. Keep `sampleRate = 16000`, 1 channel, 2 bytes/sample, or update
`writeWav()` accordingly.

### 6.3 Upgrade whisper.cpp / models

```powershell
.\resources\whisper\whisper-cli.exe --help   # confirm flags are still -m -f -l -nt -np
```

Replace **the whole `resources/whisper` set** (exe + every `ggml*.dll` +
`whisper.dll`) — mixing DLL versions crashes on load. Keep model names
`ggml-<size>.bin`. If you bump the bundled model size, update
`MODEL_URLS` and the install-size expectations in README.

### 6.4 Upgrade Electron (optional, higher risk)

1. Bump `devDependencies.electron`, `npm install`.
2. Re-check: `desktopCapturer.getSources`, `new AudioContext(16000)`,
   `chromeMediaSource: 'desktop'` constraints, `setContentProtection`,
   `setIgnoreMouseEvents(..., {forward:true})`, `setVisibleOnAllWorkspaces`.
3. Re-run the **audio**, **screen**, **click-through**, and **shortcut** tests.
4. Repackage and re-test `win-unpacked` (paths change with major versions).

### 6.5 Upgrade Node/TypeScript/Vite/esbuild

`tsconfig.json` targets and the esbuild `--target=node18` must stay compatible
with the Electron version's Node. Vite output feeds a `file://` page, so `base`
must remain `'./'`.

---

## 7. Verification toolkit

All scripts live in `tools/` and target a running instance with a debugging port.

### 7.1 Start an instance for inspection

```powershell
# development build
Start-Process .\node_modules\electron\dist\electron.exe -ArgumentList ".","--remote-debugging-port=9223"

# packaged build
Start-Process ".\release\win-unpacked\InterviewCopilot.exe" -ArgumentList "--remote-debugging-port=9224"
```

### 7.2 Visual + DOM smoke test

```powershell
node tools/cdp_smoke.cjs 9224 out=screens
```

Screenshots `01_home.png` and dumps visible text + node count. A blank shot with
`nodes: 0` means the renderer failed to load.

### 7.3 Audio → transcript end-to-end

```powershell
# 1. synthesize real speech to 16 kHz WAV
powershell -ExecutionPolicy Bypass -File tools/make_speech.ps1

# 2. start the test (subscribes, clicks the mic, waits)
$p = Start-Process node -ArgumentList "tools/cdp_audio_e2e.cjs","9223","20000" -NoNewWindow -PassThru

# 3. play it through the speakers while the app is listening
(New-Object Media.SoundPlayer "$env:TEMP\opencode\speech16k.wav").PlaySync()
$p.WaitForExit()
```

Expected: `transcripts: ["interviewer: …"]` with no phantom `candidate: you`.

### 7.4 AI paths without a paid key

```powershell
Start-Process node -ArgumentList "tools/mock_provider.cjs"   # http://127.0.0.1:8787
```

In the app's **API** tab use base URL `http://127.0.0.1:8787/v1`, key `mock-key`,
model `mock-model`. Then click **Answer**, **Analyse Screen**, and **Chat** — the
mock logs `{stream, hasImage, model}` per request, proving streaming and vision.

### 7.5 Window show/hide

```powershell
powershell -ExecutionPolicy Bypass -File tools/win_visible.ps1 -ProcessName InterviewCopilot
```

`NO VISIBLE WINDOWS` after clicking **Show/Hide** (or `Ctrl+\`), a window handle
after pressing `Ctrl+\` again.

### 7.6 Saved transcription profiles end-to-end (v1.2.0)

```powershell
node tools/cdp_test_apis.cjs 9224       # flips provider, runs test-transcription + test-model ×2
node tools/cdp_test_profiles.cjs 9224   # add dummy profile (bad key) → select → expect HTTP 401 →
                                        # switch back → test OK → delete dummy → state clean
```

`cdp_test_profiles.cjs` starts from the real settings, so it proves the whole
selection path without touching the user's Groq configuration.

### 7.7 Regression checklist

| Area touched | Must re-run |
| --- | --- |
| renderer/components | §7.2, click-through on a transparent area, each tab |
| audio/hook | §7.3 (real speech, silence, mic on) |
| AI/providers | §7.4 (answer + screen + chat) |
| transcription API / profiles | §7.6 (both providers) |
| settings | fresh run with deleted `%APPDATA%\interview-copilot` |
| packaging config | §9 plus packaged smoke test (Whisper ready) |
| shortcuts/tray | each accelerator in §5.6, tray menu items |

---

## 8. Reverse engineering an Electron app

Use this to compare against any desktop app (including newer builds of the
reference).

### 8.1 Extract and read the package

```powershell
npx @electron/asar extract "$env:LOCALAPPDATA\Programs\InterviewHelpAI\resources\app.asar" .\asar-out
Get-ChildItem .\asar-out\package.json, .\asar-out\dist | Select-Object Name,Length
```

`package.json` gives the app version and entry point; `dist/index.html` and
`dist/assets/*.js` are the actual UI bundle. Search strings for feature names:

```powershell
Select-String -Path .\asar-out\dist\assets\*.js -Pattern "Billing|Ultra Undetectable|shortcut" -List
```

### 8.2 Attach a debugger and read the live DOM

Launch with `--remote-debugging-port=<port>`, then use the Chrome DevTools
Protocol:

```
GET  http://127.0.0.1:9222/json/list      → targets + webSocketDebuggerUrl
Page.enable / Runtime.enable
Runtime.evaluate  { expression, returnByValue: true }   → computed styles, innerText
Page.captureScreenshot                                    → PNG of the real UI
```

`tools/cdp_smoke.cjs` is a minimal, dependency-free client (Node 18+ `fetch` and
global `WebSocket`).

### 8.3 When screenshots are blank

Chromium GPU-composited windows return blank with `PrintWindow`. Two other causes
of an all-black capture:

1. the app protects its window (`setContentProtection` /
   `WDA_EXCLUDEFROMCAPTURE`) — the reference defaults
   `{"ultraUndetectableMode": true}` in `%APPDATA%\interviewhelpai\settings.json`;
2. the overlay is transparent, so a desktop grab shows only what is behind it.

Fix for inspection only: set that setting to `false`, restart, then use CDP (which
is immune to capture protection because it reads the renderer's own surface).
**Restore the original file afterwards.**

### 8.4 Where apps keep their state

| What | Path |
| --- | --- |
| Reference install | `%LOCALAPPDATA%\Programs\InterviewHelpAI` |
| Reference settings | `%APPDATA%\interviewhelpai\settings.json` |
| Reference onboarding flag | `%APPDATA%\interviewhelpai\onboarding.done` |
| Debug port hint | `%APPDATA%\interviewhelpai\DevToolsActivePort` |
| This app's settings | `%APPDATA%\interview-copilot\interview-copilot-settings.json` |
| Lazy Whisper models | `%APPDATA%\interview-copilot\whisper-models` |
| Whisper temp WAVs | `%TEMP%\interview-copilot-whisper` |

### 8.5 Identify versions

- User agent from CDP `/json/version` gives `Chrome/<x> Electron/<y>`.
- `icudtl.dat` / `v8_context_snapshot.bin` confirm Electron.
- `app-update.yml` (if present) reveals the publisher/feed.

---

## 9. Packaging and release

```powershell
npm run build
npx electron-builder --win nsis
```

Output: `release/InterviewCopilot Setup <version>.exe` (~212 MB) and
`release/win-unpacked/` for smoke testing.

Size budget:

| Item | ~Size |
| --- | --- |
| Electron runtime | 90 MB |
| Whisper DLLs + `whisper-cli.exe` | 11 MB |
| Bundled `ggml-base.bin` | 141 MB |
| App asar (bundled JS/deps) | 54 MB |
| **Installer** | **212 MB** |

Rules:

- `files` ships only `dist/**/*` + `package.json`; main/preload are pre-bundled.
- `extraResources` ships `whisper/` (exe + `*.dll` + `models/ggml-base.bin`) and
  the three icon files.
- The installer is **per-user** (`perMachine: false`, `asInvoker`) → no UAC.
- Nothing is signed. Windows SmartScreen will warn on first run.
- Never add a resource over 100 MB to git (GitHub hard limit); models stay out.

Release checklist:

1. Bump `version` in `package.json`.
2. `npm run build` (typecheck included).
3. `npx electron-builder --win nsis`.
4. Delete `%APPDATA%\interview-copilot`, launch `release/win-unpacked/*.exe`,
   confirm: API tab opens, Whisper ready, audio transcribes, answer streams.
5. Attach the installer, note the version and size.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Window invisible / blank | renderer failed to load or app not ready | run `npm run build`; check `dist/renderer/index.html` exists; CDP `nodes:` count |
| `The 'screen' module can't be used before the app 'ready' event` | module-level `screen` usage | keep `screen` calls inside `whenReady` |
| Buttons unclickable | missing `data-ui` on the container | add the attribute |
| Clicks land on the app instead of the window behind | hover state never re-enabled | ensure `[data-ui]` hit-testing still runs on `mousemove` |
| No transcript | model missing, mic/loopback failed, or silence gate | `whisper-cli --help`; check `getLoopbackSource`; play a real WAV; or switch Settings → API → Transcription to **API (cloud)** + **Test connection** |
| Transcription API `HTTP 401/403` | wrong/missing key | Settings → API → Transcription → API Key; sent as `Authorization: Bearer <key>` |
| Transcription API `HTTP 404` | base URL includes the full endpoint | set Base URL to the root (`https://api.openai.com/v1`) — code appends `/audio/transcriptions` |
| Transcription garbled with API too | accents/noise in capture | check loopback device, raise speaker volume; API only hears what the PC plays |
| Transcript says only “you”/“Thank you.” | silence reaching whisper | keep `isSilent` threshold, do not lower it blindly |
| `error: 1 input file(s) failed` from whisper | a flag was given a value (`--print-progress false`) | booleans take no argument |
| PDF resume returns empty | scanned/image PDF (no OCR) or pdf-parse v2 installed | use a text PDF; pin `pdf-parse@1.1.1` |
| `ReferenceError: DOMMatrix is not defined` | pdf-parse v2 / pdfjs in main | require `pdf-parse/lib/pdf-parse.js` |
| `Provider not available: …` | model id missing its `custom:` prefix | select from the dropdown or add the model |
| Answer never finishes | provider stalled | 120 s watchdog reports an error; check key/base URL |
| Installer ~500 MB | `ffmpeg` or `ggml-large-v3.bin` leaked into resources | check `extraResources` filters |
| `whisper-cli.exe` crashes at start | mixed DLL/model versions | ship the whole `resources/whisper` folder consistently |

---

## 11. Known limitations and roadmap

Known limitations (deliberate, documented):

- Electron 28 (reference uses 43); behavior matches, runtime is older.
- No code signing → SmartScreen warning; no auto-update wiring
  (`electron-updater` is a leftover dependency).
- Screenshots capture the **primary display** only.
- No OCR: image-only PDFs produce no text.
- Whisper Base is bundled; bigger models download once on selection.
- `StealthManager` Win32 helpers exist but only `setContentProtection` (capture
  exclusion) is wired into the window; task-manager/Alt-Tab hiding is not.
- Single language UI (answers can be generated in many output languages).

Sensible next steps:

1. Signature + auto-update feed if this ever ships to users.
2. Multi-monitor screenshot picker (currently primary display).
3. Wire `hideFromTaskManager` / `hideFromAltTab` from `StealthManager`.
4. Optional partial-transcript streaming (currently 3 s chunks).
5. Model picker that queries `/v1/models` from the configured endpoint.
