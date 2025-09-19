import type { FileItem } from '../types';
import { CloudService } from '../types';
import { getCloudFilesByPath, getCloudRecursiveContents } from './cloudData';
import { getLocalDirectory, getLocalRecursiveContents } from './localFs';

export function resolveServiceFromPath(path: string): CloudService {
  const match = path.match(/^([a-z]+):\/\//i);
  if (!match) {
    return CloudService.LOCAL;
  }
  const protocol = match[1].toLowerCase();
  switch (protocol) {
    case 'local':
      return CloudService.LOCAL;
    case 'gdrive':
      return CloudService.GDRIVE;
    case 'dropbox':
      return CloudService.DROPBOX;
    case 'onedrive':
      return CloudService.ONEDRIVE;
    case 'combined':
      return CloudService.COMBINED;
    default:
      return CloudService.LOCAL;
  }
}

export async function getFilesByPath(path: string): Promise<FileItem[]> {
  const service = resolveServiceFromPath(path);
  if (service === CloudService.LOCAL) {
    return getLocalDirectory(path);
  }
  return getCloudFilesByPath(path);
}

export async function getRecursiveFolderContents(path: string): Promise<FileItem[]> {
  const service = resolveServiceFromPath(path);
  if (service === CloudService.LOCAL) {
    return getLocalRecursiveContents(path);
  }
  return getCloudRecursiveContents(path);
}

export async function getLocalNavigationShortcuts(): Promise<Array<{ name: string; path: string }>> {
  return getLocalRecursiveShortcuts();
}

async function getLocalRecursiveShortcuts() {
  const { getLocalShortcuts } = await import('./localFs');
  return getLocalShortcuts();
}
