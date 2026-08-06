// Desktop/preload.js
const { contextBridge, ipcRenderer } = require('electron');

/**
 * Helper IPC avec déballage intelligent des données
 */
function createIpcWrapper(channelPrefix) {
  return {
    invoke: async (method, ...args) => {
      const res = await ipcRenderer.invoke(`${channelPrefix}:${method}`, ...args);
      // Fusionner data dans res pour assurer la compatibilité avec toutes les vues
      if (res && res.success !== undefined && res.data !== undefined) {
        if (Array.isArray(res.data)) {
          res.items = res.data;
        } else if (typeof res.data === 'object' && res.data !== null) {
          Object.assign(res, res.data);
        }
      }
      return res;
    },
    on: (event, callback) => {
      const channel = `${channelPrefix}:${event}`;
      ipcRenderer.on(channel, (_, ...args) => callback(...args));
      return () => ipcRenderer.removeAllListeners(channel);
    },
    send: (event, ...args) =>
      ipcRenderer.send(`${channelPrefix}:${event}`, ...args)
  };
}

/* ======================================================
   Nouvelle API modulaire
   ====================================================== */
contextBridge.exposeInMainWorld('api', {
  auth: createIpcWrapper('auth'),
  entreprises: createIpcWrapper('entreprises'),
  preferences: createIpcWrapper('preferences'),
  backup: createIpcWrapper('backup'),
  chantiers: createIpcWrapper('chantiers'),
  phases: createIpcWrapper('phases'),
  incidents: createIpcWrapper('incidents'),
  employes: createIpcWrapper('employes'),
  pointages: createIpcWrapper('pointages'),
  equipes: createIpcWrapper('equipes'),
  heuresSup: createIpcWrapper('heures-sup'),
  materiels: createIpcWrapper('materiels'),
  maintenances: createIpcWrapper('maintenances'),
  articles: createIpcWrapper('articles'),
  fournisseurs: createIpcWrapper('fournisseurs'),
  mouvements: createIpcWrapper('mouvements'),
  clients: createIpcWrapper('clients'),
  clientAdresses: createIpcWrapper('clientAdresses'),
  devis: createIpcWrapper('devis'),
  contrats: createIpcWrapper('contrats'),
  factures: createIpcWrapper('factures'),
  paiements: createIpcWrapper('paiements'),
  depenses: createIpcWrapper('depenses'),
  rapports: createIpcWrapper('rapports'),
  alertes: createIpcWrapper('alertes'),
  dashboard: createIpcWrapper('dashboard'),
  sync: createIpcWrapper('sync'),
  utilisateurs: createIpcWrapper('utilisateurs'),
  utils: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    openPath: (path) => ipcRenderer.invoke('app:openPath', path),
    showItemInFolder: (path) => ipcRenderer.invoke('app:showItemInFolder', path),
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options),
    showNotification: (title, body) => ipcRenderer.invoke('notification:show', title, body)
  },
  session: {
    get: () => ipcRenderer.invoke('session:get'),
    set: (data) => ipcRenderer.invoke('session:set', data),
    clear: () => ipcRenderer.invoke('session:clear')
  }
});

/* ======================================================
   IPC brut
   ====================================================== */
contextBridge.exposeInMainWorld('ipcRaw', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
    return () => ipcRenderer.removeAllListeners(channel);
  },
  send: (channel, ...args) => ipcRenderer.send(channel, ...args)
});