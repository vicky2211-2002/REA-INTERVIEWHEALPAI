import React from 'react';
import { ChevronDown, User } from 'lucide-react';
import { DashboardTab, Settings } from '@shared/types';
import { CommandsTab } from './CommandsTab';
import { SettingsTab } from './SettingsTab';
import { ApiTab } from './ApiTab';

interface DashboardProps {
  tab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  settings: Settings;
  onUpdate: (partial: Partial<Settings>) => void;
  appVersion: string;
  onClose: () => void;
  onAction: (action: 'answer' | 'screen' | 'chat' | 'reset') => void;
  onPickResume: () => Promise<void>;
  resumeLoading?: boolean;
}

const TABS: { id: DashboardTab; label: string }[] = [
  { id: 'commands', label: 'All Commands' },
  { id: 'settings', label: 'Settings' },
  { id: 'api', label: 'API' },
];

export function Dashboard({
  tab,
  onTabChange,
  settings,
  onUpdate,
  appVersion,
  onClose,
  onAction,
  onPickResume,
  resumeLoading,
}: DashboardProps) {
  return (
    <div data-ui className="card fade-in mt-2 w-[1240px] max-w-[calc(100vw-48px)] overflow-hidden">
      <header className="flex h-[62px] items-center justify-between border-b border-gray-200/80 pl-6 pr-5">
        <nav className="flex items-center gap-8">
          {TABS.map((item) => {
            const active = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`relative h-[62px] text-[15px] transition-colors ${
                  active ? 'font-medium text-emerald-500' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                {item.label}
                {active && <span className="absolute inset-x-0 bottom-0 h-[2.5px] rounded-full bg-emerald-400" />}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
            title="Account"
          >
            <User className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      <div className="max-h-[min(560px,calc(100vh-180px))] overflow-y-auto">
        {tab === 'commands' && <CommandsTab onAction={onAction} />}
        {tab === 'settings' && (
          <SettingsTab
            settings={settings}
            onUpdate={onUpdate}
            appVersion={appVersion}
            onPickResume={onPickResume}
            resumeLoading={resumeLoading}
          />
        )}
        {tab === 'api' && <ApiTab settings={settings} onUpdate={onUpdate} />}
      </div>

      <div className="flex h-10 items-center justify-center border-t border-gray-100">
        <button
          type="button"
          onClick={onClose}
          title="Click to close dashboard"
          className="grid h-7 w-9 place-items-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
