import Store from 'electron-store';
import { Settings, AIModel, AIProvider } from '@shared/types';
import * as path from 'path';

const DEFAULT_SETTINGS: Settings = {
  // General
  language: 'en',
  outputLanguage: 'English (US)',
  theme: 'system',
  autoStart: false,
  minimizeToTray: true,

  // Audio
  systemAudioEnabled: true,
  microphoneEnabled: false,
  audioDeviceId: '',
  microphoneDeviceId: '',
  sampleRate: 16000,

  // AI Models
  selectedModel: '',
  customModels: [],
  nvidiaApiKey: '',
  openaiApiKey: '',
  anthropicApiKey: '',
  googleApiKey: '',
  customApiKey: '',
  customBaseUrl: '',

  // AI Generation Settings
  temperature: 0.7,
  maxTokens: 2048,

  // Whisper
  whisperModel: 'base',
  whisperLanguage: 'en',
  whisperDevice: 'auto',
  // Transcription: local offline whisper.cpp by default; switch to 'api' to
  // send each audio chunk to an OpenAI-compatible speech-to-text endpoint.
  transcriptionProvider: 'local',
  transcriptionApiBaseUrl: '',
  transcriptionApiKey: '',
  transcriptionApiModel: 'whisper-1',

  // Ultra Mode / Stealth — defaults match reference app (invisible on screen share)
  ultraModeEnabled: true,
  undetectableMode: true,
  clickThroughEnabled: true,
  invisibleOnScreenShare: true,
  invisibleInTaskManager: false,
  hideFromAltTab: true,
  cursorUndetectability: false,

  // UI
  windowOpacity: 1,
  windowOffsetX: 0,
  windowSize: { width: 400, height: 600 },
  windowPosition: { x: 100, y: 100 },
  alwaysOnTop: true,

  // Shortcuts
  triggerShortcut: 'Ctrl+Enter',
  toggleListeningShortcut: 'Ctrl+Shift+L',
  toggleOverlayShortcut: 'Ctrl+\\',

  // Context
  resumeText: '',
  resumeFileName: '',
  instructions: '',
  jobDescription: '',
  companyName: '',

  // Auto-trigger AI on final transcript
  autoTriggerAI: false,
};

export class SettingsManager {
  private store: Store<Settings>;
  private settings: Settings;

  constructor() {
    this.store = new Store<Settings>({
      name: 'interview-copilot-settings',
      defaults: DEFAULT_SETTINGS,
      migrations: {
        '1.0.0': this.migrateSettings.bind(this),
      },
    });

    this.settings = this.store.store;

    // One-time migration: `large-v3` (3 GB) used to be the default. Move it to
    // the bundled `base` model once, so a deliberate choice afterwards sticks.
    const storeAny = this.store as any;
    if (storeAny.get('settingsVersion') !== 2) {
      if (this.settings.whisperModel === 'large-v3') {
        this.updateSettings({ whisperModel: 'base' });
        console.log('[Settings] migrated whisperModel large-v3 -> base');
      }
      storeAny.set('settingsVersion', 2);
      this.settings = this.store.store;
    }
  }

  private migrateSettings(oldSettings: any): Settings {
    // Handle migrations from older versions
    const migrated = { ...DEFAULT_SETTINGS, ...oldSettings };

    // Ensure all required fields exist
    if (!migrated.customModels) migrated.customModels = [];
    if (!migrated.windowSize) migrated.windowSize = DEFAULT_SETTINGS.windowSize;
    if (!migrated.windowPosition) migrated.windowPosition = DEFAULT_SETTINGS.windowPosition;

    return migrated;
  }

  load(): void {
    this.settings = this.store.store;
  }

  save(): void {
    // electron-store auto-saves, but we can force it
    this.store.store = this.settings;
  }

  getSettings(): Settings {
    return { ...this.settings };
  }

  updateSettings(partial: Partial<Settings>): void {
    this.settings = { ...this.settings, ...partial };
    this.store.store = this.settings;
  }

  // Custom model management
  addCustomModel(model: AIModel): void {
    const existingIndex = this.settings.customModels.findIndex(m => m.id === model.id);
    if (existingIndex >= 0) {
      this.settings.customModels[existingIndex] = model;
    } else {
      this.settings.customModels.push(model);
    }
    this.store.store = this.settings;
  }

  removeCustomModel(modelId: string): void {
    this.settings.customModels = this.settings.customModels.filter(m => m.id !== modelId);
    this.store.store = this.settings;
  }

  getCustomModels(): AIModel[] {
    return [...this.settings.customModels];
  }

