// services/syncBridge.ts
// Thin adapter from Electron preload → app types.

import type { SyncStatus } from "../types";

type ElectronSyncStatus = {
  state: SyncStatus["state"];
  lastSyncedAt: string | null; // ISO
  pendingOperations: number;
  conflicts: Array<{
    id: string;
    path: string;
    service: string;
    type: string;
    detectedAt: string; // ISO
    resolution?: string;
  }>;
  message?: string;
};

const hasElectron =
  typeof window !== "undefined" &&
  typeof (window as any).electronAPI?.sync?.getStatus === "function";

const isoOrNull = (s: string | null) => (s ? new Date(s) : null);

export async function getStatus(): Promise<SyncStatus> {
  if (!hasElectron) {
    return {
      state: "idle",
      lastSyncedAt: null,
      pendingOperations: 0,
      conflicts: [],
      message: "Local (web) mode — no sync"
    };
  }
  const raw = (await (window as any).electronAPI.sync.getStatus()) as ElectronSyncStatus;
  return {
    state: raw.state,
    lastSyncedAt: isoOrNull(raw.lastSyncedAt),
    pendingOperations: raw.pendingOperations,
    conflicts: raw.conflicts.map(c => ({
      ...c,
      detectedAt: new Date(c.detectedAt)
    })),
    message: raw.message
  };
}

export async function triggerSync(): Promise<SyncStatus> {
  if (!hasElectron) return getStatus();
  const raw = (await (window as any).electronAPI.sync.trigger()) as ElectronSyncStatus;
  return {
    state: raw.state,
    lastSyncedAt: isoOrNull(raw.lastSyncedAt),
    pendingOperations: raw.pendingOperations,
    conflicts: raw.conflicts.map(c => ({ ...c, detectedAt: new Date(c.detectedAt) })),
    message: raw.message
  };
}

export function subscribe(cb: (s: SyncStatus) => void): () => void {
  if (!hasElectron || typeof (window as any).electronAPI.sync.subscribe !== "function") {
    // No-op unsubscribe in web mode
    return () => {};
  }
  const off = (window as any).electronAPI.sync.subscribe((raw: ElectronSyncStatus) => {
    cb({
      state: raw.state,
      lastSyncedAt: isoOrNull(raw.lastSyncedAt),
      pendingOperations: raw.pendingOperations,
      conflicts: raw.conflicts.map(c => ({ ...c, detectedAt: new Date(c.detectedAt) })),
      message: raw.message
    });
  });
  return off;
}
