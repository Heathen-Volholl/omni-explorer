import type { SyncStatus, SyncConflict } from '../types';

type ElectronSyncStatus = globalThis.ElectronSyncStatus;

function deserializeStatus(payload: ElectronSyncStatus | undefined): SyncStatus {
  if (!payload) {
    return {
      state: 'idle',
      lastSyncedAt: null,
      pendingOperations: 0,
      conflicts: [],
      message: 'Sync service unavailable'
    };
  }

  const conflicts: SyncConflict[] = payload.conflicts.map((conflict) => ({
    id: conflict.id,
    path: conflict.path,
    service: conflict.service,
    type: conflict.type as SyncConflict['type'],
    detectedAt: new Date(conflict.detectedAt),
    resolution: conflict.resolution as SyncConflict['resolution'] | undefined
  }));

  return {
    state: payload.state,
    lastSyncedAt: payload.lastSyncedAt ? new Date(payload.lastSyncedAt) : null,
    pendingOperations: payload.pendingOperations,
    conflicts,
    message: payload.message ?? undefined
  };
}

const fallbackStatus: SyncStatus = {
  state: 'idle',
  lastSyncedAt: null,
  pendingOperations: 0,
  conflicts: [],
  message: 'Sync controller not initialised'
};

export async function getSyncStatus(): Promise<SyncStatus> {
  if (!window.electronAPI?.sync) {
    return fallbackStatus;
  }
  const payload = await window.electronAPI.sync.getStatus();
  return deserializeStatus(payload);
}

export async function triggerSync(): Promise<SyncStatus> {
  if (!window.electronAPI?.sync) {
    return fallbackStatus;
  }
  const payload = await window.electronAPI.sync.trigger();
  return deserializeStatus(payload);
}

export function subscribeToSyncStatus(callback: (status: SyncStatus) => void): () => void {
  if (!window.electronAPI?.sync) {
    callback(fallbackStatus);
    return () => undefined;
  }
  const unsubscribe = window.electronAPI.sync.subscribe((payload) => {
    callback(deserializeStatus(payload));
  });
  return unsubscribe;
}


