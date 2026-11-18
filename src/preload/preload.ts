import { contextBridge, ipcRenderer } from 'electron';
import type {
  AIModel,
  AIModelOption,
  AskRequest,
  AudioDevice,
  Settings,
  TranscriptSegment,
  UiCommand,
  WhisperStatus,
} from './types';

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api = {
  // Settings
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke('update-settings', settings),
  onSettingsUpdate: (cb: (settings: Partial<Settings>) => void) => subscribe('settings-update', cb),

  // Models
  getAvailableModels: (): Promise<AIModelOption[]> => ipcRenderer.invoke('get-available-models'),
  addCustomModel: (model: AIModel): Promise<void> => ipcRenderer.invoke('add-custom-model', model),
  removeCustomModel: (modelId: string): Promise<void> => ipcRenderer.invoke('remove-custom-model', modelId),
  testModel: (modelId: string, prompt: string) => ipcRenderer.invoke('test-model', { modelId, prompt }),

  // Audio
  getAudioDevices: (): Promise<AudioDevice[]> => ipcRenderer.invoke('get-audio-devices'),
  getLoopbackSource: () => ipcRenderer.invoke('get-loopback-source'),
  sendAudioChunk: (pcm: ArrayBuffer) => ipcRenderer.send('audio-chunk', pcm),
  startListening: () => ipcRenderer.invoke('start-listening'),
  stopListening: () => ipcRenderer.invoke('stop-listening'),
  onTranscript: (cb: (segments: TranscriptSegment[]) => void) => subscribe('transcript-update', cb),
  onAudioLevel: (cb: (level: number) => void) => subscribe('audio-level', cb),
  onWhisperStatus: (cb: (status: WhisperStatus) => void) => subscribe('whisper-status', cb),

  // AI
  ask: (request: AskRequest): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('ask', request),
  cancelAsk: () => ipcRenderer.send('cancel-ask'),
  onAnswerChunk: (cb: (p: { id: string; chunk: string }) => void) => subscribe('ai-response-chunk', cb),
  onAnswerEnd: (cb: (p: { id: string; tokensUsed?: number }) => void) => subscribe('ai-response-end', cb),
  onAnswerError: (cb: (p: { id: string; error: string }) => void) => subscribe('ai-response-error', cb),

  // Screenshots
  captureScreen: (): Promise<void> => ipcRenderer.invoke('capture-screen'),
  getScreenshots: (): Promise<string[]> => ipcRenderer.invoke('get-screenshots'),
  deleteLastScreenshot: (): Promise<void> => ipcRenderer.invoke('delete-screenshot'),
  onScreenshots: (cb: (shots: string[]) => void) => subscribe('screenshots-update', cb),

  // UI
  onUiCommand: (cb: (command: UiCommand) => void) => subscribe('ui-command', cb),
  onToast: (cb: (p: { message: string; kind?: 'info' | 'error' | 'success' }) => void) => subscribe('toast', cb),
  setIgnoreMouse: (ignore: boolean) => ipcRenderer.send('set-ignore-mouse', ignore),
  setOpacity: (opacity: number) => ipcRenderer.send('set-opacity', opacity),
  moveX: (delta: number) => ipcRenderer.send('move-x', delta),
  toggleDashboard: () => ipcRenderer.send('toggle-dashboard'),
  hideWindow: () => ipcRenderer.send('hide-window'),
  showWindow: () => ipcRenderer.send('show-window'),
  quitApp: () => ipcRenderer.send('quit-app'),
  clearTranscript: () => ipcRenderer.send('clear-transcript'),

  // Files
  pickFile: (kind: 'resume' | 'job-description'): Promise<string | null> => ipcRenderer.invoke('pick-file', { kind }),
  readTextFile: (filePath: string): Promise<string> => ipcRenderer.invoke('read-text-file', filePath),

  // Misc
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
};

contextBridge.exposeInMainWorld('electronAPI', api);
