// Shared types between main, preload, and renderer processes

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
  maxTokens?: number;
  temperature?: number;
}

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'nvidia' | 'custom';

export interface AIProviderConfig {
  name: string;
  models: AIModelOption[];
  requiresApiKey: boolean;
  baseUrl?: string;
}

export interface AIModelOption {
  id: string;
  name: string;
  description?: string;
  maxTokens?: number;
  supportsVision?: boolean;
}

export interface TranscriptionProfile {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface TranscriptSegment {
  id: string;
  speaker: 'interviewer' | 'candidate' | 'system';
  text: string;
  timestamp: number;
  confidence?: number;
  isFinal: boolean;
}

export interface AIResponse {
  id: string;
  question: string;
  answer: string;
  model: string;
  timestamp: number;
  tokensUsed?: number;
  isStreaming?: boolean;
  kind?: 'answer' | 'chat' | 'screen';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  error?: string;
}

export interface AudioDevice {
  name: string;
  isLoopback: boolean;
  isMicrophone: boolean;
}

export type DashboardTab = 'commands' | 'settings' | 'api';

export interface Settings {
  // General
  language: string;
  outputLanguage: string;
  theme: 'light' | 'dark' | 'system';
  autoStart: boolean;
  minimizeToTray: boolean;

  // Audio
  systemAudioEnabled: boolean;
  microphoneEnabled: boolean;
  audioDeviceId: string;
  microphoneDeviceId: string;
  sampleRate: number;

  // AI Models
  selectedModel: string;
  customModels: AIModel[];
  nvidiaApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  googleApiKey: string;
  customApiKey: string;
  customBaseUrl: string;
  temperature: number;
  maxTokens: number;
  autoTriggerAI: boolean;

  // Whisper
  whisperModel: 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';
  whisperLanguage: string;
  whisperDevice: 'cpu' | 'cuda' | 'auto';
  transcriptionProvider: 'local' | 'api';
  transcriptionApiBaseUrl: string;
  transcriptionApiKey: string;
  transcriptionApiModel: string;
  transcriptionProfiles: TranscriptionProfile[];
  selectedTranscriptionProfile: string;

  // Ultra Mode / Stealth
  ultraModeEnabled: boolean;
  undetectableMode: boolean;
  clickThroughEnabled: boolean;
  invisibleOnScreenShare: boolean;
  invisibleInTaskManager: boolean;
  hideFromAltTab: boolean;
  cursorUndetectability: boolean;

  // UI
  windowOpacity: number;
  windowOffsetX: number;
  windowSize: { width: number; height: number };
  windowPosition: { x: number; y: number };
  alwaysOnTop: boolean;

  // Shortcuts
  triggerShortcut: string;
  toggleListeningShortcut: string;
  toggleOverlayShortcut: string;

  // Context
  resumeText: string;
  resumeFileName: string;
  instructions: string;
  jobDescription: string;
  companyName: string;
}

export interface AppState {
  isListening: boolean;
  isProcessing: boolean;
  currentTranscript: TranscriptSegment[];
  aiResponses: AIResponse[];
  settings: Settings;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  error: string | null;
}

/** Payload for a single answer/chat request. */
export interface AskRequest {
  id: string;
  mode: 'answer' | 'chat' | 'screen';
  question: string;
  /** Extra screenshots (data URLs) to attach for vision models. */
  images?: string[];
}

export interface WhisperStatus {
  status: 'loading' | 'ready' | 'error' | 'transcribing';
  progress?: number;
  error?: string;
  model?: string;
}

export interface IPCChannels {
  // Main -> Renderer
  'transcript-update': TranscriptSegment[];
  'ai-response': AIResponse;
  'ai-response-chunk': { id: string; chunk: string };
  'ai-response-end': { id: string; tokensUsed?: number };
  'ai-response-error': { id: string; error: string };
  'ai-response-clear': void;
  'settings-update': Partial<Settings>;
  'status-update': { status: AppState['connectionStatus']; error?: string };
  'audio-level': number;
  'whisper-status': WhisperStatus;
  'available-models': AIModelOption[];
  'test-result': { modelId: string; success: boolean; response?: string; error?: string };
  'detection-event': { type: string; detail: string; timestamp: number };
  'ui-command': UiCommand;
  'screenshots-update': string[];
  'toast': { message: string; kind?: 'info' | 'error' | 'success' };

