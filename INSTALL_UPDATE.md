# Install / Update Guide — InterviewCopilot

This document explains how to install InterviewCopilot for the first time, and how to
update an existing install without breaking anything.

| Item | Value |
|------|-------|
| Installer you build | `release/InterviewCopilot Setup <version>.exe` |
| Latest installer in this repo | `C:\Users\Shivani Babar\InterviewCopilot\release\InterviewCopilot Setup 1.1.1.exe` |
| GitHub repo | https://github.com/vicky2211-2002/REA-INTERVIEWHEALPAI.git |
| Default install folder | `C:\Users\<YourName>\AppData\Local\Programs\InterviewCopilot\InterviewCopilot.exe` |
| Settings file (user data) | `%APPDATA%\interview-copilot\interview-copilot-settings.json` |
| Whisper models | `%APPDATA%\interview-copilot\whisper-models` |
| Installer type | NSIS, **per-user**, no admin rights required (`asInvoker`) |

---

## 1. Pre-install checklist

Before you install or update:

1. **Close every InterviewCopilot process.**
   ```powershell
   Get-Process -Name InterviewCopilot -ErrorAction SilentlyContinue | Stop-Process -Force
   ```
2. **Backup your settings** (optional but recommended):
   ```powershell
   Copy-Item "$env:APPDATA\interview-copilot\interview-copilot-settings.json" "$env:TEMP\interview-copilot-settings-backup.json"
   ```
3. Free at least **300 MB** on the drive (the installer is ~212 MB; the app is ~200 MB).
4. No antivirus/group policy blocks required — the installer is unsigned and may trigger SmartScreen (choose **More info → Run anyway** if blocked).

---

## 2. Install for the first time

### Option A — Run the installer with UI (recommended for most users)
```powershell
Start-Process "C:\Users\Shivani Babar\InterviewCopilot\release\InterviewCopilot Setup 1.1.1.exe"
```
Follow the wizard; accept the default install folder.

### Option B — Silent install (for automated/scripted setups)
```powershell
Start-Process "C:\Users\Shivani Babar\InterviewCopilot\release\InterviewCopilot Setup 1.1.1.exe" -ArgumentList '/S' -Wait
```
The `/S` flag runs the NSIS installer silently. The app installs to
`%LOCALAPPDATA%\Programs\InterviewCopilot`.

### After install
1. Launch via the Start Menu shortcut **InterviewCopilot** (or double‑click the install path).
2. The first launch creates the settings file automatically with the following defaults:
   * Stealth mode: **enabled** (invisible on screen share, hidden from taskbar)
   * Whisper model: `ggml-base.bin` (already bundled; ~142 MB)
   * **Transcription**: **Local (offline)** by default — switch to **API (cloud)** in the same tab if local accuracy isn't enough (see section 9.1)
   * No AI model is configured yet — open **Settings → API** and add your provider/key/model
3. Verify the installed version:
   ```powershell
   (Get-Item "$env:LOCALAPPDATA\Programs\InterviewCopilot\InterviewCopilot.exe").VersionInfo
   ```

---

## 3. Update an existing install (e.g., v1.0.0 → v1.1.1)

1. **Close the running app** (same command as section 1).
2. Run the new installer (either with UI or silently):
   ```powershell
   Start-Process "C:\Users\Shivani Babar\InterviewCopilot\release\InterviewCopilot Setup 1.1.1.exe"
   # or silently:
   # Start-Process "C:\Users\Shivani Babar\InterviewCopilot\release\InterviewCopilot Setup 1.1.1.exe" -ArgumentList '/S' -Wait
   ```
3. Your settings and models are preserved — the installer only overwrites program files.
4. Launch the app and confirm **footer/version** shows the new version (1.1.1) and that your saved custom models are still present in **Settings → API**.

> **Note:** v1.1.0 added the transcription provider switch (Local/API) and v1.1.1 verified both providers end‑to‑end (Groq whisper‑large‑v3; NVIDIA models via in‑app Test). The installer picks up the updated renderer automatically.