  // API Key management
  setApiKey(provider: AIProvider, key: string): void {
    const keyMap: Record<AIProvider, string> = {
      openai: 'openaiApiKey',
      anthropic: 'anthropicApiKey',
      google: 'googleApiKey',
      nvidia: 'nvidiaApiKey',
      custom: 'customApiKey',
    };

    const settingKey = keyMap[provider];
    if (settingKey) {
      (this.settings as unknown as Record<string, string>)[settingKey] = key;
      this.store.store = this.settings;
    }
  }

  getApiKey(provider: AIProvider): string {
    const keyMap: Record<AIProvider, string> = {
      openai: 'openaiApiKey',
      anthropic: 'anthropicApiKey',
      google: 'googleApiKey',
      nvidia: 'nvidiaApiKey',
      custom: 'customApiKey',
    };

    const settingKey = keyMap[provider];
    return settingKey ? (this.settings as unknown as Record<string, string>)[settingKey] || '' : '';
  }

  // Reset to defaults
  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.store.store = this.settings;
  }

  // Export/Import settings
  exportSettings(): string {
    const exportData = { ...this.settings };
    // Remove sensitive data for export
    delete (exportData as any).openaiApiKey;
    delete (exportData as any).anthropicApiKey;
    delete (exportData as any).googleApiKey;
    delete (exportData as any).nvidiaApiKey;
    delete (exportData as any).customApiKey;
    delete (exportData as any).customModels; // Contains API keys

    return JSON.stringify(exportData, null, 2);
  }

  importSettings(jsonString: string): boolean {
    try {
      const imported = JSON.parse(jsonString);
      // Merge with current settings, preserving API keys
      const preservedKeys = [
        'openaiApiKey', 'anthropicApiKey', 'googleApiKey',
        'nvidiaApiKey', 'customApiKey', 'customModels'
      ];

      preservedKeys.forEach(key => {
        if (this.settings[key as keyof Settings]) {
          (imported as any)[key] = this.settings[key as keyof Settings];
        }
      });

      this.settings = { ...DEFAULT_SETTINGS, ...imported };
      this.store.store = this.settings;
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }

  // Get specific setting sections for UI
  getGeneralSettings() {
    return {
      language: this.settings.language,
      theme: this.settings.theme,
      autoStart: this.settings.autoStart,
      minimizeToTray: this.settings.minimizeToTray,
    };
  }

  getAudioSettings() {
    return {
      systemAudioEnabled: this.settings.systemAudioEnabled,
      microphoneEnabled: this.settings.microphoneEnabled,
      audioDeviceId: this.settings.audioDeviceId,
      microphoneDeviceId: this.settings.microphoneDeviceId,
      sampleRate: this.settings.sampleRate,
    };
  }

  getAISettings() {
    return {
      selectedModel: this.settings.selectedModel,
      customModels: this.settings.customModels,
      nvidiaApiKey: this.settings.nvidiaApiKey,
      openaiApiKey: this.settings.openaiApiKey,
      anthropicApiKey: this.settings.anthropicApiKey,
      googleApiKey: this.settings.googleApiKey,
      customApiKey: this.settings.customApiKey,
      customBaseUrl: this.settings.customBaseUrl,
      temperature: this.settings.temperature,
      maxTokens: this.settings.maxTokens,
      autoTriggerAI: this.settings.autoTriggerAI,
    };
  }

  getWhisperSettings() {
    return {
      whisperModel: this.settings.whisperModel,
      whisperLanguage: this.settings.whisperLanguage,
      whisperDevice: this.settings.whisperDevice,
      transcriptionProvider: this.settings.transcriptionProvider,
      transcriptionApiBaseUrl: this.settings.transcriptionApiBaseUrl,
      transcriptionApiModel: this.settings.transcriptionApiModel,
    };
  }

  getStealthSettings() {
    return {
      ultraModeEnabled: this.settings.ultraModeEnabled,
      clickThroughEnabled: this.settings.clickThroughEnabled,
      invisibleOnScreenShare: this.settings.invisibleOnScreenShare,
      invisibleInTaskManager: this.settings.invisibleInTaskManager,
      hideFromAltTab: this.settings.hideFromAltTab,
      cursorUndetectability: this.settings.cursorUndetectability,
    };
  }

  getUISettings() {
    return {
      windowOpacity: this.settings.windowOpacity,
      windowSize: this.settings.windowSize,
      windowPosition: this.settings.windowPosition,
      alwaysOnTop: this.settings.alwaysOnTop,
    };
  }

  getShortcutSettings() {
    return {
      triggerShortcut: this.settings.triggerShortcut,
      toggleListeningShortcut: this.settings.toggleListeningShortcut,
      toggleOverlayShortcut: this.settings.toggleOverlayShortcut,
    };
  }

  getContextSettings() {
    return {
      resumeText: this.settings.resumeText,
      jobDescription: this.settings.jobDescription,
      companyName: this.settings.companyName,
    };
  }
}