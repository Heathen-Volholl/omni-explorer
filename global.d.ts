import type { FileItem, SyncStatus } from './types';

declare global {
  interface Window {
    electronAPI?: {
      filesystem: {
        listDirectory: (virtualPath: string) => Promise<ElectronFileEntry[]>;
        getLocalShortcuts: () => Promise<{ name: string; path: string }[]>;
        copyItems: (payload: ElectronCopyPayload) => Promise<ElectronOperationResult>;
        moveItems: (payload: ElectronCopyPayload) => Promise<ElectronOperationResult>;
        deleteItems: (payload: ElectronDeletePayload) => Promise<ElectronOperationResult>;
      };
      sync: {
        getStatus: () => Promise<ElectronSyncStatus>;
        trigger: () => Promise<ElectronSyncStatus>;
        subscribe: (callback: (status: ElectronSyncStatus) => void) => () => void;
      };
    };
  }

  interface ElectronFileEntry {
    id: string;
    name: string;
    type: FileItem['type'];
    size: number | null;
    modified: string;
    path: string;
    service: string;
  }

  interface ElectronSyncStatus {
    state: SyncStatus['state'];
    lastSyncedAt: string | null;
    pendingOperations: number;
    conflicts: Array<{
      id: string;
      path: string;
      service: string;
      type: string;
      detectedAt: string;
      resolution?: string;
    }>;
    message?: string;
  }

  interface ElectronCopyPayload {
    sources: string[];
    destination: string;
    move?: boolean;
  }

  interface ElectronDeletePayload {
    targets: string[];
  }

  interface ElectronOperationResult {
    success: boolean;
    items?: Array<{ source: string; destination: string }>;
  }
}

export {};
