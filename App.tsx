import React, { useState, useEffect, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { FileExplorer } from './components/FileExplorer';
import { Toast } from './components/Toast';
import { AuthModal } from './components/AuthModal';
import { SettingsPanel } from './components/SettingsPanel';
import { StorageAnalysisModal } from './components/StorageAnalysisModal';
import type { FileItem, CloudService, AppSettings, SortableColumn, SyncStatus } from './types';
import { CloudService as CloudServiceEnum } from './types';
import {
  getFilesByPath,
  getRecursiveFolderContents,
  getLocalNavigationShortcuts,
  resolveServiceFromPath
} from './services/fileService';
import {
  getSyncStatus,
  triggerSync,
  subscribeToSyncStatus
} from './services/syncClient';
import {
  copyItems as copyItemsToDestination,
  deleteItems as deleteItemsFromService,
  UnsupportedOperationError
} from './services/fileOperations';

interface PaneState {
  path: string;
  files: FileItem[];
  isLoading: boolean;
  selectedFiles: Set<string>;
  searchQuery: string;
  sortBy: SortableColumn;
  sortDirection: 'asc' | 'desc';
}

const initialPaneState = (path: string): PaneState => ({
  path,
  files: [],
  isLoading: true,
  selectedFiles: new Set(),
  searchQuery: '',
  sortBy: 'name',
  sortDirection: 'asc'
});

const initialSettings: AppSettings = {
  realtimeSync: true,
  conflictResolution: 'ask',
  selectiveSync: false,
  offlineAccess: true,
  versionHistory: true,
  retentionPeriod: 30
};

const fallbackLocalShortcuts = [
  { name: 'Desktop', path: 'local://Desktop/' },
  { name: 'Documents', path: 'local://Documents/' },
  { name: 'Downloads', path: 'local://Downloads/' },
  { name: 'Music', path: 'local://Music/' },
  { name: 'Pictures', path: 'local://Pictures/' },
  { name: 'Videos', path: 'local://Videos/' },
  { name: 'This PC', path: 'local://This PC/' }
];

const defaultSyncStatus: SyncStatus = {
  state: 'idle',
  lastSyncedAt: null,
  pendingOperations: 0,
  conflicts: [],
  message: 'Sync controller initialising'
};

const App: React.FC = () => {
  const [topPane, setTopPane] = useState<PaneState>(() => initialPaneState('local://Desktop/'));
  const [bottomPane, setBottomPane] = useState<PaneState>(() => initialPaneState('local://Documents/'));
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [clipboard, setClipboard] = useState<{
    files: FileItem[];
    operation: 'copy' | 'cut';
    service: CloudService;
  } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [analysisModal, setAnalysisModal] = useState<{ isOpen: boolean; path: string; name: string } | null>(null);
  const [localShortcuts, setLocalShortcuts] = useState<Array<{ name: string; path: string }>>(fallbackLocalShortcuts);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(defaultSyncStatus);

  const [authStatus, setAuthStatus] = useState<Record<Exclude<CloudService, CloudServiceEnum.LOCAL | CloudServiceEnum.COMBINED>, boolean>>({
    [CloudServiceEnum.DROPBOX]: false,
    [CloudServiceEnum.GDRIVE]: false,
    [CloudServiceEnum.ONEDRIVE]: false
  });

  const [authRequest, setAuthRequest] = useState<{
    service: Exclude<CloudService, CloudServiceEnum.LOCAL | CloudServiceEnum.COMBINED>;
    pendingPath: string;
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchFiles = useCallback(async (path: string, pane: 'top' | 'bottom') => {
    const setPane = pane === 'top' ? setTopPane : setBottomPane;
    setPane((prev) => ({ ...prev, isLoading: true, selectedFiles: new Set() }));

    try {
      const files = await getFilesByPath(path);
      setPane((prev) => ({ ...prev, files, path, searchQuery: '' }));
    } catch (error) {
      console.error(error);
      showToast('Failed to load files', 'error');
      setPane((prev) => ({ ...prev, files: [] }));
    } finally {
      setPane((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getLocalNavigationShortcuts()
      .then((shortcuts) => {
        if (!cancelled && shortcuts.length > 0) {
          setLocalShortcuts(shortcuts);
        }
      })
      .catch((error) => console.warn('Local shortcuts unavailable', error));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchFiles(topPane.path, 'top');
  }, [topPane.path, fetchFiles]);

  useEffect(() => {
    fetchFiles(bottomPane.path, 'bottom');
  }, [bottomPane.path, fetchFiles]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;

    getSyncStatus()
      .then((status) => {
        if (active) {
          setSyncStatus(status);
        }
      })
      .catch((error) => console.warn('Unable to get sync status', error));

    unsubscribe = subscribeToSyncStatus((status) => {
      setSyncStatus(status);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const handleNavigate = (pane: 'top' | 'bottom') => (path: string) => {
    const service = resolveServiceFromPath(path);
    const setPane = pane === 'top' ? setTopPane : setBottomPane;

    if (service !== CloudServiceEnum.LOCAL && service !== CloudServiceEnum.COMBINED && !authStatus[service]) {
      setAuthRequest({ service, pendingPath: path });
    } else {
      setPane((prev) => ({ ...prev, path }));
    }
  };

  const handleFileSelect = (pane: 'top' | 'bottom') => (fileId: string, ctrlKey: boolean, shiftKey: boolean) => {
    const setPane = pane === 'top' ? setTopPane : setBottomPane;
    setPane((prev) => {
      const selection = new Set(prev.selectedFiles);
      if (selection.has(fileId)) {
        selection.delete(fileId);
      } else {
        if (!ctrlKey && !shiftKey) {
          selection.clear();
        }
        selection.add(fileId);
      }
      return { ...prev, selectedFiles: selection };
    });
  };

  const handleCopy = (pane: 'top' | 'bottom') => () => {
    const paneState = pane === 'top' ? topPane : bottomPane;
    const service = resolveServiceFromPath(paneState.path);
    if (service !== CloudServiceEnum.LOCAL) {
      showToast('Copy for this service is not supported yet.', 'error');
      return;
    }
    if (paneState.selectedFiles.size === 0) return;
    const filesToCopy = paneState.files.filter((file) => paneState.selectedFiles.has(file.id));
    setClipboard({ files: filesToCopy, operation: 'copy', service });
    showToast(`${filesToCopy.length} item(s) copied.`);
  };

  const handlePaste = (pane: 'top' | 'bottom') => async () => {
    if (!clipboard) return;
    const targetPaneState = pane === 'top' ? topPane : bottomPane;
    const destinationService = resolveServiceFromPath(targetPaneState.path);

    if (destinationService !== clipboard.service) {
      showToast('Cross-service paste is not supported yet.', 'error');
      return;
    }

    const setPane = pane === 'top' ? setTopPane : setBottomPane;
    setPane((prev) => ({ ...prev, isLoading: true }));

    try {
      await copyItemsToDestination(clipboard.files, targetPaneState.path);
      showToast('Paste complete!', 'success');
      await fetchFiles(targetPaneState.path, pane);
    } catch (error) {
      console.error(error);
      const message = error instanceof UnsupportedOperationError ? error.message : 'Failed to paste items.';
      showToast(message, 'error');
    } finally {
      setPane((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleDrop = (pane: 'top' | 'bottom') => async (droppedFiles: FileItem[]) => {
    if (!droppedFiles || droppedFiles.length === 0) return;
    const targetPaneState = pane === 'top' ? topPane : bottomPane;
    const destinationService = resolveServiceFromPath(targetPaneState.path);
    const sourceServices = new Set(droppedFiles.map((file) => file.service));

    if (sourceServices.size !== 1 || destinationService !== [...sourceServices][0]) {
      showToast('Drag and drop across services is not supported yet.', 'error');
      return;
    }

    const setPane = pane === 'top' ? setTopPane : setBottomPane;
    setPane((prev) => ({ ...prev, isLoading: true }));

    try {
      await copyItemsToDestination(droppedFiles, targetPaneState.path);
      showToast('Copy complete!', 'success');
      await fetchFiles(targetPaneState.path, pane);
    } catch (error) {
      console.error(error);
      const message = error instanceof UnsupportedOperationError ? error.message : 'Failed to copy items.';
      showToast(message, 'error');
    } finally {
      setPane((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleDelete = (pane: 'top' | 'bottom') => async () => {
    const paneState = pane === 'top' ? topPane : bottomPane;
    if (paneState.selectedFiles.size === 0) return;

    const service = resolveServiceFromPath(paneState.path);
    if (service !== CloudServiceEnum.LOCAL) {
      showToast('Delete operations for this service are not supported yet.', 'error');
      return;
    }

    const filesToDelete = paneState.files.filter((file) => paneState.selectedFiles.has(file.id));
    const setPane = pane === 'top' ? setTopPane : setBottomPane;
    setPane((prev) => ({ ...prev, isLoading: true }));

    try {
      await deleteItemsFromService(filesToDelete);
      showToast('Delete complete!', 'success');
      await fetchFiles(paneState.path, pane);
    } catch (error) {
      console.error(error);
      const message = error instanceof UnsupportedOperationError ? error.message : 'Failed to delete items.';
      showToast(message, 'error');
    } finally {
      setPane((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleSearchChange = (pane: 'top' | 'bottom') => (query: string) => {
    const setPane = pane === 'top' ? setTopPane : setBottomPane;
    setPane((prev) => ({ ...prev, searchQuery: query }));
  };

  const handleSort = (pane: 'top' | 'bottom') => (column: SortableColumn) => {
    const setPane = pane === 'top' ? setTopPane : setBottomPane;
    setPane((prev) => {
      const direction = prev.sortBy === column && prev.sortDirection === 'asc' ? 'desc' : 'asc';
      return { ...prev, sortBy: column, sortDirection: direction };
    });
  };

  const handleAuthSuccess = (apiKey: string) => {
    if (!authRequest) return;
    console.log(`Authenticated ${authRequest.service} with key: ${apiKey}`);
    setAuthStatus((prev) => ({ ...prev, [authRequest.service]: true }));

    const serviceName = authRequest.service.charAt(0).toUpperCase() + authRequest.service.slice(1);
    showToast(`Successfully connected to ${serviceName}!`, 'success');

    handleNavigate('bottom')(authRequest.pendingPath);
    setAuthRequest(null);
  };

  const handleAuthModalClose = () => {
    setAuthRequest(null);
  };

  const handleSettingsToggle = () => {
    setIsSettingsOpen((prev) => !prev);
  };

  const handleSettingsChange = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleAnalyzeStorage = (pane: 'top' | 'bottom') => () => {
    const paneState = pane === 'top' ? topPane : bottomPane;
    const path = paneState.path;

    const pathParts = path.replace(/:\/\//, '/').split('/').filter(Boolean);
    const name = pathParts.pop() || 'Root';

    setAnalysisModal({ isOpen: true, path, name });
  };

  const handleConnectService = (service: Exclude<CloudService, CloudServiceEnum.LOCAL | CloudServiceEnum.COMBINED>) => {
    setIsSettingsOpen(false);
    const pendingPath = `${service}://`;
    setAuthRequest({ service, pendingPath });
  };

  const handleSyncNow = async () => {
    const status = await triggerSync();
    setSyncStatus(status);
  };

  const topService = resolveServiceFromPath(topPane.path);
  const bottomService = resolveServiceFromPath(bottomPane.path);
  const topPaneType = topService === CloudServiceEnum.LOCAL ? 'local' : 'cloud';
  const bottomPaneType = bottomService === CloudServiceEnum.LOCAL ? 'local' : 'cloud';

  const topSelectedFile = topPane.selectedFiles.size === 1
    ? topPane.files.find((f) => f.id === Array.from(topPane.selectedFiles)[0]) || null
    : null;

  const bottomSelectedFile = bottomPane.selectedFiles.size === 1
    ? bottomPane.files.find((f) => f.id === Array.from(bottomPane.selectedFiles)[0]) || null
    : null;

  return (
    <div className="h-screen w-screen bg-slate-100 text-slate-800 flex flex-col font-sans overflow-hidden">
      <TopBar
        onSettingsClick={handleSettingsToggle}
        onAnalyzeStorage={handleAnalyzeStorage('top')}
        onSyncNow={handleSyncNow}
        syncStatus={syncStatus}
      />
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        authStatus={authStatus}
        onConnectService={handleConnectService}
        syncStatus={syncStatus}
        onRequestSync={handleSyncNow}
      />
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex min-h-0 border-b border-slate-200">
          <Sidebar
            type={topPaneType}
            currentPath={topPane.path}
            onNavigate={handleNavigate('top')}
            className="w-64 bg-slate-50 border-r border-slate-200 flex-shrink-0"
            localShortcuts={localShortcuts}
          />
          <main className="flex-1 flex flex-col min-w-0">
            <FileExplorer
              paneType={topPaneType}
              path={topPane.path}
              files={topPane.files}
              isLoading={topPane.isLoading}
              selectedFiles={topPane.selectedFiles}
              clipboard={clipboard}
              searchQuery={topPane.searchQuery}
              sortBy={topPane.sortBy}
              sortDirection={topPane.sortDirection}
              selectedFile={topSelectedFile}
              selectionCount={topPane.selectedFiles.size}
              onNavigate={handleNavigate('top')}
              onFileSelect={handleFileSelect('top')}
              onCopy={handleCopy('top')}
              onPaste={handlePaste('top')}
              onDelete={handleDelete('top')}
              onSearchChange={handleSearchChange('top')}
              onRefresh={() => fetchFiles(topPane.path, 'top')}
              onDrop={handleDrop('top')}
              onSort={handleSort('top')}
            />
          </main>
        </div>

        <div className="flex-1 flex min-h-0">
          <Sidebar
            type={bottomPaneType}
            currentPath={bottomPane.path}
            onNavigate={handleNavigate('bottom')}
            className="w-64 bg-slate-50 border-r border-slate-200 flex-shrink-0"
            localShortcuts={localShortcuts}
          />
          <main className="flex-1 flex flex-col min-w-0">
            <FileExplorer
              paneType={bottomPaneType}
              path={bottomPane.path}
              files={bottomPane.files}
              isLoading={bottomPane.isLoading}
              selectedFiles={bottomPane.selectedFiles}
              clipboard={clipboard}
              searchQuery={bottomPane.searchQuery}
              sortBy={bottomPane.sortBy}
              sortDirection={bottomPane.sortDirection}
              selectedFile={bottomSelectedFile}
              selectionCount={bottomPane.selectedFiles.size}
              onNavigate={handleNavigate('bottom')}
              onFileSelect={handleFileSelect('bottom')}
              onCopy={handleCopy('bottom')}
              onPaste={handlePaste('bottom')}
              onDelete={handleDelete('bottom')}
              onSearchChange={handleSearchChange('bottom')}
              onRefresh={() => fetchFiles(bottomPane.path, 'bottom')}
              onDrop={handleDrop('bottom')}
              onSort={handleSort('bottom')}
            />
          </main>
        </div>
      </div>

      <StorageAnalysisModal
        isOpen={analysisModal?.isOpen || false}
        path={analysisModal?.path || ''}
        folderName={analysisModal?.name || ''}
        onClose={() => setAnalysisModal(null)}
      />
      <AuthModal
        isOpen={!!authRequest}
        service={authRequest?.service || null}
        onClose={handleAuthModalClose}
        onAuthenticate={handleAuthSuccess}
      />
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
};

export default App;
