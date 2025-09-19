import { contextBridge, ipcRenderer } from 'electron';

const filesystemAPI = {
  listDirectory: (virtualPath) => ipcRenderer.invoke('filesystem:listDirectory', virtualPath),
  getLocalShortcuts: () => ipcRenderer.invoke('filesystem:getLocalShortcuts'),
  copyItems: (payload) => ipcRenderer.invoke('filesystem:copyItems', payload),
  moveItems: (payload) => ipcRenderer.invoke('filesystem:moveItems', payload),
  deleteItems: (payload) => ipcRenderer.invoke('filesystem:deleteItems', payload)
};

const syncAPI = {
  getStatus: () => ipcRenderer.invoke('sync:getStatus'),
  trigger: () => ipcRenderer.invoke('sync:trigger'),
  subscribe: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('sync:update', listener);
    ipcRenderer.send('sync:subscribe');
    return () => {
      ipcRenderer.removeListener('sync:update', listener);
    };
  }
};

contextBridge.exposeInMainWorld('electronAPI', {
  filesystem: filesystemAPI,
  sync: syncAPI
});
