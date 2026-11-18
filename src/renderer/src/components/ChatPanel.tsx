import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CornerDownLeft, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { ChatMessage } from '@shared/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  busy: boolean;
  onSend: (text: string, useScreen: boolean) => void;
  onClose: () => void;
}

export function ChatPanel({ messages, busy, onSend, onClose }: ChatPanelProps) {
  const [value, setValue] = useState('');
  const [useScreen, setUseScreen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const submit = () => {
    const text = value.trim();
    if (!text || busy) return;
    onSend(text, useScreen);
    setValue('');
  };

  return (
    <div data-ui className="fade-in mt-2 flex w-[960px] max-w-[calc(100vw-48px)] flex-col gap-2">
      {messages.length > 0 && (
        <div
          ref={scrollRef}
          className="chrome max-h-[min(420px,calc(100vh-260px))] overflow-y-auto rounded-xl px-5 py-4"
        >
          {messages.map((message) => (
            <div key={message.id} className="mb-4 last:mb-0">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                {message.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div
                className={`md md-dark text-[13.5px] leading-relaxed ${
                  message.role === 'user' ? 'text-white/70' : 'text-white/95'
                } ${message.isStreaming ? 'caret' : ''}`}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ' '}</ReactMarkdown>
              </div>
              {message.error && <div className="mt-1 text-[12px] text-red-400">{message.error}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="chrome flex items-center gap-3 rounded-xl px-4 py-2.5 shadow-[0_10px_35px_rgba(0,0,0,0.4)]">
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
            if (event.key === 'Escape') onClose();
          }}
          placeholder="Ask anything"
          className="max-h-24 flex-1 resize-none bg-transparent text-[14px] text-white placeholder-white/45 outline-none"
        />

        <button
          type="button"
          onClick={() => setUseScreen((previous) => !previous)}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] transition ${
            useScreen
              ? 'border-emerald-400/70 bg-emerald-400/15 text-emerald-300'
              : 'border-white/20 text-white/75 hover:bg-white/10'
          }`}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Use Screen
        </button>

        <button
          type="button"
          onClick={submit}
          disabled={busy || !value.trim()}
          className="shrink-0 text-[13px] font-medium text-white/90 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
        </button>

        <button
          type="button"
          data-tip="Close chat"
          onClick={onClose}
          className="tip grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center justify-end gap-1 text-[10.5px] text-white/35">
        <span>Enter to send</span>
        <CornerDownLeft className="h-3 w-3" />
      </div>
    </div>
  );
}
