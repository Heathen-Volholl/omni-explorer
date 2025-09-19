import type { FileItem } from '../types';
import { CloudService } from '../types';

const CLOUD_DELAY = 200;

const cloudFileSystem: Record<string, FileItem[]> = {
  'gdrive://': [
    { id: 'g1', name: 'My Drive', type: 'folder', size: null, modified: new Date('2023-10-26T10:00:00Z'), path: 'gdrive://My Drive/', service: CloudService.GDRIVE },
    { id: 'g2', name: 'Shared with me', type: 'folder', size: null, modified: new Date('2023-10-25T11:00:00Z'), path: 'gdrive://Shared with me/', service: CloudService.GDRIVE }
  ],
  'gdrive://My Drive/': [
    { id: 'g3', name: 'Work', type: 'folder', size: null, modified: new Date('2023-09-15T14:30:00Z'), path: 'gdrive://My Drive/Work/', service: CloudService.GDRIVE },
    { id: 'g4', name: 'Project Proposal.docx', type: 'document', size: 123456, modified: new Date('2023-10-20T09:15:00Z'), path: 'gdrive://My Drive/Project Proposal.docx', service: CloudService.GDRIVE },
    { id: 'g5', name: 'Team Meeting.mp4', type: 'video', size: 54321098, modified: new Date('2023-10-22T16:45:00Z'), path: 'gdrive://My Drive/Team Meeting.mp4', service: CloudService.GDRIVE }
  ],
  'gdrive://My Drive/Work/': [
    { id: 'g6', name: 'Q4 Report.xlsx', type: 'spreadsheet', size: 54321, modified: new Date('2024-01-12T10:00:00Z'), path: 'gdrive://My Drive/Work/Q4 Report.xlsx', service: CloudService.GDRIVE },
    { id: 'g7', name: 'Client Presentation.pptx', type: 'presentation', size: 234567, modified: new Date('2023-10-25T11:00:00Z'), path: 'gdrive://My Drive/Work/Client Presentation.pptx', service: CloudService.GDRIVE }
  ],
  'dropbox://': [
    { id: 'd1', name: 'Personal', type: 'folder', size: null, modified: new Date('2023-08-01T18:00:00Z'), path: 'dropbox://Personal/', service: CloudService.DROPBOX },
    { id: 'd2', name: 'Apps', type: 'folder', size: null, modified: new Date('2023-01-01T12:00:00Z'), path: 'dropbox://Apps/', service: CloudService.DROPBOX },
    { id: 'd3', name: 'Getting Started with Dropbox.pdf', type: 'pdf', size: 789012, modified: new Date('2023-01-01T12:01:00Z'), path: 'dropbox://Getting Started with Dropbox.pdf', service: CloudService.DROPBOX }
  ],
  'dropbox://Personal/': [
    { id: 'd4', name: 'Receipts.zip', type: 'archive', size: 3456789, modified: new Date('2023-10-01T12:00:00Z'), path: 'dropbox://Personal/Receipts.zip', service: CloudService.DROPBOX },
    { id: 'd5', name: 'mountain-vista.jpg', type: 'image', size: 6789012, modified: new Date('2023-09-22T11:30:00Z'), path: 'dropbox://Personal/mountain-vista.jpg', service: CloudService.DROPBOX }
  ],
  'dropbox://Apps/': [],
  'onedrive://': [
    { id: 'o1', name: 'Documents', type: 'folder', size: null, modified: new Date('2023-10-26T10:00:00Z'), path: 'onedrive://Documents/', service: CloudService.ONEDRIVE },
    { id: 'o2', name: 'Pictures', type: 'folder', size: null, modified: new Date('2023-10-25T11:00:00Z'), path: 'onedrive://Pictures/', service: CloudService.ONEDRIVE },
    { id: 'o3', name: 'Music', type: 'folder', size: null, modified: new Date('2023-10-25T11:00:00Z'), path: 'onedrive://Music/', service: CloudService.ONEDRIVE }
  ],
  'onedrive://Pictures/': [
    { id: 'o4', name: '2024', type: 'folder', size: null, modified: new Date('2024-01-01T00:00:00Z'), path: 'onedrive://Pictures/2024/', service: CloudService.ONEDRIVE }
  ],
  'onedrive://Pictures/2024/': [
    { id: 'o5', name: 'hawaii-sunset.jpg', type: 'image', size: 4567890, modified: new Date('2024-03-12T19:20:00Z'), path: 'onedrive://Pictures/2024/hawaii-sunset.jpg', service: CloudService.ONEDRIVE }
  ],
  'onedrive://Music/': [
    { id: 'o6', name: 'lofi-beats.mp3', type: 'audio', size: 4500000, modified: new Date('2024-02-08T15:42:00Z'), path: 'onedrive://Music/lofi-beats.mp3', service: CloudService.ONEDRIVE }
  ]
};

cloudFileSystem['combined://'] = [
  ...cloudFileSystem['dropbox://'],
  ...cloudFileSystem['gdrive://'],
  ...cloudFileSystem['onedrive://']
];

export async function getCloudFilesByPath(path: string): Promise<FileItem[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const files = cloudFileSystem[path] || [];
      const sorted = [...files].sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });
      resolve(sorted);
    }, CLOUD_DELAY);
  });
}

export async function getCloudRecursiveContents(path: string): Promise<FileItem[]> {
  const visited = new Set<string>();
  const queue: string[] = [path];
  const result: FileItem[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const items = await getCloudFilesByPath(current);
    for (const item of items) {
      result.push(item);
      if (item.type === 'folder') {
        queue.push(item.path);
      }
    }
  }

  return result;
}
