# Install / Update Guide — InterviewCopilot

This document explains how to install InterviewCopilot for the first time, and how to
update an existing install without breaking anything.

| Item | Value |
|------|-------|
| Installer you build | `release/InterviewCopilot Setup <version>.exe` |
| Latest installer in this repo | `C:\Users\Shivani Babar\InterviewCopilot\release\InterviewCopilot Setup 1.0.1.exe` |
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
Start-Process "C:\Users\Shivani Babar\InterviewCopilot\release\InterviewCopilot Setup 1.0.1.exe"
```
Follow the wizard; accept the default install folder.

### Option B — Silent install (for automated/scripted setups)
```powershell
Start-Process "C:\Users\Shivani Babar\InterviewCopilot\release\InterviewCopilot Setup 1.0.1.exe" -ArgumentList '/S' -Wait
```
The `/S` flag runs the NSIS installer silently. The app installs to
`%LOCALAPPDATA%\Programs\InterviewCopilot`.

### After install
1. Launch via the Start Menu shortcut **InterviewCopilot** (or double‑click the install path).
2. The first launch creates the settings file automatically with the following defaults:
   * Stealth mode: **enabled** (invisible on screen share, hidden from taskbar)
   * Whisper model: `ggml-base.bin` (already bundled; ~142 MB)
   * No AI model is configured yet — open **Settings → API** and add your provider/key/model
3. Verify the installed version:
   ```powershell
   (Get-Item "$env:LOCALAPPDATA\Programs\InterviewCopilot\InterviewCopilot.exe").VersionInfo
   ```

---

## 3. Update an existing install (e.g., v1.0.0 → v1.0.1)

1. **Close the running app** (same command as section 1).
2. Run the new installer (either with UI or silently):
   ```powershell
   Start-Process "C:\Users\Shivani Babar\InterviewCopilot\release\InterviewCopilot Setup 1.0.1.exe"
   # or silently:
   # Start-Process "C:\Users\Shivani Babar\InterviewCopilot\release\InterviewCopilot Setup 1.0.1.exe" -ArgumentList '/S' -Wait
   ```
3. Your settings and models are preserved — the installer only overwrites program files.
4. Launch the app and confirm **footer/version** shows the new version (1.0.1) and that your saved custom models are still present in **Settings → API**.

> **Note:** The Git commit that bumped to 1.0.1 also updated the UI (API tab now supports add / edit / delete of custom models). The installer picks up the updated renderer automatically.

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

Version is controlled by `package.json` → `"version": "1.0.1"` (bump as needed).

---

## 7. Where everything lives

| What | Path |
|------|------|
| Source | `C:\Users\Shivani Babar\InterviewCopilot\` |
| Installer | `release\InterviewCopilot Setup 1.0.1.exe` |
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
Start-Process "C:\path\to\InterviewCopilot Setup 1.0.1.exe" -ArgumentList '/S' -Wait

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
4. Start listening with `Ctrl+Shift+L` and say anything — the transcript appears under the command bar.
