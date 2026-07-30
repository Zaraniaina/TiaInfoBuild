const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  login: (email, password) => ipcRenderer.invoke('auth:login', email, password)
})