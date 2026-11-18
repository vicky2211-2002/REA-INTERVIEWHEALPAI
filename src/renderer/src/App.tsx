import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChatMessage,
  DashboardTab,
  Settings,
  TranscriptSegment,
  UiCommand,
  WhisperStatus,
} from '@shared/types';
import { CommandBar } from './components/CommandBar';
import { Dashboard } from './components/Dashboard';
import { ChatPanel } from './components/ChatPanel';
import { AnswerEntry, AnswerView } from './components/AnswerView';
import { useAudioCapture } from './hooks/useAudioCapture';

type Toast = { message: string; kind?: 'info' | 'error' | 'success' };

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tab, setTab] = useState<DashboardTab>('commands');
  const [dashboardOpen, setDashboardOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [answers, setAnswers] = useState<AnswerEntry[]>([]);
  const [answerIndex, setAnswerIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [whisper, setWhisper] = useState<WhisperStatus | null>(null);
  const [scrollSignal, setScrollSignal] = useState<{ direction: 'up' | 'down' | 'left' | 'right'; nonce: number } | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [, setTranscript] = useState<TranscriptSegment[]>([]);

  const capture = useAudioCapture();
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((payload: Toast) => {
    setToast(payload);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  const update = useCallback(async (partial: Partial<Settings>) => {
    const next = await window.electronAPI.updateSettings(partial);
    setSettings(next);
  }, []);

  // ------------------------------------------------------------------ boot
  useEffect(() => {
    void window.electronAPI.getSettings().then(setSettings);
    void window.electronAPI.getAppVersion().then(setAppVersion).catch(() => undefined);

    // First run with nothing configured: point the user straight at the API tab.
    void window.electronAPI
      .getAvailableModels()
      .then((models) => {
        if (models.length === 0) setTab('api');
      })
      .catch(() => undefined);

    const offSettings = window.electronAPI.onSettingsUpdate((partial) =>
      setSettings((previous) => (previous ? { ...previous, ...partial } : previous)),
    );
    const offTranscript = window.electronAPI.onTranscript(setTranscript);
    const offWhisper = window.electronAPI.onWhisperStatus((status) => {
      setWhisper(status);
      if (status.status === 'error' && status.error) showToast({ message: status.error, kind: 'error' });
    });
    const offToast = window.electronAPI.onToast(showToast);
    const offShots = window.electronAPI.onScreenshots(() => undefined);

    return () => {
      offSettings();
      offTranscript();
      offWhisper();
      offToast();
      offShots();
    };
  }, [showToast]);

  // ------------------------------------------------------- click-through
  useEffect(() => {
    let ignoring = true;
    const onMove = (event: MouseEvent) => {
      const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      const interactive = Boolean(element?.closest('[data-ui]'));
      const shouldIgnore = !interactive;
      if (shouldIgnore !== ignoring) {
        ignoring = shouldIgnore;
        window.electronAPI.setIgnoreMouse(shouldIgnore);
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // ------------------------------------------------------------- timer
  useEffect(() => {
    if (!listening) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [listening]);

  // -------------------------------------------------------- ask / chat
  const runAnswer = useCallback(
    async (mode: 'answer' | 'screen') => {
      if (!settings) return;
      if (mode === 'screen') {
        await window.electronAPI.captureScreen().catch(() => undefined);
      }
      const id = `${mode}_${Date.now()}`;
      setAnswers((previous) => [...previous, { id, mode, text: '', streaming: true }]);
      setAnswerIndex(answers.length);
      setDashboardOpen(false);
      setChatOpen(false);
      setBusy(true);
      const result = await window.electronAPI.ask({ id, mode, question: '' });
      if (!result.ok) {
        if (result.code === 'NO_CONTEXT' || result.code === 'NO_MODEL') {
          // Preflight failure (no audio / no model) — not an interview error:
          // drop the just-created card and use a small neutral toast instead.
          setAnswers((previous) => previous.filter((entry) => entry.id !== id));
          setAnswerIndex(Math.max(0, answers.length - 1));
          showToast({
            message:
              result.code === 'NO_CONTEXT'
                ? 'No audio captured yet — start listening (Ctrl+Shift+L)'
                : 'No AI model configured — open Settings → API',
            kind: 'info',
          });
        } else {
          setAnswers((previous) =>
            previous.map((entry) =>
              entry.id === id ? { ...entry, streaming: false, error: result.error || 'Request failed' } : entry,
            ),
          );
        }
      }
      setBusy(false);
    },
    [answers.length, settings, showToast],
  );

  const sendChat = useCallback(
    async (text: string, useScreen: boolean) => {
      if (useScreen) await window.electronAPI.captureScreen().catch(() => undefined);
      const id = `chat_${Date.now()}`;
      const history = chat
        .slice(-6)
        .map((message) => `${message.role === 'user' ? 'Candidate' : 'Assistant'}: ${message.content}`)
        .join('\n');
      const prompt = history ? `Previous conversation:\n${history}\n\nCandidate: ${text}` : text;

      setChat((previous) => [
        ...previous,
        { id: `${id}_u`, role: 'user', content: text, timestamp: Date.now() },
        { id, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true },
      ]);
      setBusy(true);
      const result = await window.electronAPI.ask({
        id,
        mode: useScreen ? 'screen' : 'chat',
        question: prompt,
      });
      if (!result.ok) {
        setChat((previous) =>
          previous.map((message) =>
            message.id === id ? { ...message, isStreaming: false, error: result.error || 'Request failed' } : message,
          ),
        );
      }
      setBusy(false);
    },
    [chat],
  );

  // -------------------------------------------------- streaming handlers
  useEffect(() => {
    const offChunk = window.electronAPI.onAnswerChunk(({ id, chunk }) => {
      setAnswers((previous) =>
        previous.map((entry) => (entry.id === id ? { ...entry, text: entry.text + chunk } : entry)),
      );
      setChat((previous) =>
        previous.map((message) =>
          message.id === id ? { ...message, content: message.content + chunk } : message,
        ),
      );
    });

    const offEnd = window.electronAPI.onAnswerEnd(({ id }) => {
      setAnswers((previous) =>
        previous.map((entry) => (entry.id === id ? { ...entry, streaming: false } : entry)),
      );
      setChat((previous) =>
        previous.map((message) => (message.id === id ? { ...message, isStreaming: false } : message)),
      );
      setBusy(false);
    });

    const offError = window.electronAPI.onAnswerError(({ id, error }) => {
      setAnswers((previous) =>
        previous.map((entry) => (entry.id === id ? { ...entry, streaming: false, error } : entry)),
      );
      setChat((previous) =>
        previous.map((message) =>
          message.id === id ? { ...message, isStreaming: false, error } : message,
        ),
      );
      setBusy(false);
      showToast({ message: error, kind: 'error' });
    });

    return () => {
      offChunk();
      offEnd();
      offError();
    };
  }, [showToast]);

  // -------------------------------------------------------- listening
  const toggleListening = useCallback(async () => {
    if (!settings) return;
    if (listening) {
      await capture.stop();
      await window.electronAPI.stopListening();
      setListening(false);
      setLevel(0);
      return;
    }

    const started = await window.electronAPI.startListening();
    if (!started.success) {
      showToast({ message: started.error || 'Could not start transcription', kind: 'error' });
      return;
    }

    try {
      await capture.start({
        systemAudio: settings.systemAudioEnabled,
        microphone: settings.microphoneEnabled,
        micDeviceId: settings.microphoneDeviceId || undefined,
        onLevel: setLevel,
        onError: (message) => showToast({ message, kind: 'error' }),
      });
      setListening(true);
      setElapsed(0);
    } catch (error) {
      await window.electronAPI.stopListening();
      showToast({
        message: error instanceof Error ? error.message : 'Audio capture failed',
        kind: 'error',
      });
    }
  }, [capture, listening, settings, showToast]);

  const stopListening = useCallback(async () => {
    await capture.stop();
    await window.electronAPI.stopListening();
    setListening(false);
    setLevel(0);
  }, [capture]);

  // ---------------------------------------------------- ui commands
  useEffect(() => {
    const handler = (command: UiCommand) => {
      switch (command.type) {
        case 'toggle-dashboard':
          setDashboardOpen((open) => !open);
          break;
        case 'open-chat':
          setDashboardOpen(false);
          setChatOpen(true);
          break;
        case 'close-chat':
          setChatOpen(false);
          break;
        case 'answer':
          void runAnswer('answer');
          break;
        case 'analyse-screen':
          void runAnswer('screen');
          break;
        case 'reset-context':
          setAnswers([]);
          setChat([]);
          setChatOpen(false);
          window.electronAPI.clearTranscript();
          showToast({ message: 'Context cleared', kind: 'success' });
          break;
        case 'scroll':
          setScrollSignal({ direction: command.direction, nonce: Date.now() });
          break;
        case 'opacity':
          void update({ windowOpacity: Math.min(1, Math.max(0.2, (settings?.windowOpacity ?? 1) + command.delta)) });
          break;
        case 'move':
          window.electronAPI.moveX(command.delta);
          break;
        case 'listening':
          setListening(command.active);
          if (!command.active) setLevel(0);
          break;
        case 'toggle-listening':
          void toggleListening();
          break;
        default:
          break;
      }
    };

    return window.electronAPI.onUiCommand(handler);
  }, [runAnswer, settings?.windowOpacity, showToast, toggleListening, update]);

  // -------------------------------------------------------- resume pick
  const pickResume = useCallback(async () => {
    const filePath = await window.electronAPI.pickFile('resume');
    if (!filePath) return;
    setResumeLoading(true);
    try {
      const text = await window.electronAPI.readTextFile(filePath);
      const name = filePath.split(/[\\/]/).pop() || filePath;
      await update({ resumeText: text, resumeFileName: name });
      showToast({ message: `Resume loaded: ${name}`, kind: 'success' });
    } finally {
      setResumeLoading(false);
    }
  }, [showToast, update]);

  if (!settings) {
    return <div className="h-full w-full" />;
  }

  const showAnswer = !dashboardOpen && !chatOpen && answers.length > 0;

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ paddingLeft: settings.windowOffsetX }}>
      <div className="pointer-events-none flex h-full w-full flex-col items-center pt-3">
        <div className="pointer-events-auto">
          <CommandBar
            listening={listening}
            elapsed={formatElapsed(elapsed)}
            level={level}
            busy={busy}
            onToggleDashboard={() => setDashboardOpen((open) => !open)}
            onToggleVisibility={() => window.electronAPI.hideWindow()}
            onAnswer={() => void runAnswer('answer')}
            onAnalyseScreen={() => void runAnswer('screen')}
            onToggleChat={() => {
              setDashboardOpen(false);
              setChatOpen((open) => !open);
            }}
            onToggleListening={() => void toggleListening()}
          />
        </div>

        {chatOpen && (
          <div className="pointer-events-auto">
            <ChatPanel
              messages={chat}
              busy={busy}
              onSend={(text, useScreen) => void sendChat(text, useScreen)}
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}

        {dashboardOpen && (
          <div className="pointer-events-auto max-h-full">
            <Dashboard
              tab={tab}
              onTabChange={setTab}
              settings={settings}
              onUpdate={(partial) => void update(partial)}
              appVersion={appVersion}
              onClose={() => setDashboardOpen(false)}
              onAction={(action) => {
                if (action === 'answer') void runAnswer('answer');
                else if (action === 'screen') void runAnswer('screen');
                else if (action === 'chat') {
                  setDashboardOpen(false);
                  setChatOpen(true);
                } else {
                  setAnswers([]);
                  setChat([]);
                  window.electronAPI.clearTranscript();
                }
              }}
              onPickResume={pickResume}
              resumeLoading={resumeLoading}
            />
          </div>
        )}

        {showAnswer && (
          <div className="pointer-events-auto max-h-full">
            <AnswerView
              answers={answers}
              index={answerIndex}
              onIndexChange={setAnswerIndex}
              onClose={() => {
                setAnswers([]);
                setAnswerIndex(0);
              }}
              scrollSignal={scrollSignal}
            />
          </div>
        )}
      </div>

      {whisper?.status === 'loading' && listening && (
        <div className="pointer-events-none absolute right-4 top-3 rounded-full bg-black/70 px-3 py-1 text-[11px] text-white/80">
          Preparing transcription{whisper.progress ? ` ${whisper.progress}%` : '…'}
        </div>
      )}

      {toast && (
        <div
          data-ui
          className={`fade-in absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 text-[12.5px] shadow-lg ${
            toast.kind === 'error'
              ? 'bg-red-600 text-white'
              : toast.kind === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-900 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
