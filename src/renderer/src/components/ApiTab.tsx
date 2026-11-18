import React, { useEffect, useState } from 'react';
import { AIModel, AIModelOption, AudioDevice, Settings } from '@shared/types';

interface ApiTabProps {
  settings: Settings;
  onUpdate: (partial: Partial<Settings>) => void;
}

const WHISPER_MODELS: { id: Settings['whisperModel']; label: string }[] = [
  { id: 'tiny', label: 'Tiny — ~75 MB, fastest' },
  { id: 'base', label: 'Base — ~142 MB, recommended (bundled)' },
  { id: 'small', label: 'Small — ~466 MB' },
  { id: 'medium', label: 'Medium — ~1.5 GB' },
  { id: 'large-v3', label: 'Large v3 — ~3 GB, best accuracy' },
];

const LANGUAGES: { id: string; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'Hindi' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'pt', label: 'Portuguese' },
  { id: 'it', label: 'Italian' },
  { id: 'ru', label: 'Russian' },
  { id: 'zh', label: 'Chinese' },
  { id: 'ja', label: 'Japanese' },
  { id: 'ko', label: 'Korean' },
  { id: 'ar', label: 'Arabic' },
  { id: 'auto', label: 'Auto-detect' },
];

export function ApiTab({ settings, onUpdate }: ApiTabProps) {
  const [models, setModels] = useState<AIModelOption[]>([]);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [customBaseUrl, setCustomBaseUrl] = useState(settings.customBaseUrl || '');
  const [customKey, setCustomKey] = useState(settings.customApiKey || '');
  const [customModel, setCustomModel] = useState('');
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refreshModels = () => {
    window.electronAPI
      .getAvailableModels()
      .then(setModels)
      .catch(() => undefined);
  };

  const refreshDevices = () => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((list) =>
        setDevices(
          list
            .filter((device) => device.kind === 'audioinput')
            .map((device) => ({
              name: device.label || `Microphone ${device.deviceId.slice(0, 6)}`,
              isLoopback: /stereo mix|virtual|loopback|cable/i.test(device.label),
              isMicrophone: true,
            })),
        ),
      )
      .catch(() => undefined);
  };

  useEffect(() => {
    refreshModels();
    refreshDevices();
  }, []);

  const saveCustom = async () => {
    const baseUrl = customBaseUrl.trim();
    const apiKey = customKey.trim();
    const modelId = customModel.trim();
    if (!baseUrl || !modelId) {
      setStatus('Base URL and model name are required.');
      return;
    }

    const payload: AIModel = {
      id: editingId ?? modelId,
      name: modelId,
      provider: 'custom',
      model: modelId,
      apiKey,
      baseUrl,
      enabled: true,
    };

    try {
      await window.electronAPI.updateSettings({ customBaseUrl: baseUrl, customApiKey: apiKey });
      await window.electronAPI.addCustomModel(payload);
      if (editingId) {
        setStatus(`Saved ${modelId}`);
      } else {
        await window.electronAPI.updateSettings({ selectedModel: `custom:${modelId}` });
        setStatus(`Added and selected ${modelId}`);
      }
      setEditingId(null);
      refreshModels();
    } catch (error) {
      setStatus(`Failed — ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const startEditModel = (model: AIModel) => {
    setEditingId(model.id);
    setCustomBaseUrl(model.baseUrl || '');
    setCustomModel(model.model || '');
    setCustomKey(model.apiKey || '');
    setStatus(`Editing ${model.name}`);
  };

  const deleteModel = async (id: string) => {
    try {
      await window.electronAPI.removeCustomModel(id);
      if (editingId === id) setEditingId(null);
      setStatus('Deleted.');
      refreshModels();
    } catch (error) {
      setStatus(`Delete failed — ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCustomBaseUrl('');
    setCustomKey('');
    setCustomModel('');
    setStatus('');
  };

  const testModel = async () => {
    setTesting(true);
    setStatus('');
    try {
      const result = await window.electronAPI.testModel(settings.selectedModel, 'Reply with exactly: OK');
      setStatus(result.success ? `OK — ${String(result.response || '').slice(0, 100)}` : `Failed — ${result.error}`);
    } catch (error) {
      setStatus(`Failed — ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4 px-6 pb-6 pt-5">
      {/* Model */}
      <section className="section">
        <h3 className="text-[16px] font-semibold text-gray-900">AI Response Model</h3>
        <p className="mt-1 text-[14px] text-gray-500">The model used for answers, screen analysis and chat.</p>

        <div className="mt-4 flex items-center gap-3">
          <select
            value={settings.selectedModel}
            onChange={(event) => onUpdate({ selectedModel: event.target.value })}
            className="field max-w-[520px]"
          >
            {models.length === 0 && <option value="">No models yet — add an API key below</option>}
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} — {model.id}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void testModel()}
            disabled={testing || !settings.selectedModel}
            className="rounded-md bg-emerald-500 px-4 py-2 text-[13.5px] font-medium text-white disabled:opacity-50"
          >
            {testing ? 'Testing…' : 'Test'}
          </button>
        </div>
        {status && <p className="mt-2 break-words text-[12.5px] text-gray-500">{status}</p>}
      </section>

      {/* Custom API */}
      <section className="section">
        <h3 className="text-[16px] font-semibold text-gray-900">Custom API (OpenAI-compatible)</h3>
        <p className="mt-1 text-[14px] text-gray-500">
          Point the app at any <code className="rounded bg-gray-100 px-1">/v1/chat/completions</code> endpoint:
          OpenRouter, Groq, NVIDIA NIM, Ollama, LM Studio, LiteLLM, vLLM, your own server.
        </p>
        <div className="mt-4 grid gap-2">
          <input
            className="field"
            placeholder="Base URL — e.g. https://openrouter.ai/api/v1"
            value={customBaseUrl}
            onChange={(event) => setCustomBaseUrl(event.target.value)}
          />
          <input
            className="field"
            type="password"
            placeholder="API key"
            value={customKey}
            onChange={(event) => setCustomKey(event.target.value)}
          />
          <div className="flex gap-2">
            <input
              className="field"
              placeholder="Model name — e.g. google/gemini-2.0-flash-exp:free"
              value={customModel}
              onChange={(event) => setCustomModel(event.target.value)}
            />
            <button
              type="button"
              onClick={() => void saveCustom()}
              className="shrink-0 rounded-md bg-gray-900 px-4 py-2 text-[13.5px] font-medium text-white"
            >
              {editingId ? 'Save' : 'Add'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="shrink-0 rounded-md border border-gray-300 px-4 py-2 text-[13.5px] font-medium text-gray-700"
              >
                Cancel
              </button>
            )}
          </div>
          {editingId && (
            <div className="mt-1 text-[12px] text-indigo-600">Editing {customModel} — Save to update, Cancel to discard</div>
          )}

          {settings.customModels.length > 0 && (
            <div className="mt-4">
              <h4 className="text-[13px] font-medium text-gray-700">Saved Custom Models</h4>
              <ul className="mt-2 space-y-2">
                {settings.customModels.map((model) => (
                  <li key={model.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white p-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">{model.name}</div>
                      <div className="truncate text-[11px] text-gray-500">{model.model}</div>
                      <div className="truncate text-[10px] text-gray-400" title={model.baseUrl}>{model.baseUrl}</div>
                    </div>
                    <div className="flex shrink-0 gap-3">
                      <button type="button" onClick={() => startEditModel(model)} className="text-[12px] text-indigo-600 hover:underline">Edit</button>
                      <button type="button" onClick={() => deleteModel(model.id)} className="text-[12px] text-red-600 hover:underline">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Provider keys */}
      <section className="section">
        <h3 className="text-[16px] font-semibold text-gray-900">Provider API Keys</h3>
        <p className="mt-1 text-[14px] text-gray-500">Optional. Add whichever providers you already use.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(
            [
              ['openaiApiKey', 'OpenAI', 'sk-...'],
              ['anthropicApiKey', 'Anthropic', 'sk-ant-...'],
              ['googleApiKey', 'Google AI', 'AIza...'],
              ['nvidiaApiKey', 'NVIDIA NIM', 'nvapi-...'],
            ] as const
          ).map(([key, label, placeholder]) => (
            <div key={key}>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">{label}</label>
              <input
                type="password"
                className="field"
                placeholder={placeholder}
                value={(settings as unknown as Record<string, string>)[key] || ''}
                onChange={(event) => onUpdate({ [key]: event.target.value } as Partial<Settings>)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Transcription */}
      <section className="section">
        <h3 className="text-[16px] font-semibold text-gray-900">Transcription</h3>
        <p className="mt-1 text-[14px] text-gray-500">
          Runs locally with whisper.cpp. The Base model ships with the app; larger models download once on first use.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Whisper model</label>
            <select
              className="field"
              value={settings.whisperModel}
              onChange={(event) => onUpdate({ whisperModel: event.target.value as Settings['whisperModel'] })}
            >
              {WHISPER_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Spoken language</label>
            <select
              className="field"
              value={settings.whisperLanguage}
              onChange={(event) => onUpdate({ whisperLanguage: event.target.value })}
            >
              {LANGUAGES.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Audio */}
      <section className="section">
        <h3 className="text-[16px] font-semibold text-gray-900">Audio Sources</h3>
        <p className="mt-1 text-[14px] text-gray-500">
          System audio is captured with a loopback device, so Stereo Mix is not required.
        </p>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-3 text-[14px] text-gray-800">
            <input
              type="checkbox"
              checked={settings.systemAudioEnabled}
              onChange={(event) => onUpdate({ systemAudioEnabled: event.target.checked })}
              className="h-4 w-4 accent-emerald-500"
            />
            System audio (interviewer / call output)
          </label>
          <label className="flex items-center gap-3 text-[14px] text-gray-800">
            <input
              type="checkbox"
              checked={settings.microphoneEnabled}
              onChange={(event) => onUpdate({ microphoneEnabled: event.target.checked })}
              className="h-4 w-4 accent-emerald-500"
            />
            Microphone (your own voice)
          </label>

          {settings.microphoneEnabled && (
            <div className="flex items-center gap-2">
              <select
                className="field max-w-[420px]"
                value={settings.microphoneDeviceId}
                onChange={(event) => onUpdate({ microphoneDeviceId: event.target.value })}
              >
                <option value="">Default microphone</option>
                {devices.map((device) => (
                  <option key={device.name} value={device.name}>
                    {device.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={refreshDevices}
                className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-[13px] text-gray-700"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Behavior */}
      <section className="section">
        <h3 className="text-[16px] font-semibold text-gray-900">Behavior</h3>
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-3 text-[14px] text-gray-800">
            <input
              type="checkbox"
              checked={settings.autoTriggerAI}
              onChange={(event) => onUpdate({ autoTriggerAI: event.target.checked })}
              className="h-4 w-4 accent-emerald-500"
            />
            Auto-answer when a question is detected
          </label>
          <label className="flex items-center gap-3 text-[14px] text-gray-800">
            <input
              type="checkbox"
              checked={settings.alwaysOnTop}
              onChange={(event) => onUpdate({ alwaysOnTop: event.target.checked })}
              className="h-4 w-4 accent-emerald-500"
            />
            Always on top
          </label>
          <label className="flex items-center gap-3 text-[14px] text-gray-800">
            <input
              type="checkbox"
              checked={settings.autoStart}
              onChange={(event) => onUpdate({ autoStart: event.target.checked })}
              className="h-4 w-4 accent-emerald-500"
            />
            Start with Windows
          </label>
        </div>
      </section>
    </div>
  );
}
