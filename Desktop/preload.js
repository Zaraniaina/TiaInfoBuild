const { contextBridge, ipcRenderer } = require('electron');

/**
 * Helper IPC
 */
function createIpcWrapper(channelPrefix) {
  return {
    invoke: (method, ...args) =>
      ipcRenderer.invoke(`${channelPrefix}:${method}`, ...args),
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

  // Compat layout.js (ligne ~328) — renvoie une Promesse<number>
  getAlertCount: (entrepriseId) =>
    ipcRenderer.invoke('alertes:countNonLues', entrepriseId),

  utils: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    openPath: (path) => ipcRenderer.invoke('app:openPath', path),
    showItemInFolder: (path) =>
      ipcRenderer.invoke('app:showItemInFolder', path),
    showOpenDialog: (options) =>
      ipcRenderer.invoke('dialog:showOpenDialog', options),
    showSaveDialog: (options) =>
      ipcRenderer.invoke('dialog:showSaveDialog', options),
    showNotification: (title, body) =>
      ipcRenderer.invoke('notification:show', title, body)
  },
  session: {
    get: () => ipcRenderer.invoke('session:get'),
    set: (data) => ipcRenderer.invoke('session:set', data),
    clear: () => ipcRenderer.invoke('session:clear')
  }
});

/* ======================================================
   Compatibilité avec l'ancien code
   (canaux corrigés pour correspondre à main.js)
====================================================== */
contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  login: (credentials) =>
    ipcRenderer.invoke('auth:login', credentials),
  register: (data) =>
    ipcRenderer.invoke('auth:register', data),

  // Dashboard (corrigé : dashboard:stats au lieu de dashboard:getStats)
  getDashboardStats: (entrepriseId) =>
    ipcRenderer.invoke('dashboard:stats', entrepriseId),
  getCAEvolution: (entrepriseId) =>
    ipcRenderer.invoke('dashboard:getCAEvolution', entrepriseId),
  getTopChantiersBudget: (entrepriseId) =>
    ipcRenderer.invoke('dashboard:getTopChantiersBudget', entrepriseId),
  getActiviteRecente: (entrepriseId, limit) =>
    ipcRenderer.invoke('dashboard:getActiviteRecente', entrepriseId, limit),

  // Commercial (corrigé : canaux devis:/factures:/clients:)
  getListDevis: (params) =>
    ipcRenderer.invoke('devis:list', params),
  getDevisById: (id) =>
    ipcRenderer.invoke('devis:get', id),
  createDevis: (data, entrepriseId) =>
    ipcRenderer.invoke('devis:create', data, entrepriseId),
  getListFactures: (params) =>
    ipcRenderer.invoke('factures:list', params),
  getFactureById: (id) =>
    ipcRenderer.invoke('factures:get', id),
  getListClients: (params) =>
    ipcRenderer.invoke('clients:list', params),

  // Chantiers (corrigé : chantiers:list au lieu de chantier:getList)
  getListChantiers: (params) =>
    ipcRenderer.invoke('chantiers:list', params),

  // Entreprise (corrigé : map vers entreprises:update)
  updateEntrepriseDevise: (entrepriseId, devise) =>
    ipcRenderer.invoke('entreprises:update', entrepriseId, { devise }),

  // Sync
  syncPush: () =>
    ipcRenderer.invoke('sync:push'),
  syncPull: () =>
    ipcRenderer.invoke('sync:pull'),
  getSyncStatus: () =>
    ipcRenderer.invoke('sync:status')
});

/* ======================================================
   IPC brut
====================================================== */
contextBridge.exposeInMainWorld('ipcRaw', {
  invoke: (channel, ...args) =>
    ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
    return () => ipcRenderer.removeAllListeners(channel);
  },
  send: (channel, ...args) =>
    ipcRenderer.send(channel, ...args)
});