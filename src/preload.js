const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('popup', {
  onTiles: (fn) => ipcRenderer.on('tiles', (_e, payload) => fn(payload)),
  setFocus: (camera) => ipcRenderer.send('set-focus', camera),
  dismiss: (camera) => ipcRenderer.send('dismiss', camera),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getDisabled: () => ipcRenderer.invoke('get-disabled'),
  setDisabled: (value) => ipcRenderer.send('set-disabled', value),
  getCameras: () => ipcRenderer.invoke('get-cameras'),
  setPinned: (camera, on) => ipcRenderer.send('set-pinned', camera, on),
});
