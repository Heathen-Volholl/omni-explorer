import React from "react";
import type { SyncStatus } from "../types";

type Props = {
  syncStatus: SyncStatus;
  onSyncNow?: () => void;
};

export default function SettingsPanel({ syncStatus, onSyncNow }: Props) {
  const busy = syncStatus.state === "syncing";
  return (
    <section className="settings-panel">
      <h2>Settings</h2>

      <div className="card">
        <h3>Sync</h3>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Status:</strong>{" "}
          {busy ? "Synchronising…" : (syncStatus.message ?? syncStatus.state)}
        </p>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Pending:</strong> {syncStatus.pendingOperations}
        </p>
        <p style={{ margin: "0.25rem 0" }}>
          <strong>Last synced:</strong>{" "}
          {syncStatus.lastSyncedAt ? syncStatus.lastSyncedAt.toLocaleString() : "—"}
        </p>
        <button
          disabled={busy}
          onClick={onSyncNow}
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            border: "1px solid var(--line, #2b3a4a)",
            cursor: busy ? "not-allowed" : "pointer"
          }}
        >
          {busy ? "Syncing…" : "Sync now"}
        </button>
      </div>
import {
  CloseIcon,
  SettingsIcon,
  SyncIcon,
  SelectiveSyncIcon,
  OfflineIcon,
  HistoryIcon,
  CombinedIcon,
  CloudServiceIcon
} from './Icons';
import type { AppSettings, CloudService, SyncStatus } from '../types';
import { CloudService as CloudServiceEnum } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (newSettings: Partial<AppSettings>) => void;
  authStatus: Record<Exclude<CloudService, CloudServiceEnum.LOCAL | CloudServiceEnum.COMBINED>, boolean>;
  onConnectService: (service: Exclude<CloudService, CloudServiceEnum.LOCAL | CloudServiceEnum.COMBINED>) => void;
  syncStatus: SyncStatus;
  onRequestSync: () => void;
}

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void }> = ({ enabled, onChange }) => (
  <button
    type="button"
    className={`${enabled ? 'bg-blue-600' : 'bg-slate-300'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
    role="switch"
    aria-checked={enabled}
    onClick={() => onChange(!enabled)}
  >
    <span
      aria-hidden="true"
      className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
    />
  </button>
);

const SettingItem: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <div className="flex justify-between items-center py-4 border-b border-slate-200 last:border-b-0">
    <div>
      <p className="font-medium text-slate-800">{title}</p>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const SettingsSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="mb-8">
    <h3 className="flex items-center space-x-2 text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
      {icon}
      <span>{title}</span>
    </h3>
    <div className="bg-white rounded-md border border-slate-200 px-4">
      {children}
    </div>
  </div>
);

const serviceDisplayNames: Record<Exclude<CloudService, CloudServiceEnum.LOCAL | CloudServiceEnum.COMBINED>, string> = {
  [CloudServiceEnum.DROPBOX]: 'Dropbox',
  [CloudServiceEnum.GDRIVE]: 'Google Drive',
  [CloudServiceEnum.ONEDRIVE]: 'OneDrive'
};

const cloudServices: Exclude<CloudService, CloudServiceEnum.LOCAL | CloudServiceEnum.COMBINED>[] = [
  CloudServiceEnum.DROPBOX,
  CloudServiceEnum.GDRIVE,
  CloudServiceEnum.ONEDRIVE
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  authStatus,
  onConnectService,
  syncStatus,
  onRequestSync
}) => {
  const handleConfigureFolders = () => {
    alert('Folder selection UI will be added here.');
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`fixed top-0 left-0 h-full w-96 max-w-[90vw] bg-slate-100 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="flex flex-col h-full">
          <header className="flex items-center justify-between p-4 border-b border-slate-200 bg-white flex-shrink-0">
            <div className="flex items-center space-x-3">
              <SettingsIcon className="w-6 h-6 text-slate-600" />
              <h2 id="settings-title" className="text-lg font-semibold text-slate-800">
                Settings
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800"
              aria-label="Close settings panel"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </header>

          <div className="flex-grow p-6 overflow-y-auto">
            <SettingsSection title="Sync" icon={<SyncIcon className="w-4 h-4" />}>
              <SettingItem title="Real-time Sync" description="Bidirectional with conflict resolution.">
                <ToggleSwitch enabled={settings.realtimeSync} onChange={(val) => onSettingsChange({ realtimeSync: val })} />
              </SettingItem>
              <div className="py-3 text-xs text-slate-500 border-b border-slate-200">
                <div className="flex justify-between items-center">
                  <div>Last sync: {syncStatus.lastSyncedAt ? syncStatus.lastSyncedAt.toLocaleString() : 'Never'}</div>
                  <button
                    onClick={onRequestSync}
                    disabled={syncStatus.state === 'syncing'}
                    className="px-3 py-1 border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {syncStatus.state === 'syncing' ? 'Synchronising...' : 'Sync now'}
                  </button>
                </div>
                <div className="mt-1 text-slate-400">
                  {syncStatus.message ?? 'Idle'} (Pending: {syncStatus.pendingOperations})
                </div>
              </div>
            </SettingsSection>

            <SettingsSection title="Storage" icon={<SelectiveSyncIcon className="w-4 h-4" />}>
              <SettingItem title="Selective Sync" description="Save local storage space.">
                <ToggleSwitch enabled={settings.selectiveSync} onChange={(val) => onSettingsChange({ selectiveSync: val })} />
              </SettingItem>
              {settings.selectiveSync && (
                <div className="py-4 text-center border-b border-slate-200">
                  <button
                    onClick={handleConfigureFolders}
                    className="px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Configure Folders...
                  </button>
                </div>
              )}
              <SettingItem title="Offline Access" description="Syncs when reconnected.">
                <ToggleSwitch enabled={settings.offlineAccess} onChange={(val) => onSettingsChange({ offlineAccess: val })} />
              </SettingItem>
            </SettingsSection>

            <SettingsSection title="Data Management" icon={<HistoryIcon className="w-4 h-4" />}>
              <SettingItem title="Version History" description="File recovery options.">
                <ToggleSwitch enabled={settings.versionHistory} onChange={(val) => onSettingsChange({ versionHistory: val })} />
              </SettingItem>
              {settings.versionHistory && (
                <SettingItem title="File Retention Period" description="How long to keep old versions.">
                  <select
                    value={settings.retentionPeriod}
                    onChange={(e) => onSettingsChange({ retentionPeriod: parseInt(e.target.value, 10) as AppSettings['retentionPeriod'] })}
                    className="text-sm border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                    <option value="90">90 days</option>
                  </select>
                </SettingItem>
              )}
            </SettingsSection>

            <SettingsSection title="Cloud Connections" icon={<CombinedIcon className="w-4 h-4" />}>
              {cloudServices.map((service) => {
                const isConnected = authStatus[service];
                const serviceName = serviceDisplayNames[service];
                return (
                  <div key={service} className="flex justify-between items-center py-3 border-b border-slate-200 last:border-b-0">
                    <div className="flex items-center space-x-3">
                      <CloudServiceIcon service={service} className="w-5 h-5" />
                      <span className="font-medium text-slate-800">{serviceName}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-slate-400'}`} />
                        <span className="text-sm text-slate-500">{isConnected ? 'Connected' : 'Disconnected'}</span>
                      </div>
                      <button
                        onClick={() => onConnectService(service)}
                        className="px-3 py-1 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {isConnected ? 'Manage' : 'Connect'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </SettingsSection>
          </div>
        </div>
      </div>
    </>
  );
};