---

## 4. Verify the install

### Smoke test (recommended)
```powershell
Start-Process "$env:LOCALAPPDATA\Programs\InterviewCopilot\InterviewCopilot.exe" -ArgumentList "--remote-debugging-port=9228"
Start-Sleep -Seconds 5
node tools/cdp_smoke.cjs 9228 out=verify
```
Expect:
* `nodes: 182` (or thereabouts)
* Inner text contains "InterviewCopilot", "All Commands", "Settings", "API"
* Screenshot saved to `out/verify/01_home.png`

### Manual check
* Command bar is visible at top of screen
* `Ctrl+Shift+L` toggles listening
* `Ctrl+\` hides/restores the overlay
* `Ctrl+Enter` triggers an AI answer (requires an API key)
* Tray icon is visible with Show/Hide, Open Dashboard, Quit

---

## 5. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| "Installation failed" / blocked by SmartScreen | Unsigned installer | Click **More info → Run anyway** |
| App doesn't launch after install | Install folder permissions or missing VC++ runtime | Re-run installer as-is (no admin needed); if still failing, uninstall first: `Get-AppPackage InterviewCopilot -ErrorAction SilentlyContinue \| Remove-AppPackage` then reinstall |
| Old UI shows after update | Cached copy in `win-unpacked` or old shortcut pointing to old path | Delete `%LOCALAPPDATA%\Programs\InterviewCopilot` entirely and reinstall silently (`/S`) |
| Custom model still 404 | Wrong Base URL (must end with `/v1` for OpenAI‑compatible endpoints) | Open **Settings → API**, edit the model, set Base URL to `https://integrate.api.nvidia.com/v1` (or your endpoint’s `/v1` root), click **Save** |
| Settings not loaded | Corrupt `settings.json` | Restore backup from step 1.2, or delete the file (app will regenerate defaults on next launch) |
| Larger Whisper model missing | Not bundled; downloads on first use | Settings → API → Transcription → Whisper model → pick `small`/`medium`/`large-v3`; wait for one-time download to `%APPDATA%\interview-copilot\whisper-models` |
| Transcription garbage / mishears technical words | Local model too small (base) | Switch **Settings → API → Transcription → Whisper model** to `small`/`medium`, or switch the provider to **API (cloud)** with Base URL `https://api.openai.com/v1` (or Groq `https://api.groq.com/openai/v1`), model `whisper-1` — then click **Test connection** |
| Transcription API fails with 401/403 | Wrong or missing key | Re-check the key in Settings → API → Transcription → API Key; the key is sent as `Authorization: Bearer …` |
| Transcription API fails with 404 | Wrong base URL | The path `/audio/transcriptions` is appended automatically — set Base URL to the `/v1` root, e.g. `https://api.openai.com/v1`, not to the full endpoint |
| Build fails for source | Missing node_modules or TypeScript error | `npm ci && npm run build` |
| Installer doesn't appear in Program Files | Expected for per-user install | It installs under `%LOCALAPPDATA%\Programs`, not `C:\Program Files` |

---

## 6. Building the installer from source (for developers)

```powershell
# 1. Build renderer + main/preload bundles
npm install
npm run build

# 2. Create NSIS installer (per-user, ~212 MB)
npx electron-builder --win nsis
# Output: release\InterviewCopilot Setup <version>.exe
```

Version is controlled by `package.json` → `"version": "1.1.1"` (bump as needed).

---

## 7. Where everything lives

| What | Path |
|------|------|
| Source | `C:\Users\Shivani Babar\InterviewCopilot\` |
| Installer | `release\InterviewCopilot Setup 1.1.1.exe` |
| Installed app | `C:\Users\Shivani Babar\AppData\Local\Programs\InterviewCopilot\InterviewCopilot.exe` |
| User settings | `%APPDATA%\interview-copilot\interview-copilot-settings.json` |
| Whisper models | `%APPDATA%\interview-copilot\whisper-models\` (downloaded on demand) |
| Temp audio | `%TEMP%\interview-copilot-whisper\` |
| Tools | `tools/cdp_smoke.cjs`, `tools/cdp_audio_e2e.cjs`, `tools/mock_provider.cjs`, `tools/make_speech.ps1`, `tools/win_visible.ps1` |
| Git remote | `https://github.com/vicky2211-2002/REA-INTERVIEWHEALPAI.git` (branch `master`) |

