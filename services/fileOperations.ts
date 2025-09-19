import type { FileItem } from '../types';
import { CloudService } from '../types';
import { resolveServiceFromPath } from './fileService';
import { copyLocalItems, deleteLocalItems } from './localFs';

class UnsupportedOperationError extends Error {}

function assertLocalOnly(files: FileItem[], destinationService?: CloudService) {
  const services = new Set(files.map((file) => file.service));
  if (destinationService !== undefined) {
    services.add(destinationService);
  }
  if (services.size !== 1 || !services.has(CloudService.LOCAL)) {
    throw new UnsupportedOperationError('Operation is only supported for local files at this time.');
  }
}

export async function copyItems(files: FileItem[], destinationPath: string): Promise<void> {
  const destinationService = resolveServiceFromPath(destinationPath);
  assertLocalOnly(files, destinationService);
  await copyLocalItems(
    files.map((file) => file.path),
    destinationPath,
    { move: false }
  );
}

export async function moveItems(files: FileItem[], destinationPath: string): Promise<void> {
  const destinationService = resolveServiceFromPath(destinationPath);
  assertLocalOnly(files, destinationService);
  await copyLocalItems(
    files.map((file) => file.path),
    destinationPath,
    { move: true }
  );
}

export async function deleteItems(files: FileItem[]): Promise<void> {
  assertLocalOnly(files);
  await deleteLocalItems(files.map((file) => file.path));
}

export { UnsupportedOperationError };
