const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script - Pont sécurisé entre Main Process et Renderer Process
 * Expose une API IPC structurée par module
 */

// Helper pour créer des wrappers IPC typés
function createIpcWrapper(channelPrefix) {
  return {
    // Appel simple (invoke)
    invoke: (method, ...args) => ipcRenderer.invoke(`${channelPrefix}:${method}`, ...args),

    // Écoute d'événements (on)
    on: (event, callback) => {
      const channel = `${channelPrefix}:${event}`;
      ipcRenderer.on(channel, (_, ...args) => callback(...args));
      return () => ipcRenderer.removeAllListeners(channel);
    },

    // Émission d'événements vers main (send)
    send: (event, ...args) => ipcRenderer.send(`${channelPrefix}:${event}`, ...args)
  };
}

// Exposer l'API structurée
contextBridge.exposeInMainWorld('api', {
  // Authentification
  auth: createIpcWrapper('auth'),

  // Chantiers
  chantiers: createIpcWrapper('chantiers'),

  // Phases
  phases: createIpcWrapper('phases'),

  // Incidents
  incidents: createIpcWrapper('incidents'),

  // RH - Employés
  employes: createIpcWrapper('employes'),

  // RH - Pointages
  pointages: createIpcWrapper('pointages'),

  // RH - Équipes
  equipes: createIpcWrapper('equipes'),

  // RH - Heures sup
  heuresSup: createIpcWrapper('heures-sup'),

  // Matériels
  materiels: createIpcWrapper('materiels'),

  // Maintenance
  maintenances: createIpcWrapper('maintenances'),

  // Stocks - Articles
  articles: createIpcWrapper('articles'),

  // Stocks - Fournisseurs
  fournisseurs: createIpcWrapper('fournisseurs'),

  // Stocks - Mouvements
  mouvements: createIpcWrapper('mouvements'),

  // Commercial - Clients
  clients: createIpcWrapper('clients'),

  // Commercial - Devis
  devis: createIpcWrapper('devis'),

  // Commercial - Contrats
  contrats: createIpcWrapper('contrats'),

  // Commercial - Factures
  factures: createIpcWrapper('factures'),

  // Commercial - Paiements
  paiements: createIpcWrapper('paiements'),

  // Finance - Dépenses
  depenses: createIpcWrapper('depenses'),

  // Finance - Rapports
  rapports: createIpcWrapper('rapports'),

  // Alertes
  alertes: createIpcWrapper('alertes'),

  // Dashboard / Stats
  dashboard: createIpcWrapper('dashboard'),

  // Synchronisation
  sync: createIpcWrapper('sync'),

  // Utilitaires
  utils: {
    // Obtenir la version de l'app
    getVersion: () => ipcRenderer.invoke('app:getVersion'),

    // Ouvrir un fichier/dossier
    openPath: (path) => ipcRenderer.invoke('app:openPath', path),

    // Afficher dans le dossier
    showItemInFolder: (path) => ipcRenderer.invoke('app:showItemInFolder', path),

    // Dialogue fichier
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options),

    // Notification native
    showNotification: (title, body) => ipcRenderer.invoke('notification:show', title, body)
  },

  // Session utilisateur
  session: {
    get: () => ipcRenderer.invoke('session:get'),
    set: (data) => ipcRenderer.invoke('session:set', data),
    clear: () => ipcRenderer.invoke('session:clear')
  }
});

// Exposer aussi les canaux bruts pour cas avancés
contextBridge.exposeInMainWorld('ipcRaw', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
    return () => ipcRenderer.removeAllListeners(channel);
  },
  send: (channel, ...args) => ipcRenderer.send(channel, ...args)
});