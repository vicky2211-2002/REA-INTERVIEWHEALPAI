import React, { useState } from 'react';
import { ChevronDown, FileText, Sparkles } from 'lucide-react';
import { Settings } from '@shared/types';
import { Toggle } from './Keycap';

interface SettingsTabProps {
  settings: Settings;
  onUpdate: (partial: Partial<Settings>) => void;
  appVersion: string;
  onPickResume: () => Promise<void>;
  resumeLoading?: boolean;
}

const LANGUAGES = [
  'English (US)',
  'English (UK)',
  'Hindi',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Italian',
  'Russian',
  'Chinese (Simplified)',
  'Japanese',
  'Korean',
  'Arabic',
];

export function SettingsTab({ settings, onUpdate, appVersion, onPickResume, resumeLoading }: SettingsTabProps) {
  const [instructions, setInstructions] = useState(settings.instructions || '');

  return (
    <div className="space-y-4 px-6 pb-6 pt-5">
      {/* Undetectable mode */}
      <section className="section">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h3 className="text-[16px] font-semibold text-blue-500">Ultra Undetectable Mode</h3>
            <p className="mt-2 max-w-[760px] text-[14px] leading-relaxed text-gray-500">
              When ON, all mouse activity and text input on the app become completely undetectable and cannot be
              captured by any platforms.
            </p>
            <button
              type="button"
              onClick={() =>
                window.open('https://www.electronjs.org/docs/latest/api/browser-window#winsetcontentprotectionenable-macos-windows', '_blank')
              }
              className="mt-3 text-[13.5px] font-medium text-blue-500 hover:underline"
            >
              How this works →
            </button>
          </div>
          <Toggle
            checked={settings.undetectableMode}
            onChange={(next) => onUpdate({ undetectableMode: next, invisibleOnScreenShare: next })}
            label="Ultra undetectable mode"
          />
        </div>
      </section>

      {/* Output language */}
      <section className="section flex items-center justify-between gap-6">
        <div>
          <h3 className="text-[16px] font-semibold text-gray-900">Output Language</h3>
          <p className="mt-1 text-[14px] text-gray-500">Choose the language for AI responses.</p>
        </div>
        <div className="relative">
          <select
            value={settings.outputLanguage}
            onChange={(event) => onUpdate({ outputLanguage: event.target.value })}
            className="w-[260px] appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-9 text-[14px] text-gray-900 outline-none focus:border-emerald-400"
          >
            {LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </section>

      {/* Customization */}
      <section className="section">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 text-emerald-500" />
          <div>
            <h3 className="text-[16px] font-semibold text-gray-900">Customization</h3>
            <p className="mt-1 text-[14px] text-gray-500">
              Customize AI responses with your resume and custom instructions.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <span className="label-caps">Resume context</span>
          <button
            type="button"
            onClick={() => void onPickResume()}
            className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2.5 text-left text-[14px] text-gray-700 hover:border-gray-400"
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              {resumeLoading ? 'Reading resume…' : settings.resumeFileName || 'Select Resume'}
            </span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
          <p className="mt-2 text-[12.5px] text-gray-400">
            Select a resume to let AI provide personalized, context-aware answers tailored to your resume.
          </p>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <span className="label-caps mb-0">Instructions</span>
            <span className="text-[12px] tabular-nums text-gray-400">{instructions.length} / 2000</span>
          </div>
          <textarea
            value={instructions}
            maxLength={2000}
            onChange={(event) => {
              setInstructions(event.target.value);
              onUpdate({ instructions: event.target.value });
            }}
            placeholder="e.g. Keep answers concise. Focus on my React experience. Use bullet points."
            className="mt-2 h-[150px] w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2.5 text-[14px] text-gray-800 outline-none focus:border-emerald-400"
          />
          <p className="mt-2 text-[12.5px] text-gray-400">
            Define your preferred style or rules. <span className="font-medium text-gray-500">Auto-save enabled.</span>
          </p>
        </div>
      </section>

      {/* Version */}
      <section className="section flex items-center justify-between">
        <div>
          <h3 className="text-[16px] font-semibold text-gray-900">App version</h3>
          <p className="mt-1 text-[14px] text-gray-500">
            Current version: <span className="font-semibold text-gray-700">{appVersion}</span>
          </p>
        </div>
        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[13px] font-medium text-emerald-600">
          Installed
        </span>
      </section>
    </div>
  );
}
