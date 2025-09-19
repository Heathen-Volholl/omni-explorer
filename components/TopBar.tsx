import React from 'react';
import { SettingsIcon, AnalyticsIcon, SyncIcon } from './Icons';
import type { SyncStatus } from '../types';

interface TopBarProps {
  onSettingsClick: () => void;
  onAnalyzeStorage: () => void;
  onSyncNow: () => void;
  syncStatus: SyncStatus;
}

const TopBarButton: React.FC<{ onClick: () => void, children: React.ReactNode, 'aria-label': string }> = ({ onClick, children, 'aria-label': ariaLabel }) => (
    <button
        onClick={onClick}
        aria-label={ariaLabel}
        className="flex items-center space-x-2 px-3 py-2 text-slate-200 rounded-md hover:bg-slate-600 transition-colors"
    >
        {children}
    </button>
);

const SyncSummary: React.FC<{ status: SyncStatus; onSyncNow: () => void }> = ({ status, onSyncNow }) => {
  const lastSyncLabel = status.lastSyncedAt ? status.lastSyncedAt.toLocaleTimeString() : 'Never';
  const statusLabel = status.state === 'syncing' ? 'Syncing...' : status.message ?? 'Idle';

  return (
    <div className="flex items-center space-x-3 text-xs text-slate-200">
      <div className="flex flex-col leading-tight">
        <span className="font-semibold">Last sync: {lastSyncLabel}</span>
        <span className="text-slate-300">{statusLabel}</span>
      </div>
      <button
        onClick={onSyncNow}
        disabled={status.state === 'syncing'}
        className="flex items-center space-x-1 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-xs font-semibold rounded-md disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <SyncIcon className="w-4 h-4" />
        <span>{status.state === 'syncing' ? 'Synchronising...' : 'Sync now'}</span>
      </button>
    </div>
  );
};

export const TopBar: React.FC<TopBarProps> = ({ onSettingsClick, onAnalyzeStorage, onSyncNow, syncStatus }) => {
  return (
    <header className="flex-shrink-0 bg-slate-700 text-white h-14 flex items-center px-4 justify-between">
      <div className="flex items-center space-x-2">
        <TopBarButton onClick={onSettingsClick} aria-label="Open settings">
          <SettingsIcon className="w-5 h-5" />
          <span className="text-sm font-medium">Settings</span>
        </TopBarButton>
        <TopBarButton onClick={onAnalyzeStorage} aria-label="Analyze storage">
          <AnalyticsIcon className="w-5 h-5" />
          <span className="text-sm font-medium">Analyze Storage</span>
        </TopBarButton>
      </div>
      <SyncSummary status={syncStatus} onSyncNow={onSyncNow} />
    </header>
  );
};