  // Renderer -> Main
  'start-listening': void;
  'stop-listening': void;
  'audio-chunk': ArrayBuffer;
  'trigger-ai': { question?: string; context?: string };
  'update-settings': Partial<Settings>;
  'get-settings': void;
  'get-available-models': void;
  'get-audio-devices': void;
  'add-custom-model': AIModel;
  'remove-custom-model': string;
  'test-model': { modelId: string; prompt: string };
  'test-transcription': void;
  'upload-resume': { filePath: string };
  'upload-job-description': { filePath: string };
  'pick-file': { kind: 'resume' | 'job-description' };
  'toggle-ultra-mode': boolean;
  'set-click-through': boolean;
  'set-ignore-mouse': boolean;
  'set-opacity': number;
  'move-x': number;
  'minimize-to-tray': void;
  'show-window': void;
  'hide-window': void;
  'toggle-dashboard': void;
  'quit-app': void;
  'clear-transcript': void;
  'capture-screen': void;
  'get-screenshots': void;
  'delete-screenshot': void;
  'delete-func': void;
  'ask': AskRequest;
  'cancel-ask': void;
  'get-loopback-source': void;
  'get-app-version': void;
  'read-text-file': string;
}

/** Commands pushed from main (global shortcuts / tray) to the renderer. */
export type UiCommand =
  | { type: 'toggle-dashboard' }
  | { type: 'open-chat' }
  | { type: 'close-chat' }
  | { type: 'answer' }
  | { type: 'analyse-screen' }
  | { type: 'reset-context' }
  | { type: 'scroll'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'opacity'; delta: number }
  | { type: 'move'; delta: number }
  | { type: 'listening'; active: boolean }
  | { type: 'toggle-listening' };

export interface ElectronAPI {
  // Settings
  getSettings: () => Promise<Settings>;
  updateSettings: (settings: Partial<Settings>) => Promise<Settings>;
  onSettingsUpdate: (callback: (settings: Partial<Settings>) => void) => () => void;

  // Models
  getAvailableModels: () => Promise<AIModelOption[]>;
  addCustomModel: (model: AIModel) => Promise<void>;
  removeCustomModel: (modelId: string) => Promise<void>;
  testModel: (modelId: string, prompt: string) => Promise<{ success: boolean; response?: string; error?: string }>;
  testTranscription: () => Promise<{ success: boolean; response?: string; error?: string }>;

  // Audio
  getAudioDevices: () => Promise<AudioDevice[]>;
  getLoopbackSource: () => Promise<{ id: string; name: string } | null>;
  sendAudioChunk: (pcm: ArrayBuffer) => void;
  startListening: () => Promise<{ success: boolean; error?: string }>;
  stopListening: () => Promise<void>;
  onTranscript: (callback: (segments: TranscriptSegment[]) => void) => () => void;
  onAudioLevel: (callback: (level: number) => void) => () => void;
  onWhisperStatus: (callback: (status: WhisperStatus) => void) => () => void;

  // AI
  ask: (request: AskRequest) => Promise<{ ok: boolean; error?: string }>;
  cancelAsk: () => void;
  onAnswerChunk: (callback: (payload: { id: string; chunk: string }) => void) => () => void;
  onAnswerEnd: (callback: (payload: { id: string; tokensUsed?: number }) => void) => () => void;
  onAnswerError: (callback: (payload: { id: string; error: string }) => void) => () => void;

  // Screenshots
  captureScreen: () => Promise<void>;
  getScreenshots: () => Promise<string[]>;
  deleteLastScreenshot: () => Promise<void>;
  onScreenshots: (callback: (shots: string[]) => void) => () => void;

  // UI
  onUiCommand: (callback: (command: UiCommand) => void) => () => void;
  onToast: (callback: (payload: { message: string; kind?: 'info' | 'error' | 'success' }) => void) => () => void;
  setIgnoreMouse: (ignore: boolean) => void;
  setOpacity: (opacity: number) => void;
  moveX: (delta: number) => void;
  toggleDashboard: () => void;
  hideWindow: () => void;
  showWindow: () => void;
  quitApp: () => void;
  clearTranscript: () => void;

  // Files
  pickFile: (kind: 'resume' | 'job-description') => Promise<string | null>;
  readTextFile: (filePath: string) => Promise<string>;

  // Misc
  getAppVersion: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
