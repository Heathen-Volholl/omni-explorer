import { EventEmitter } from 'node:events';

function toSerializableStatus(state) {
  return {
    state: state.state,
    lastSyncedAt: state.lastSyncedAt ? state.lastSyncedAt.toISOString() : null,
    pendingOperations: state.pendingOperations,
    conflicts: state.conflicts.map((conflict) => ({
      ...conflict,
      detectedAt: conflict.detectedAt.toISOString()
    })),
    message: state.message
  };
}

export class SyncController extends EventEmitter {
  constructor() {
    super();
    this.state = {
      state: 'idle',
      lastSyncedAt: null,
      pendingOperations: 0,
      conflicts: [],
      message: 'Sync not yet run'
    };
    this.renderers = new Set();
  }

  getStatus() {
    return toSerializableStatus(this.state);
  }

  async triggerSync() {
    if (this.state.state === 'syncing') {
      return this.getStatus();
    }

    this.updateState({ state: 'syncing', message: 'Synchronising...' });
    await new Promise((resolve) => setTimeout(resolve, 750));

    const now = new Date();
    this.updateState({
      state: 'idle',
      lastSyncedAt: now,
      pendingOperations: 0,
      conflicts: [],
      message: 'Up to date'
    });

    return this.getStatus();
  }

  updateState(patch) {
    this.state = {
      ...this.state,
      ...patch
    };
    const payload = toSerializableStatus(this.state);
    for (const contents of this.renderers) {
      try {
        contents.send('sync:update', payload);
      } catch (error) {
        if (error && error.message && error.message.includes('Object has been destroyed')) {
          this.renderers.delete(contents);
        }
      }
    }
  }

  registerRenderer(webContents) {
    if (!this.renderers.has(webContents)) {
      this.renderers.add(webContents);
      webContents.once('destroyed', () => {
        this.renderers.delete(webContents);
      });
      webContents.send('sync:update', this.getStatus());
    }
  }
}
