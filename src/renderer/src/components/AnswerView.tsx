import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, ChevronLeft, ChevronRight, Copy, Loader2, X } from 'lucide-react';

export interface AnswerEntry {
  id: string;
  mode: 'answer' | 'screen';
  text: string;
  streaming: boolean;
  error?: string;
}

interface AnswerViewProps {
  answers: AnswerEntry[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  scrollSignal: { direction: 'up' | 'down' | 'left' | 'right'; nonce: number } | null;
}

export function AnswerView({ answers, index, onIndexChange, onClose, scrollSignal }: AnswerViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);
  const answer = answers[index];

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !scrollSignal) return;

    if (scrollSignal.direction === 'up' || scrollSignal.direction === 'down') {
      const delta = scrollSignal.direction === 'down' ? 160 : -160;
      const atTop = element.scrollTop <= 0;
      const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 2;

      if ((scrollSignal.direction === 'up' && atTop && index > 0) || !element.scrollHeight) {
        onIndexChange(index - 1);
        return;
      }
      if (scrollSignal.direction === 'down' && atBottom && index < answers.length - 1) {
        onIndexChange(index + 1);
        return;
      }
      element.scrollBy({ top: delta, behavior: 'smooth' });
      return;
    }

    const horizontalDelta = scrollSignal.direction === 'right' ? 200 : -200;
    element.scrollBy({ left: horizontalDelta, behavior: 'smooth' });
  }, [scrollSignal]);

  if (!answer) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(answer.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div data-ui className="card fade-in mt-2 flex w-[980px] max-w-[calc(100vw-48px)] flex-col overflow-hidden">
      <header className="flex h-12 items-center justify-between border-b border-gray-100 px-5">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold text-gray-900">
            {answer.mode === 'screen' ? 'Screen Answer' : 'Answer'}
          </span>
          {answer.streaming && <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />}
          {answers.length > 1 && (
            <span className="flex items-center gap-1 text-[11.5px] text-gray-400">
              <button
                type="button"
                onClick={() => onIndexChange(Math.max(0, index - 1))}
                disabled={index === 0}
                className="grid h-5 w-5 place-items-center rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {index + 1} / {answers.length}
              <button
                type="button"
                onClick={() => onIndexChange(Math.min(answers.length - 1, index + 1))}
                disabled={index === answers.length - 1}
                className="grid h-5 w-5 place-items-center rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void copy()}
            data-tip="Copy answer"
            className="tip grid h-7 w-7 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            data-tip="Close"
            className="tip grid h-7 w-7 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="md max-h-[min(520px,calc(100vh-210px))] overflow-auto px-6 py-5 text-[14px] leading-relaxed text-gray-800"
      >
        {answer.error ? (
          <p className="italic text-gray-500">{answer.error}</p>
        ) : (
          <div className={answer.streaming ? 'caret' : ''}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer.text || ' '}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
