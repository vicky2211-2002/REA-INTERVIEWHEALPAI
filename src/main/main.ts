import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  globalShortcut,
  nativeImage,
  Tray,
  Menu,
  dialog,
  desktopCapturer,
  shell,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import {
  AIModel,
  AskRequest,
  Settings,
  TranscriptSegment,
  UiCommand,
} from '@shared/types';
import { WhisperTranscriber } from './whisper/WhisperTranscriber';
import { AIProviderManager } from './ai/AIProviderManager';
import { SettingsManager } from './settings/SettingsManager';
import { StealthManager } from './stealth/StealthManager';
import { ContextManager } from './context/ContextManager';
import { preloadFile, rendererFile, iconFile, trayIconFile } from './paths';

// ---------------------------------------------------------------------------
// Single instance
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

let settingsManager: SettingsManager;
let whisperTranscriber: WhisperTranscriber;
let aiProviderManager: AIProviderManager;
let stealthManager: StealthManager;
let contextManager: ContextManager;

let isListening = false;
let currentTranscript: TranscriptSegment[] = [];
let screenshots: string[] = [];
let lastQuitAt = 0;
let listeningStartedAt = 0;

const appStartedAt = Date.now();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function send(channel: string, payload?: unknown) {
  mainWindow?.webContents.send(channel, payload);
}

function command(cmd: UiCommand) {
  send('ui-command', cmd);
}

function toast(message: string, kind: 'info' | 'error' | 'success' = 'info') {
  send('toast', { message, kind });
}

