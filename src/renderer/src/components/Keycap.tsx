import React from 'react';

const MODIFIER_CLASS = 'bg-[#6366f1] text-white shadow-[0_2px_0_rgba(0,0,0,0.18)]';
const KEY_CLASS = 'bg-[#111114] text-white shadow-[0_2px_0_rgba(0,0,0,0.28)]';
const MODIFIERS = new Set(['Ctrl', 'Shift', 'Alt', 'Cmd', '⌘']);

export function Keycap({ children }: { children: React.ReactNode }) {
  const value = String(children);
  const modifier = MODIFIERS.has(value);
  return (
    <span
      className={`inline-flex h-7 min-w-[1.9rem] items-center justify-center rounded-[6px] px-2 text-[11.5px] font-semibold ${modifier ? MODIFIER_CLASS : KEY_CLASS}`}
    >
      {children}
    </span>
  );
}

/** Renders a shortcut like "Ctrl+Shift+Enter" as individual keycaps. */
export function Shortcut({ keys }: { keys: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {keys.map((key, index) => (
        <React.Fragment key={`${key}-${index}`}>
          {index > 0 && <span className="text-[11px] text-gray-400">+</span>}
          <Keycap>{key}</Keycap>
        </React.Fragment>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-gray-300'}`}
    >
      <span
        className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[23px]' : 'left-[3px]'}`}
      />
    </button>
  );
}
