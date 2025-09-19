export type FileType = 'folder' | 'file' | 'document' | 'spreadsheet' | 'presentation' | 'image' | 'video' | 'archive' | 'audio' | 'pdf';

export enum CloudService {
  LOCAL = 'local',
  GDRIVE = 'gdrive',
  DROPBOX = 'dropbox',
  ONEDRIVE = 'onedrive',
  COMBINED = 'combined',
}

export interface FileItem {
  id: string;
  name: string;
  type: FileType;
  size: number | null; // null for folders
  modified: Date;
  path: string;
  service: CloudService;
  syncState?: 'inSync' | 'pending' | 'conflict' | 'error';
  latestRevisionId?: string;
}

export interface AppSettings {
  realtimeSync: boolean;
  conflictResolution: 'ask' | 'keep_newer' | 'keep_both';
  selectiveSync: boolean;
  offlineAccess: boolean;
  versionHistory: boolean;
  retentionPeriod: 30 | 60 | 90;
}

export type SortableColumn = 'name' | 'modified' | 'type' | 'size';

export interface StorageAnalysisData {
  totalSize: number;
  fileCount: number;
  folderCount: number;
  typeBreakdown: Record<string, { size: number; color: string; count: number }>;
  largestFiles: FileItem[];
}

export const fileTypeColors: Record<FileType | 'other', string> = {
  image: '#3b82f6', // text-blue-500
  video: '#8b5cf6', // text-purple-500
  document: '#0ea5e9', // text-sky-600
  spreadsheet: '#22c55e', // text-green-600
  presentation: '#f97316', // text-orange-600
  pdf: '#ef4444', // text-red-600
  archive: '#64748b', // text-gray-600
  audio: '#ec4899', // text-pink-500
  folder: '#eab308', // text-yellow-500
  file: '#64748b', // text-slate-500
  other: '#a1a1aa', // zinc-400
};

export interface FileRevision {
  id: string;
  fileId: string;
  version: string;
  createdAt: Date;
  size: number;
  source: 'local' | 'remote';
  note?: string;
}

export interface SyncConflict {
  id: string;
  path: string;
  service: CloudService | string;
  type: 'edit' | 'delete' | 'rename' | 'permission';
  detectedAt: Date;
  resolution?: 'use_local' | 'use_remote' | 'manual';
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'error';
  lastSyncedAt: Date | null;
  pendingOperations: number;
  conflicts: SyncConflict[];
  message?: string;
}
