# InterviewCopilot

Desktop interview assistant: a transparent, always-on-top overlay that listens to
interview audio, transcribes it locally, and generates answers with an AI model
you configure yourself.

The UI is a desktop overlay — a floating command bar, a white dashboard card,
a dark chat bar, and an answer card — not a browser page.

## What it does

| Action | Shortcut | Behavior |
| --- | --- | --- |
| Generate Answer | `Ctrl+Enter` | Answers the question just asked, using the live transcript as context |
| Analyse Screen | `Ctrl+Shift+Enter` | Captures the screen, then answers using what is visible plus the transcript |
| Chat with AI | `Ctrl+Alt+Enter` | Opens the chat bar (optional "Use Screen" toggle for vision models) |
| Reset Context | `Ctrl+R` | Clears transcript, screenshots, answers, and chat |
| Start / Stop Listening | `Ctrl+Shift+L` | Toggles live transcription |
| Take Screenshot | `Ctrl+H` | Manual capture; each press shows a toast confirming the shot was captured (attach more than one for multi-screen problems) |
| Delete Last Screenshot | `Ctrl+Delete` | Removes the newest screenshot from context (toast confirms) |
| Show / Hide App | `Ctrl+\` | Hides the overlay completely; press again to bring it back |
| Move App | `Ctrl+←` / `Ctrl+→` | Slides the overlay horizontally — both directions, ±75% of the screen |
| Transparency | `Ctrl+[` / `Ctrl+]` | Lowers / raises overlay opacity |
| Scroll Answers | `Ctrl+Shift+↑/↓` | Scrolls the answer, then jumps to the previous/next answer at the edges |
| Quit | `Ctrl+Q` | Exits (also available from the tray menu) |

Clicking anywhere outside the app's own widgets passes the click through to the
window underneath, so the overlay never gets in the way during an interview.

## Configure the AI

Open the dashboard (shield icon, or `Ctrl+\`), then the **API** tab. On first run
this tab opens automatically.

- **Custom API** — any OpenAI-compatible endpoint: base URL (for example
  `https://openrouter.ai/api/v1`, `http://localhost:11434/v1`, Groq, NVIDIA NIM,
  LM Studio, LiteLLM, vLLM, your own server), an API key, and the model name.
  Press **Add**, then **Test** to confirm.
- **Provider API Keys** — optional built-in providers (OpenAI, Anthropic, Google,
  NVIDIA). Any provider with a key appears in the model dropdown.

Nothing is sent anywhere except the endpoint you configure.

> **Free providers & models:** see [PROVIDERS.md](./PROVIDERS.md) — a verified
> (Nov 2026) list of fast **free** endpoints for answers, vision/image upload,
> coding and reasoning (Gemini, Groq, NVIDIA NIM, OpenRouter, Cerebras), with
> exact Base URLs and model IDs you can paste into Custom API.

> **Interview answer style:** see [INSTRUCTIONS.md](./INSTRUCTIONS.md) — a
> paste-ready **Instructions** prompt for Settings → Instructions (resume
> anchoring, technical vs behavioural/HR vs non-tech handling, speakable
> plain-English answers, 1,489 chars). Applies to the very next answer.

## Transcription

You choose how speech becomes text in **Settings → API → Transcription**:

- **Local (offline)** — [whisper.cpp](https://github.com/ggerganov/whisper.cpp), no cloud, no key. This is the default.
  - The **Base** model (~142 MB) ships with the installer and works offline.
  - Larger models (small / medium / large-v3) download once into
    `%APPDATA%\interview-copilot\whisper-models` the first time they are selected.
- **API (cloud)** — every ~3 s of audio is POSTed to an OpenAI‑compatible
  `…/audio/transcriptions` endpoint (multipart WAV). Works with OpenAI `whisper-1`,
  **Groq `whisper-large-v3`** (recommended; free tier at console.groq.com), or any
  self‑hosted faster‑whisper server. The Groq setup is verified end‑to‑end — Base
  URL `https://api.groq.com/openai/v1`, Model `whisper-large-v3`.
  **Multiple saved endpoints** are supported: **Add** a named API (name,
  Base URL, key, model), **Use** to switch the active one, **Edit** / **Delete**
  as needed. **Test connection** checks the active saved API. Your flat Base
  URL / key / model from earlier versions is migrated into a saved profile on
  first launch — nothing is lost. Use this when the local models mis-hear
  technical vocabulary/accents.
  Note: NVIDIA NIM has **no** transcription endpoint (verified — HTTP 404), so
  NVIDIA keys work for answers only, not for speech.

Either way:

- Audio is captured with desktop loopback (Web Audio), so Stereo Mix or a virtual
  cable is **not** required. A microphone can be enabled alongside it.
- Silent audio is discarded before transcription, which prevents phantom
  segments on quiet stretches.

## Customize answers

**Settings** tab:

- **Output Language** for AI responses.
- **Resume Context** — pick a PDF/DOCX/TXT resume; its text is added to every prompt.
- **Instructions** — up to 2000 characters, auto-saved.
- **Ultra Undetectable Mode** — hides the window from screen capture/recording.
  The cursor never changes over the overlay either (always a plain arrow — no
  hand/pointer/I-beam over invisible widgets during a screen share), and
  provider errors are sanitized so no API key can appear in the UI (v1.2.1).
  Hover hints ("Click to open dashboard", "Start listening") are in-page
  tooltips hidden by the same protection — native OS tooltips are never shown
  (v1.2.2). Pressing Answer with no audio captured shows a small neutral
  toast, not a red error card.
- **Screen vision control** (v1.2.3) — choose whether "Analyse Screen" sends
  screenshots to the model, and optionally dedicate a multimodal model to
  screenshots (Settings → Screen analysis). If your endpoint rejects images
  (e.g. vLLM without `--enable-multimodal`), the app automatically answers
  from the transcript instead of failing.

## Development

```powershell
npm install
npm run dev            # run from source (Vite renderer + electron)
npm run build          # typecheck, bundle main/preload, build renderer
npx electron-builder --win nsis   # build the Windows installer
```

Output: `release/InterviewCopilot Setup <version>.exe` (NSIS, per-user install,
no admin prompt). The build bundles `resources/whisper` (CLI + Base model) as
extra resources; nothing else is downloaded at install time.

### Layout

```
src/main/       Electron main process: overlay window, IPC, shortcuts, tray,
                screenshots, answer orchestration
src/main/ai/    Provider manager (OpenAI/Anthropic/Google/NVIDIA/custom, streaming + vision)
src/main/whisper/  whisper.cpp wrapper (lazy model download, WAV wrapping, silence gate)
src/preload/    contextBridge API (types.ts must stay identical to src/shared/types.ts)
src/renderer/   React + Tailwind overlay UI
src/shared/     Shared types
```

### Settings location

`%APPDATA%\interview-copilot\interview-copilot-settings.json`
