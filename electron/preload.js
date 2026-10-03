const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('Electron', {
    version: process.versions.electron,
    quit: () => ipcRenderer.invoke('app:quit'),
});