function currentSettings(): Settings {
  return settingsManager.getSettings();
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function createOverlayWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  mainWindow = new BrowserWindow({
    x: display.workArea.x,
    y: display.workArea.y,
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: preloadFile(),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  // Stay above normal windows without stealing focus.
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'win32') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  mainWindow.loadFile(rendererFile('index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow?.showInactive();
    applyStealth();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Renderer wants click-through except over its own widgets.
  mainWindow.webContents.on('did-finish-load', () => {
    send('settings-update', currentSettings());
    mainWindow?.webContents.send('transcript-update', currentTranscript);
    if (screenshots.length) send('screenshots-update', screenshots);
    setTimeout(() => mainWindow?.setIgnoreMouseEvents(true, { forward: true }), 250);
  });
}

function applyStealth() {
  if (!mainWindow) return;
  const settings = currentSettings();
  mainWindow.setAlwaysOnTop(settings.alwaysOnTop, 'screen-saver');
  mainWindow.setOpacity(clamp(settings.windowOpacity, 0.2, 1));
  // WDA_EXCLUDEFROMCAPTURE — invisible to screen shares/recordings.
  try {
    mainWindow.setContentProtection(settings.undetectableMode || settings.invisibleOnScreenShare);
  } catch (err) {
    console.warn('[Main] setContentProtection failed:', err);
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Provider errors sometimes echo the rejected key (OpenAI-style messages do).
 * Never let a gsk_/nvapi-/sk-/Bearer token reach the UI, the toast, or the log.
 */
function sanitizeProviderMessage(text: string): string {
  return text
    .replace(/gsk_[A-Za-z0-9_-]+/g, 'gsk_…')
    .replace(/nvapi-[A-Za-z0-9_-]+/g, 'nvapi-…')
    .replace(/sk-[A-Za-z0-9_-]{6,}/g, 'sk-…')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer …');
}

function createTray() {
  try {
    const iconPath = trayIconFile();
    const icon = fs.existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
      : nativeImage.createEmpty();

    tray = new Tray(icon);
    const menu = Menu.buildFromTemplate([
      { label: 'Show / Hide', click: () => toggleVisibility() },
      { label: 'Open Dashboard', click: () => { showWindow(); command({ type: 'toggle-dashboard' }); } },
      {
        label: 'Start / Stop Listening',
        click: () => {
          command({ type: 'toggle-listening' });
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]);
    tray.setToolTip('InterviewCopilot');
    tray.setContextMenu(menu);
    tray.on('double-click', () => toggleVisibility());
  } catch (err) {
    console.warn('[Main] tray unavailable:', err);
  }
}

function toggleVisibility() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.showInactive();
    applyStealth();
  }
}

// ---------------------------------------------------------------------------
// Transcript / AI
// ---------------------------------------------------------------------------
function pushTranscript(segment: TranscriptSegment) {
  currentTranscript.push(segment);
  if (currentTranscript.length > 200) currentTranscript = currentTranscript.slice(-200);
  send('transcript-update', currentTranscript);
}

function buildQuestionContext(): string {
  const recent = currentTranscript.slice(-12).map((s) => `${s.speaker}: ${s.text}`).join('\n');
  return recent;
}

async function resolveImages(extra?: string[]): Promise<string[]> {
  const shots = [...screenshots, ...(extra || [])];
  return shots.slice(-3);
}

async function handleAsk(request: AskRequest): Promise<{ ok: boolean; error?: string; code?: string }> {
  const settings = currentSettings();
  const modelId = settings.selectedModel;
  if (!modelId) {
    return {
      ok: false,
      error: 'No AI model configured. Open Settings → API.',
      code: 'NO_MODEL',
    };
  }

  let prompt = request.question?.trim() || '';

  if (request.mode === 'answer') {
    const context = buildQuestionContext();
    if (!context && !prompt) {
      return {
        ok: false,
        error: 'No interview audio captured yet. Start listening first.',
        code: 'NO_CONTEXT',
      };
    }
    prompt = [
      'A question was just asked in a live interview. Give the candidate a strong, ready-to-speak answer.',
      context ? `Conversation so far:\n${context}` : '',
      prompt ? `Additional instruction: ${prompt}` : '',
      'Answer directly. No preamble, no "the candidate should". Use short paragraphs or bullets.',
    ]
      .filter(Boolean)
      .join('\n\n');
  } else if (request.mode === 'screen') {
    const context = buildQuestionContext();
    prompt = [
      'Analyse the attached screenshot of the interview and answer the question shown or asked.',
      context ? `Conversation so far:\n${context}` : '',
      prompt ? `Question: ${prompt}` : '',
      'Give a concise, complete answer the candidate can read out loud.',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  const images = request.mode === 'screen' ? await resolveImages(request.images) : [];

  // Never let a stalled provider leave the UI stuck in a "streaming" state.
  let settled = false;
  const watchdog = setTimeout(() => {
    if (settled) return;
    settled = true;
    send('ai-response-error', { id: request.id, error: 'The model did not respond in time.' });
  }, 120_000);

  try {
    const onChunk = (chunk: string) => {
      if (!settled) send('ai-response-chunk', { id: request.id, chunk });
    };

    if (images.length > 0) {
      await aiProviderManager.generateResponseStreamWithVision(
        prompt,
        modelId,
        images[images.length - 1],
        onChunk,
      );
    } else {
      await aiProviderManager.generateResponseStream(prompt, modelId, onChunk);
    }

    clearTimeout(watchdog);
    settled = true;
    send('ai-response-end', { id: request.id });
    return { ok: true };
  } catch (error) {
    clearTimeout(watchdog);
    settled = true;
    const message = sanitizeProviderMessage(error instanceof Error ? error.message : String(error));
    console.error('[Main] ask failed:', message);
    send('ai-response-error', { id: request.id, error: message });
    return { ok: false, error: message, code: 'PROVIDER_ERROR' };
  }
}

// ---------------------------------------------------------------------------
// Screenshots
// ---------------------------------------------------------------------------
async function captureScreen(): Promise<string | null> {
  const display = screen.getPrimaryDisplay();
  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / (display.size.width * display.scaleFactor));
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(display.size.width * display.scaleFactor * scale),
      height: Math.round(display.size.height * display.scaleFactor * scale),
    },
  });
  const source = sources.find((s) => s.display_id === String(display.id)) || sources[0];
  if (!source || source.thumbnail.isEmpty()) return null;
  const dataUrl = source.thumbnail.toDataURL();
  screenshots.push(dataUrl);
  if (screenshots.length > 5) screenshots = screenshots.slice(-5);
  send('screenshots-update', screenshots);
  return dataUrl;
}

// ---------------------------------------------------------------------------
// Shortcuts
// ---------------------------------------------------------------------------
function registerShortcuts() {
  const bind = (accelerator: string, handler: () => void) => {
    try {
      const ok = globalShortcut.register(accelerator, handler);
      if (!ok) console.warn('[Main] shortcut unavailable:', accelerator);
    } catch (err) {
      console.warn('[Main] shortcut error', accelerator, err);
    }
  };

  bind('CommandOrControl+Enter', () => command({ type: 'answer' }));
  bind('CommandOrControl+Shift+Enter', () => command({ type: 'analyse-screen' }));
  bind('CommandOrControl+Alt+Enter', () => command({ type: 'open-chat' }));
  bind('CommandOrControl+R', () => command({ type: 'reset-context' }));
  bind('CommandOrControl+H', () => {
    void captureScreen();
  });
  bind('CommandOrControl+Delete', async () => {
    screenshots.pop();
    send('screenshots-update', screenshots);
  });
  bind('CommandOrControl+\\', () => toggleVisibility());
  bind('CommandOrControl+Q', () => {
    lastQuitAt = Date.now();
    app.quit();
  });
  bind('CommandOrControl+Shift+Alt+O', () => {
    if (!lastQuitAt || Date.now() - lastQuitAt < 30 * 60 * 1000) {
      showWindow();
    }
  });
  bind('CommandOrControl+Shift+Up', () => command({ type: 'scroll', direction: 'up' }));
  bind('CommandOrControl+Shift+Down', () => command({ type: 'scroll', direction: 'down' }));
  bind('CommandOrControl+Shift+Left', () => command({ type: 'scroll', direction: 'left' }));
  bind('CommandOrControl+Shift+Right', () => command({ type: 'scroll', direction: 'right' }));
  bind('CommandOrControl+Left', () => command({ type: 'move', delta: -40 }));
  bind('CommandOrControl+Right', () => command({ type: 'move', delta: 40 }));
  bind('CommandOrControl+[', () => command({ type: 'opacity', delta: -0.05 }));
  bind('CommandOrControl+]', () => command({ type: 'opacity', delta: 0.05 }));
  bind('CommandOrControl+Shift+L', () => command({ type: 'toggle-listening' }));
}

function showWindow() {
  if (!mainWindow) return;
  if (!mainWindow.isVisible()) mainWindow.showInactive();
  applyStealth();
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
function setupIPC() {
  ipcMain.handle('get-settings', () => currentSettings());

  ipcMain.handle('update-settings', (_event, partial: Partial<Settings>) => {
    settingsManager.updateSettings(partial);
    const settings = currentSettings();

    whisperTranscriber.updateSettings(settings);
    aiProviderManager.updateSettings(settings);
    contextManager.updateSettings(settings);

    if (partial.windowOpacity !== undefined || partial.alwaysOnTop !== undefined || partial.undetectableMode !== undefined || partial.invisibleOnScreenShare !== undefined) {
      applyStealth();
    }

    send('settings-update', settings);
    return settings;
  });

  ipcMain.handle('get-available-models', () => aiProviderManager.getAvailableModels());

  ipcMain.handle('add-custom-model', (_event, model: AIModel) => {
    settingsManager.addCustomModel(model);
    aiProviderManager.updateSettings(currentSettings());
    send('settings-update', currentSettings());
  });

  ipcMain.handle('remove-custom-model', (_event, modelId: string) => {
    settingsManager.removeCustomModel(modelId);
    aiProviderManager.updateSettings(currentSettings());
    send('settings-update', currentSettings());
  });

  ipcMain.handle('test-model', async (_event, { modelId, prompt }: { modelId: string; prompt: string }) => {
    try {
      const res = await aiProviderManager.testModel(modelId, prompt || 'Reply with exactly: OK');
      return { success: true, response: res.text };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('test-transcription', async () => {
    try {
      return await whisperTranscriber.testApiConnection();
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Audio ---------------------------------------------------------------
  ipcMain.handle('get-audio-devices', async () => {
    // Enumerated in the renderer with navigator.mediaDevices; here we only
    // report the loopback-capable screen source.
    return [];
  });

  ipcMain.handle('get-loopback-source', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    const primary = sources[0];
    return primary ? { id: primary.id, name: primary.name } : null;
  });

  ipcMain.on('audio-chunk', (_event, pcm: ArrayBuffer) => {
    if (!isListening) return;
    void whisperTranscriber.processAudio(Buffer.from(pcm));
  });

  ipcMain.handle('start-listening', async () => {
    try {
      await whisperTranscriber.initialize();
      isListening = true;
      listeningStartedAt = Date.now();
      send('ui-command', { type: 'listening', active: true });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast(`Transcription unavailable: ${message}`, 'error');
      return { success: false, error: message };
    }
  });

  ipcMain.handle('stop-listening', () => {
    isListening = false;
    send('ui-command', { type: 'listening', active: false });
  });

  // AI ------------------------------------------------------------------
  ipcMain.handle('ask', async (_event, request: AskRequest) => {
    return handleAsk(request);
  });

  ipcMain.on('cancel-ask', () => {
    whisperTranscriber; // no-op placeholder; streaming cannot be aborted mid-flight
  });

  // Screenshots ---------------------------------------------------------
  ipcMain.handle('capture-screen', async () => {
    const shot = await captureScreen();
    if (!shot) toast('Screen capture failed', 'error');
    return shot;
  });

  ipcMain.handle('get-screenshots', () => screenshots);

  ipcMain.handle('delete-screenshot', () => {
    screenshots.pop();
    send('screenshots-update', screenshots);
  });

  // Window / UI ---------------------------------------------------------
  ipcMain.on('set-ignore-mouse', (_event, ignore: boolean) => {
    mainWindow?.setIgnoreMouseEvents(ignore, { forward: true });
  });

  ipcMain.on('set-opacity', (_event, value: number) => {
    const settings = currentSettings();
    const next = clamp(settings.windowOpacity + value, 0.2, 1);
    settingsManager.updateSettings({ windowOpacity: next });
    mainWindow?.setOpacity(next);
    send('settings-update', { windowOpacity: next });
  });

  ipcMain.on('move-x', (_event, delta: number) => {
    const settings = currentSettings();
    const next = clamp(settings.windowOffsetX + delta, -400, 400);
    settingsManager.updateSettings({ windowOffsetX: next });
    send('settings-update', { windowOffsetX: next });
  });

  ipcMain.on('toggle-dashboard', () => command({ type: 'toggle-dashboard' }));
  ipcMain.on('show-window', () => showWindow());
  ipcMain.on('hide-window', () => mainWindow?.hide());
  ipcMain.on('quit-app', () => app.quit());

  ipcMain.on('clear-transcript', () => {
    currentTranscript = [];
    screenshots = [];
    send('transcript-update', []);
    send('screenshots-update', []);
  });

  // Files ---------------------------------------------------------------
  ipcMain.handle('pick-file', async (_event, { kind }: { kind: 'resume' | 'job-description' }) => {
    const result = await dialog.showOpenDialog({
      title: kind === 'resume' ? 'Select resume' : 'Select job description',
      properties: ['openFile'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'docx', 'doc', 'txt', 'md'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('read-text-file', async (_event, filePath: string) => {
    try {
      if (filePath.toLowerCase().endsWith('.pdf')) {
        // pdf-parse v1 (pdfjs 1.10) works in Node; the v2 build needs DOM
        // globals (DOMMatrix/ImageData) that the main process does not have.
        const pdfParse = require('pdf-parse/lib/pdf-parse.js');
        const data = await pdfParse(fs.readFileSync(filePath));
        return String(data.text || '');
      }
      if (filePath.toLowerCase().endsWith('.docx')) {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        return String(result.value || '');
      }
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error('[Main] read-text-file failed:', error);
      return '';
    }
  });

  ipcMain.handle('get-app-version', () => app.getVersion());
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function initializeManagers() {
  settingsManager = new SettingsManager();
  const settings = settingsManager.getSettings();

  whisperTranscriber = new WhisperTranscriber(settings);
  whisperTranscriber.onTranscript = (segment) => {
    pushTranscript(segment);
    const latest = currentSettings();
    if (latest.autoTriggerAI && segment.isFinal && segment.speaker === 'interviewer') {
      const id = `ans_${Date.now()}`;
      void handleAsk({ id, mode: 'answer', question: '' });
    }
  };
  whisperTranscriber.onStatus = (status) => send('whisper-status', status);

  aiProviderManager = new AIProviderManager(settings);
  stealthManager = new StealthManager();
  contextManager = new ContextManager(settings);

  // Pick a usable model if the saved one is not available.
  const available = aiProviderManager.getAvailableModels();
  const saved = settingsManager.getSettings().selectedModel;
  const savedUsable = saved && available.some((m) => m.id === saved);
  if (!savedUsable) {
    const next = available[0]?.id ?? '';
    if (next !== saved) {
      settingsManager.updateSettings({ selectedModel: next });
      aiProviderManager.updateSettings(currentSettings());
    }
  }

  try {
    await whisperTranscriber.initialize();
  } catch (error) {
    console.error('[Main] Whisper init failed (will retry on listen):', error);
  }
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.interviewcopilot.app');
  await initializeManagers();
  createOverlayWindow();
  createTray();
  setupIPC();
  registerShortcuts();

  const settings = currentSettings();
  app.setLoginItemSettings({ openAtLogin: settings.autoStart });

  // Keep the overlay aligned with the primary display when it changes.
  screen.on('display-metrics-changed', () => {
    if (!mainWindow) return;
    const display = screen.getPrimaryDisplay();
    mainWindow.setBounds({ x: display.workArea.x, y: display.workArea.y, ...display.workAreaSize });
  });

  console.log('[Main] ready — overlay window created');
});

app.on('window-all-closed', () => {
  // Keep running in tray unless the user quits explicitly.
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('second-instance', () => {
  showWindow();
});
