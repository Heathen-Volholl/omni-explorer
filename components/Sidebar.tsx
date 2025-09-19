import React from 'react';
import {
  GDriveIcon,
  DropboxIcon,
  OneDriveIcon,
  FolderIcon,
  LocalFilesIcon,
  HardDriveIcon,
  CombinedIcon,
  SyncIcon,
  SelectiveSyncIcon,
  OfflineIcon,
  HistoryIcon
} from './Icons';

interface SidebarProps {
  type: 'local' | 'cloud';
  currentPath: string;
  onNavigate: (path: string) => void;
  className?: string;
  localShortcuts?: Array<{ name: string; path: string }>;
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  path: string;
  isActive: boolean;
  onNavigate?: (path: string) => void;
  onClick?: () => void;
  className?: string;
}> = ({ icon, label, path, isActive, onNavigate, onClick, className }) => {
  const activeClasses = 'bg-blue-100 text-blue-700 font-semibold';
  const inactiveClasses = 'hover:bg-slate-200 text-slate-600';

  return (
    <li
      className={`flex items-center space-x-3 px-3 py-2 rounded-md cursor-pointer transition-colors duration-150 ${
        isActive ? activeClasses : inactiveClasses
      } ${className ?? ''}`}
      onClick={onClick ? onClick : () => onNavigate?.(path)}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </li>
  );
};

const defaultLocalShortcuts: Array<{ name: string; path: string; icon: React.ReactNode }> = [
  { name: 'Desktop', path: 'local://Desktop/', icon: <FolderIcon className="w-5 h-5 text-yellow-500" /> },
  { name: 'Documents', path: 'local://Documents/', icon: <FolderIcon className="w-5 h-5 text-yellow-500" /> },
  { name: 'Downloads', path: 'local://Downloads/', icon: <FolderIcon className="w-5 h-5 text-yellow-500" /> },
  { name: 'Music', path: 'local://Music/', icon: <FolderIcon className="w-5 h-5 text-yellow-500" /> },
  { name: 'Pictures', path: 'local://Pictures/', icon: <FolderIcon className="w-5 h-5 text-yellow-500" /> },
  { name: 'Videos', path: 'local://Videos/', icon: <FolderIcon className="w-5 h-5 text-yellow-500" /> },
  { name: 'This PC', path: 'local://This PC/', icon: <LocalFilesIcon className="w-5 h-5 text-slate-600" /> }
];

const LocalNav: React.FC<{ currentPath: string; onNavigate: (path: string) => void; shortcuts?: Array<{ name: string; path: string }> }> = ({ currentPath, onNavigate, shortcuts }) => {
  const resolvedShortcuts = shortcuts && shortcuts.length > 0
    ? shortcuts.map((shortcut) => ({
        name: shortcut.name,
        path: shortcut.path,
        icon:
          shortcut.name === 'This PC'
            ? <LocalFilesIcon className="w-5 h-5 text-slate-600" />
            : <FolderIcon className="w-5 h-5 text-yellow-500" />
      }))
    : defaultLocalShortcuts;

  return (
    <div>
      <ul className="space-y-1">
        {resolvedShortcuts.map((shortcut) => (
          <NavItem
            key={shortcut.path}
            icon={shortcut.icon}
            label={shortcut.name}
            path={shortcut.path}
            isActive={currentPath.startsWith(shortcut.path)}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
      {resolvedShortcuts.some((shortcut) => shortcut.name === 'This PC') && (
        <div className="mt-3 pl-4">
          <h3 className="flex items-center space-x-3 px-3 py-2 text-sm font-semibold text-slate-800 cursor-default">
            <LocalFilesIcon className="w-5 h-5 text-slate-600" />
            <span>System Drives</span>
          </h3>
          <ul className="space-y-1 pl-1">
            <NavItem
              icon={<HardDriveIcon className="w-5 h-5 text-slate-500" />}
              label="Local Disk"
              path="local://This PC/"
              isActive={currentPath.startsWith('local://This PC/')}
              onNavigate={onNavigate}
            />
          </ul>
        </div>
      )}
    </div>
  );
};

const CloudNav: React.FC<Omit<SidebarProps, 'type' | 'className' | 'localShortcuts'>> = ({ currentPath, onNavigate }) => (
  <>
    <ul className="space-y-1">
      <NavItem
        icon={<CombinedIcon className="w-5 h-5 text-indigo-500" />}
        label="Combined"
        path="combined://"
        isActive={currentPath.startsWith('combined://')}
        onNavigate={onNavigate}
      />
      <hr className="my-3 border-slate-200" />
      <NavItem
        icon={<DropboxIcon className="w-5 h-5" />}
        label="Dropbox"
        path="dropbox://"
        isActive={currentPath.startsWith('dropbox://')}
        onNavigate={onNavigate}
      />
      <NavItem
        icon={<GDriveIcon className="w-5 h-5" />}
        label="Google Drive"
        path="gdrive://"
        isActive={currentPath.startsWith('gdrive://')}
        onNavigate={onNavigate}
      />
      <NavItem
        icon={<OneDriveIcon className="w-5 h-5" />}
        label="OneDrive"
        path="onedrive://"
        isActive={currentPath.startsWith('onedrive://')}
        onNavigate={onNavigate}
      />
    </ul>
  </>
);

const CloudFeatures: React.FC = () => (
  <div className="flex-shrink-0">
    <hr className="my-3 border-slate-200" />
    <ul className="space-y-2.5">
      <li className="flex items-center space-x-3 px-3 text-slate-500">
        <SyncIcon className="w-5 h-5 flex-shrink-0" />
        <div className="text-xs">
          <p className="font-semibold text-slate-600">Real-time Sync</p>
          <p>Bidirectional with conflict resolution.</p>
        </div>
      </li>
      <li className="flex items-center space-x-3 px-3 text-slate-500">
        <SelectiveSyncIcon className="w-5 h-5 flex-shrink-0" />
        <div className="text-xs">
          <p className="font-semibold text-slate-600">Selective Sync</p>
          <p>Save local storage space.</p>
        </div>
      </li>
      <li className="flex items-center space-x-3 px-3 text-slate-500">
        <OfflineIcon className="w-5 h-5 flex-shrink-0" />
        <div className="text-xs">
          <p className="font-semibold text-slate-600">Offline Access</p>
          <p>Syncs when reconnected.</p>
        </div>
      </li>
      <li className="flex items-center space-x-3 px-3 text-slate-500">
        <HistoryIcon className="w-5 h-5 flex-shrink-0" />
        <div className="text-xs">
          <p className="font-semibold text-slate-600">Version History</p>
          <p>File recovery options.</p>
        </div>
      </li>
    </ul>
  </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ type, currentPath, onNavigate, className, localShortcuts }) => {
  return (
    <aside className={`p-3 pt-4 flex flex-col h-full ${className ?? ''}`}>
      <nav className="flex flex-col flex-grow overflow-y-auto">
        <div className="flex-grow">
          {type === 'local' ? (
            <LocalNav currentPath={currentPath} onNavigate={onNavigate} shortcuts={localShortcuts} />
          ) : (
            <CloudNav currentPath={currentPath} onNavigate={onNavigate} />
          )}
        </div>
        {type === 'cloud' && <CloudFeatures />}
      </nav>
    </aside>
  );
};
