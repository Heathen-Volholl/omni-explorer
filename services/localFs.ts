import type { FileItem } from '../types';
import { CloudService } from '../types';

type LocalShortcut = { name: string; path: string };

type ElectronFileEntry = {
  id: string;
  name: string;
  type: FileItem['type'];
  size: number | null;
  modified: string;
  path: string;
  service: string;
};

const fallbackFileSystem: Record<string, FileItem[]> = {
  'local://Desktop/': [
    { id: 'l4', name: 'shortcut.url', type: 'file', size: 102, modified: new Date('2024-04-12T09:30:00Z'), path: 'local://Desktop/shortcut.url', service: CloudService.LOCAL },
    { id: 'l5', name: 'work-project', type: 'folder', size: null, modified: new Date('2024-05-21T14:15:00Z'), path: 'local://Desktop/work-project/', service: CloudService.LOCAL }
  ],
  'local://Desktop/work-project/': [],
  'local://Documents/': [],
  'local://Downloads/': [],
  'local://Music/': [],
  'local://Pictures/': [],
  'local://Videos/': [],
  'local://This PC/': [
    { id: 'lpc1', name: 'Local Disk (C:)', type: 'folder', size: null, modified: new Date('2024-01-02T00:00:00Z'), path: 'local://This PC/Local Disk (C:)/', service: CloudService.LOCAL }
  ],
  'local://This PC/Local Disk (C:)/': [
    { id: 'lc1', name: 'Users', type: 'folder', size: null, modified: new Date('2024-01-02T00:00:00Z'), path: 'local://This PC/Local Disk (C:)/Users/', service: CloudService.LOCAL }
  ],
  'local://This PC/Local Disk (C:)/Users/': []
};

const fallbackShortcuts: LocalShortcut[] = [
  { name: 'Desktop', path: 'local://Desktop/' },
  { name: 'Documents', path: 'local://Documents/' },
  { name: 'Downloads', path: 'local://Downloads/' },
  { name: 'Music', path: 'local://Music/' },
  { name: 'Pictures', path: 'local://Pictures/' },
  { name: 'Videos', path: 'local://Videos/' },
  { name: 'This PC', path: 'local://This PC/' }
];

function isElectronReady(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.filesystem);
}

function toFileItem(entry: ElectronFileEntry): FileItem {
  return {
    id: entry.id,
    name: entry.name,
    type: entry.type,
    size: entry.size,
    modified: new Date(entry.modified),
    path: entry.path,
    service: CloudService.LOCAL,
    syncState: 'inSync'
  };
}

async function getFallbackDirectory(path: string): Promise<FileItem[]> {
  const items = fallbackFileSystem[path] || [];
  return [...items].sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function getLocalDirectory(path: string): Promise<FileItem[]> {
  if (isElectronReady()) {
    const entries = await window.electronAPI!.filesystem.listDirectory(path);
    return entries.map(toFileItem);
  }
  return getFallbackDirectory(path);
}

export async function getLocalRecursiveContents(path: string): Promise<FileItem[]> {
  if (isElectronReady()) {
    const results: FileItem[] = [];
    const queue: string[] = [path];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const entries = await getLocalDirectory(current);
      for (const entry of entries) {
        results.push(entry);
        if (entry.type === 'folder') {
          queue.push(entry.path);
        }
      }
    }

    return results;
  }

  const visited = new Set<string>();
  const queue: string[] = [path];
  const result: FileItem[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const items = await getFallbackDirectory(current);
    for (const item of items) {
      result.push(item);
      if (item.type === 'folder') {
        queue.push(item.path);
      }
    }
  }

  return result;
}

export async function getLocalShortcuts(): Promise<LocalShortcut[]> {
  if (isElectronReady()) {
    const shortcuts = await window.electronAPI!.filesystem.getLocalShortcuts();
    return shortcuts;
  }
  return fallbackShortcuts;
}

export async function copyLocalItems(sources: string[], destination: string, options: { move?: boolean } = {}): Promise<void> {
  if (!isElectronReady()) {
    throw new Error('Local filesystem operations are not available in this environment.');
  }
  await window.electronAPI!.filesystem.copyItems({ sources, destination, move: options.move ?? false });
}

export async function deleteLocalItems(targets: string[]): Promise<void> {
  if (!isElectronReady()) {
    throw new Error('Local filesystem operations are not available in this environment.');
  }
  await window.electronAPI!.filesystem.deleteItems({ targets });
}