---

## 8. Quick reference — commands

```powershell
# Close all instances
Get-Process -Name InterviewCopilot -ErrorAction SilentlyContinue | Stop-Process -Force

# Install silently
Start-Process "C:\path\to\InterviewCopilot Setup 1.1.1.exe" -ArgumentList '/S' -Wait

# Launch with debug port for smoke test
Start-Process "$env:LOCALAPPDATA\Programs\InterviewCopilot\InterviewCopilot.exe" -ArgumentList "--remote-debugging-port=9228"

# Smoke test
node tools/cdp_smoke.cjs 9228 out=verify

# Backup settings
Copy-Item "$env:APPDATA\interview-copilot\interview-copilot-settings.json" "$env:TEMP\ic-backup.json"

# Restore backup
Copy-Item "$env:TEMP\ic-backup.json" "$env:APPDATA\interview-copilot\interview-copilot-settings.json" -Force
```

---

## 9. After install — first 5 minutes

1. Open **Settings → API**.
2. Check **Base URL** for your custom provider (e.g., NVIDIA NIM: `https://integrate.api.nvidia.com/v1`).
3. Click **Test** next to the model name — you should see a short response.
4. Under **Transcription**, confirm the provider is **Local (offline)** (default). If the local model mis-hears questions, switch to **API (cloud)**: set your Base URL / key / model (e.g. OpenAI `whisper-1` or Groq `whisper-large-v3`), then click **Test connection**.
5. Start listening with `Ctrl+Shift+L` and say anything — the transcript appears under the command bar.

## 9.1 Transcription providers (v1.1.1+)

| Provider | Where it runs | Setup |
|----------|---------------|-------|
| **Local (offline)** — default | Your PC, via whisper.cpp | Settings → API → Transcription → Local; pick a model (`base` bundled; `small`/`medium`/`large-v3` download once) |
| **API (cloud)** — Groq recommended | Remote, via any OpenAI‑compatible `POST {base}/audio/transcriptions` | Settings → API → Transcription → API; set Base URL, API key, model; click **Test connection** |

### Recommended: Groq free tier (verified)

The app was verified end‑to‑end with **Groq's free `whisper‑large‑v3`** (Nov 2026):

1. Sign up free at **https://console.groq.com** → **API Keys** → **Create API Key** (`gsk_…`).
2. In **Settings → API → Transcription**, select **API (cloud)** and enter:
   * Base URL: `https://api.groq.com/openai/v1`
   * Model: `whisper-large-v3` (or `whisper-large-v3-turbo` for lower latency)
   * API Key: your `gsk_…` key
3. Click **Test connection** → expect `API reachable`.
4. Real-speech check: a spoken test sentence (“What is your experience with Git …”)
   returned an exact transcription (HTTP 200). Both NVIDIA chat models
   (`mistral-large-4-1t-a52b`, `nvidia/nemotron-3-ultra-550b-a55b`) were also
   verified with the in-app **Test** button.

Notes:
* Groq free tier is generous for interview prep; keys never leave the local settings file.
* Every ~3 s WAV clip is uploaded over HTTPS. Switching providers takes effect on the next audio chunk — no restart needed.
* The API path applies the same phantom-filler filter as the local path (drops
  “you”/“Thank you.” style hallucinations on near-silent clips).
* **NVIDIA NIM has no transcription endpoint** — `https://integrate.api.nvidia.com/v1/audio/transcriptions` returns HTTP 404 (verified Nov 2026). NVIDIA keys work for the AI answer models only; use Groq/OpenAI/self-hosted faster-whisper for speech.
