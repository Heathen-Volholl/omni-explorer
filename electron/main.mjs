import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import crypto from 'node:crypto';
import { SyncController } from './syncController.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const syncController = new SyncController();

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const isDev = process.env.NODE_ENV === 'development' || Boolean(VITE_DEV_SERVER_URL);

let mainWindow = null;

const systemDrive = (process.env.SystemDrive || 'C:').replace(/\\$/, '');
const systemDriveDisplayName = `Local Disk (${systemDrive})`;
const driveAliasMap = new Map([[systemDriveDisplayName, systemDrive]]);

const specialFolders = [
  { label: 'Desktop', virtual: 'local://Desktop/', fsPath: path.join(os.homedir(), 'Desktop') },
  { label: 'Documents', virtual: 'local://Documents/', fsPath: path.join(os.homedir(), 'Documents') },
  { label: 'Downloads', virtual: 'local://Downloads/', fsPath: path.join(os.homedir(), 'Downloads') },
  { label: 'Music', virtual: 'local://Music/', fsPath: path.join(os.homedir(), 'Music') },
  { label: 'Pictures', virtual: 'local://Pictures/', fsPath: path.join(os.homedir(), 'Pictures') },
  { label: 'Videos', virtual: 'local://Videos/', fsPath: path.join(os.homedir(), 'Videos') }
];

function normalizeVirtualFolder(virtual) {
  return virtual.endsWith('/') ? virtual : `${virtual}/`;
}

function sanitizeVirtualPath(virtualPath) {
  return virtualPath.replace(/\\+/g, '/');
}

function ensureDriveLetter(displayName) {
  if (driveAliasMap.has(displayName)) {
    return driveAliasMap.get(displayName);
  }
  const match = displayName.match(/\(([A-Z]):\)/i);
  if (match) {
    const letter = `${match[1].toUpperCase()}:`;
    driveAliasMap.set(displayName, letter);
    return letter;
  }
  return null;
}

function createIdForPath(virtualPath) {
  return crypto.createHash('sha1').update(virtualPath).digest('hex');
}

