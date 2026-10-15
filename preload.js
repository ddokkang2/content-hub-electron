// Content Hub — preload (contextIsolation 유지, 최소 API만 노출)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hub', {
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('set-always-on-top', Boolean(enabled)),
});
