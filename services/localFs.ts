// services/localFs.ts
// Electron-first local filesystem bridge with a minimal browser fallback.

import type { FileItem } from "../types";

export type FsEntry = {
  id: string;
  name: string;
  type: FileItem["type"];
  size: number | null;
  modified: string; // ISO
  path: string;     // virtual path e.g. local://Desktop/
  service: "local";
};

const hasElectron =
  typeof window !== "undefined" &&
  typeof (window as any).electronAPI?.filesystem?.listDirectory === "function";

export async function listDirectory(virtualPath: string): Promise<FsEntry[]> {
  if (hasElectron) {
    return await (window as any).electronAPI.filesystem.listDirectory(virtualPath);
  }
  // Browser fallback: return a tiny fake tree so UI doesn't explode in web mode.
  // You can expand this later or gate by NODE_ENV if preferred.
  const now = new Date().toISOString();
  if (virtualPath === "local://" || virtualPath === "local://") {
    return [
      { id: "dsk", name: "Desktop",   type: "folder", size: null, modified: now, path: "local://Desktop/",   service: "local" },
      { id: "doc", name: "Documents", type: "folder", size: null, modified: now, path: "local://Documents/", service: "local" },
      { id: "pc",  name: "This PC",   type: "folder", size: null, modified: now, path: "local://This PC/",   service: "local" }
    ];
  }
  // Simulate empty for other paths
  return [];
}

export async function getLocalShortcuts(): Promise<Array<{ name: string; path: string }>> {
  if (hasElectron) {
    return await (window as any).electronAPI.filesystem.getLocalShortcuts();
  }
  return [
    { name: "Desktop",   path: "local://Desktop/" },
    { name: "Documents", path: "local://Documents/" },
    { name: "This PC",   path: "local://This PC/" }
  ];
}
