import React from 'react';
import { Mic, Shield } from 'lucide-react';

interface CommandBarProps {
  listening: boolean;
  elapsed: string;
  level: number;
  onToggleDashboard: () => void;
  onToggleVisibility: () => void;
  onAnswer: () => void;
  onAnalyseScreen: () => void;
  onToggleChat: () => void;
  onToggleListening: () => void;
  busy?: boolean;
}

export function CommandBar({
  listening,
  elapsed,
  level,
  onToggleDashboard,
  onToggleVisibility,
  onAnswer,
  onAnalyseScreen,
  onToggleChat,
  onToggleListening,
  busy,
}: CommandBarProps) {
  return (
    <div
      data-ui
      className="chrome fade-in pointer-events-auto flex items-center gap-1.5 rounded-full px-2 py-1.5 shadow-[0_10px_35px_rgba(0,0,0,0.45)]"
    >
      <button
        type="button"
        onClick={onToggleDashboard}
        data-tip="Click to open dashboard"
        className="tip grid h-[34px] w-[34px] place-items-center rounded-full bg-white text-[#0c0c0e] transition hover:bg-white/90"
      >
        <Shield className="h-[17px] w-[17px]" strokeWidth={2.2} />
      </button>

      <button type="button" onClick={onAnswer} className="chrome-btn" disabled={busy}>
        Answer
      </button>
      <button type="button" onClick={onAnalyseScreen} className="chrome-btn" disabled={busy}>
        Analyse Screen
      </button>
      <button type="button" onClick={onToggleChat} className="chrome-btn">
        Chat
      </button>
      <button type="button" onClick={onToggleVisibility} className="chrome-btn">
        Show/Hide
      </button>

      <span className="ml-1.5 min-w-[36px] text-center text-[11.5px] font-medium tabular-nums text-white/85">
        {elapsed}
      </span>

      <button
        type="button"
        onClick={onToggleListening}
        data-tip={listening ? 'Stop listening' : 'Start listening'}
        className={`tip relative ml-0.5 grid h-[26px] w-[26px] place-items-center rounded-full transition ${
          listening ? 'bg-red-500 text-white pulse-ring' : 'bg-white text-[#0c0c0e] hover:bg-white/90'
        }`}
      >
        <Mic className="h-[13px] w-[13px]" strokeWidth={2.6} />
        {listening && (
          <span
            className="absolute inset-0 rounded-full border border-white/50"
            style={{ transform: `scale(${1 + level * 0.5})`, opacity: 0.3 + level * 0.4 }}
          />
        )}
      </button>
    </div>
  );
}