async function pathExists(fsPath) {
  try {
    await fs.access(fsPath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function inferFileType(name, isDirectory) {
  if (isDirectory) return 'folder';
  const ext = path.extname(name).toLowerCase();
  switch (ext) {
    case '.doc':
    case '.docx':
    case '.md':
    case '.txt':
      return 'document';
    case '.xlsx':
    case '.csv':
    case '.tsv':
      return 'spreadsheet';
    case '.ppt':
    case '.pptx':
      return 'presentation';
    case '.jpg':
    case '.jpeg':
    case '.png':
    case '.gif':
    case '.webp':
    case '.svg':
      return 'image';
    case '.mp4':
    case '.mkv':
    case '.mov':
    case '.avi':
      return 'video';
    case '.zip':
    case '.rar':
    case '.7z':
      return 'archive';
    case '.mp3':
    case '.wav':
    case '.flac':
      return 'audio';
    case '.pdf':
      return 'pdf';
    default:
      return 'file';
  }
}

function resolveLocalVirtualPath(virtualPath) {
  const sanitized = sanitizeVirtualPath(virtualPath);
  if (!sanitized.startsWith('local://')) {
    throw new Error(`Unsupported scheme in path: ${virtualPath}`);
  }
  if (sanitized === 'local://') {
    return { type: 'root' };
  }
  if (sanitized === 'local://This PC/' || sanitized === 'local://This PC') {
    return { type: 'drives' };
  }

  const asDirectory = sanitized.endsWith('/');
  for (const folder of specialFolders) {
    const base = normalizeVirtualFolder(folder.virtual);
    if (sanitized === base || sanitized === base.slice(0, -1)) {
      return { type: 'entry', fsPath: folder.fsPath, isDirectory: true, baseVirtual: base };
    }
    if (sanitized.startsWith(base)) {
      const relative = sanitized.slice(base.length);
      const segments = relative.split('/').filter(Boolean);
      const fsPath = path.join(folder.fsPath, ...segments);
      const isDirectory = asDirectory || segments.length === 0;
      return { type: 'entry', fsPath, isDirectory, baseVirtual: base };
    }
  }

  const driveMatch = sanitized.match(/^local:\/\/This PC\/([^/]+)\/?(.*)$/);
  if (driveMatch) {
    const displayName = driveMatch[1];
    const remainder = driveMatch[2];
    const driveLetter = ensureDriveLetter(displayName);
    if (!driveLetter) {
      throw new Error(`Unknown drive mapping for ${displayName}`);
    }
    const segments = remainder.split('/').filter(Boolean);
    const fsPath = path.join(`${driveLetter}${path.sep}`, ...segments);
    const isDirectory = asDirectory || segments.length === 0;
    return { type: 'entry', fsPath, isDirectory, baseVirtual: `local://This PC/${displayName}/` };
  }

  throw new Error(`Unsupported local path: ${virtualPath}`);
}

async function ensureDirectory(fsPath) {
  await fs.mkdir(fsPath, { recursive: true });
}

async function copyEntry(sourceFs, destinationFs) {
  const stats = await fs.stat(sourceFs);
  if (stats.isDirectory()) {
    await fs.cp(sourceFs, destinationFs, { recursive: true, force: true });
  } else {
    await ensureDirectory(path.dirname(destinationFs));
    await fs.copyFile(sourceFs, destinationFs);
  }
}

async function moveEntry(sourceFs, destinationFs) {
  await ensureDirectory(path.dirname(destinationFs));
  try {
    await fs.rename(sourceFs, destinationFs);
  } catch (error) {
    if (error && error.code === 'EXDEV') {
      await copyEntry(sourceFs, destinationFs);
      await deleteEntry(sourceFs);
    } else {
      throw error;
    }
  }
}

async function deleteEntry(targetFs) {
  await fs.rm(targetFs, { recursive: true, force: true });
}

async function readDirectory(fsPath, virtualBase) {
  const baseWithSlash = normalizeVirtualFolder(virtualBase);
  try {
    const dirEntries = await fs.readdir(fsPath, { withFileTypes: true });
    const items = await Promise.all(
      dirEntries.map(async (entry) => {
        const entryFsPath = path.join(fsPath, entry.name);
        let stats;
        try {
          stats = await fs.stat(entryFsPath);
        } catch {
          return null;
        }
        const isDirectory = entry.isDirectory();
        const virtualPath = `${baseWithSlash}${entry.name}${isDirectory ? '/' : ''}`;
        return {
          id: createIdForPath(virtualPath),
          name: entry.name,
          type: inferFileType(entry.name, isDirectory),
          size: isDirectory ? null : stats.size,
          modified: stats.mtime.toISOString(),
          path: virtualPath,
          service: 'local'
        };
      })
    );

    return items
      .filter(Boolean)
      .sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });
  } catch (error) {
    console.warn(`Failed to read directory ${fsPath}:`, error);
    return [];
  }
}

async function listSpecialDirectories() {
  const entries = [];
  for (const folder of specialFolders) {
    if (await pathExists(folder.fsPath)) {
      entries.push({
        id: createIdForPath(folder.virtual),
        name: folder.label,
        type: 'folder',
        size: null,
        modified: new Date().toISOString(),
        path: normalizeVirtualFolder(folder.virtual),
        service: 'local'
      });
    }
  }

  entries.push({
    id: createIdForPath('local://This PC/'),
    name: 'This PC',
    type: 'folder',
    size: null,
    modified: new Date().toISOString(),
    path: 'local://This PC/',
    service: 'local'
  });

  return entries;
}

async function listDriveRoots() {
  const drives = new Set([systemDrive]);
  for (let code = 65; code <= 90; code++) {
    const letter = String.fromCharCode(code);
    const candidate = `${letter}:`;
    if (drives.has(candidate)) continue;
    try {
      await fs.access(`${candidate}\\`, fsConstants.R_OK);
      drives.add(candidate);
    } catch {
      // ignore missing drive
    }
  }

  const now = new Date().toISOString();
  const items = Array.from(drives).map((drive) => {
    const displayName = drive === systemDrive ? systemDriveDisplayName : `Drive (${drive})`;
    driveAliasMap.set(displayName, drive);
    return {
      id: createIdForPath(`local://This PC/${displayName}/`),
      name: displayName,
      type: 'folder',
      size: null,
      modified: now,
      path: `local://This PC/${displayName}/`,
      service: 'local'
    };
  });

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

async function handleListDirectory(_event, virtualPath) {
  const info = resolveLocalVirtualPath(virtualPath);
  switch (info.type) {
    case 'root':
      return listSpecialDirectories();
    case 'drives':
      return listDriveRoots();
    case 'entry': {
      if (!info.isDirectory) {
        throw new Error('Cannot list contents of a file path');
      }
      return readDirectory(info.fsPath, info.baseVirtual ?? virtualPath);
    }
    default:
      return [];
  }
}

async function handleGetLocalShortcuts() {
  const entries = await listSpecialDirectories();
  return entries
    .filter((entry) => entry.path !== 'local://This PC/')
    .map((entry) => ({ name: entry.name, path: entry.path }))
    .concat({ name: 'This PC', path: 'local://This PC/' });
}

function normalizeDestinationVirtual(destination) {
  return destination.endsWith('/') ? destination : `${destination}/`;
}

async function performCopyOrMove({ sources, destination, move = false }) {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error('No source items provided.');
  }
  const destVirtual = normalizeDestinationVirtual(destination);
  const destInfo = resolveLocalVirtualPath(destVirtual);
  if (destInfo.type !== 'entry' || !destInfo.isDirectory) {
    throw new Error('Destination must be a directory.');
  }

  if (!(await pathExists(destInfo.fsPath))) {
    await ensureDirectory(destInfo.fsPath);
  }

  const results = [];
  for (const sourceVirtual of sources) {
    const sourceInfo = resolveLocalVirtualPath(sourceVirtual);
    if (sourceInfo.type !== 'entry') {
      throw new Error(`Unsupported source path: ${sourceVirtual}`);
    }
    const sourceStats = await fs.stat(sourceInfo.fsPath);
    const basename = path.basename(sourceInfo.fsPath);
    const targetFsPath = path.join(destInfo.fsPath, basename);

    const resolvedSource = path.resolve(sourceInfo.fsPath);
    const resolvedDestination = path.resolve(targetFsPath);

    if (resolvedSource === resolvedDestination) {
      continue;
    }
    if (resolvedDestination.startsWith(`${resolvedSource}${path.sep}`)) {
      throw new Error('Cannot copy or move a directory into itself.');
    }

    if (move) {
      await moveEntry(sourceInfo.fsPath, targetFsPath);
    } else {
      await copyEntry(sourceInfo.fsPath, targetFsPath);
    }

    results.push({
      source: sourceVirtual,
      destination: `${destVirtual}${basename}${sourceStats.isDirectory() ? '/' : ''}`
    });
  }

  return { success: true, items: results };
}

async function handleDeleteItems(_event, payload) {
  const { targets } = payload ?? {};
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error('No targets provided.');
  }
  for (const target of targets) {
    const info = resolveLocalVirtualPath(target);
    if (info.type !== 'entry') {
      throw new Error(`Unsupported target path: ${target}`);
    }
    await deleteEntry(info.fsPath);
  }
  return { success: true };
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDev && VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(console.error);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('filesystem:listDirectory', handleListDirectory);
ipcMain.handle('filesystem:getLocalShortcuts', handleGetLocalShortcuts);
ipcMain.handle('filesystem:copyItems', (_event, payload) => performCopyOrMove(payload));
ipcMain.handle('filesystem:moveItems', (_event, payload) => performCopyOrMove({ ...payload, move: true }));
ipcMain.handle('filesystem:deleteItems', handleDeleteItems);

ipcMain.handle('sync:getStatus', () => syncController.getStatus());
ipcMain.handle('sync:trigger', () => syncController.triggerSync());
ipcMain.on('sync:subscribe', (event) => {
  syncController.registerRenderer(event.sender);
});
