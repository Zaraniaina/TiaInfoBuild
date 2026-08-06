/**
 * Vérifie que TOUS les canaux IPC attendus sont enregistrés dans main.js.
 * Electron est mocké : aucun processus réel n'est lancé.
 */

jest.mock('electron', () => {
  const mockPath = require('path');
  const mockOs = require('os');
  
  return {
    app: {
      whenReady: jest.fn(() => new Promise(() => {})), // ne résout jamais → pas de fenêtre
      on: jest.fn(),
      getPath: jest.fn(() => mockPath.join(mockOs.tmpdir(), 'tia-test-userdata')),
      getVersion: jest.fn(() => '1.0.0-test'),
      quit: jest.fn()
    },
    BrowserWindow: jest.fn(),
    ipcMain: { handle: jest.fn() },
    Menu: { setApplicationMenu: jest.fn() },
    dialog: { showOpenDialog: jest.fn(), showSaveDialog: jest.fn() },
    shell: { openExternal: jest.fn(), openPath: jest.fn(), showItemInFolder: jest.fn() }
  };
});

const { ipcMain } = require('electron');
require('../../main'); // enregistre tous les handlers

const channels = ipcMain.handle.mock.calls.map(c => c[0]);

describe('Registre IPC — main.js', () => {
  test('au moins 120 canaux enregistrés', () => {
    expect(channels.length).toBeGreaterThanOrEqual(120);
  });

  test('aucun canal en double', () => {
    expect(new Set(channels).size).toBe(channels.length);
  });

  test.each([
    // Auth & session
    'auth:login', 'auth:register', 'auth:logout', 'auth:check',
    'session:get', 'session:set', 'session:clear',
    // Dashboard
    'dashboard:stats', 'dashboard:getCAEvolution', 'dashboard:getTopChantiersBudget', 'dashboard:getActiviteRecente',
    // Chantiers
    'chantiers:list', 'chantiers:get', 'chantiers:create', 'chantiers:update', 'chantiers:delete',
    'chantiers:stats', 'chantiers:addPhase', 'chantiers:addIncident', 'chantiers:recalculerBudget',
    'phases:list', 'phases:updateAvancement', 'phases:reorder', 'phases:avancementGlobal',
    'incidents:list', 'incidents:changerStatut',
    // RH
    'employes:list', 'employes:get', 'employes:create', 'employes:update', 'employes:delete',
    'employes:presentsToday', 'employes:pointer', 'employes:stats',
    'pointages:list', 'pointages:create',
    'heures-sup:list', 'heures-sup:create',
    'equipes:list', 'equipes:create',
    // Matériels
    'materiels:list', 'materiels:get', 'materiels:create', 'materiels:update', 'materiels:delete',
    'materiels:stats', 'materiels:disponibles', 'materiels:maintenanceEnRetard',
    'maintenances:list', 'maintenances:create', 'maintenances:update',
    // Stocks
    'articles:list', 'articles:get', 'articles:create', 'articles:update', 'articles:delete',
    'articles:enAlerte', 'articles:updateStock', 'articles:stats',
    'fournisseurs:list', 'fournisseurs:create', 'fournisseurs:update', 'fournisseurs:delete',
    'mouvements:byArticle', 'mouvements:byChantier', 'mouvements:byPeriode', 'mouvements:stats',
    // Commercial
    'clients:list', 'clients:get', 'clients:create', 'clients:update', 'clients:delete',
    'devis:list', 'devis:get', 'devis:create', 'devis:update', 'devis:transformerEnContrat',
    'contrats:list', 'contrats:get',
    'factures:list', 'factures:get', 'factures:create', 'factures:update', 'factures:delete',
    'factures:enRetard', 'factures:ajouterPaiement',
    'paiements:byFacture',
    // Finance
    'depenses:byChantier', 'depenses:totalByChantier', 'depenses:byCategorie', 'depenses:enAttenteValidation',
    'alertes:nonLues', 'alertes:marquerLue', 'alertes:marquerToutesLues', 'alertes:creer', 'alertes:countNonLues',
    // Sync & système
    'sync:getConfig', 'sync:setConfig', 'sync:getHistory', 'sync:getStatus',
    'sync:push', 'sync:pull', 'sync:testConnection', 'sync:syncNow',
    'utilisateurs:list', 'utilisateurs:create', 'utilisateurs:update', 'utilisateurs:delete',
    'entreprises:get', 'entreprises:update',
    'preferences:get', 'preferences:update',
    'backup:list', 'backup:exportSQLite', 'backup:exportSQL', 'backup:restore', 'backup:import',
    'notification:show', 'app:getVersion'
  ])('canal "%s" enregistré', (channel) => {
    expect(channels).toContain(channel);
  });

  test('✅ [NETTOYAGE REQUIS] canaux legacy electronAPI absents de main.js', () => {
    // Ces canaux legacy sont dans preload.js mais PAS dans main.js
    // → Toute vue utilisant window.electronAPI plantera
    // Action requise : nettoyer preload.js OU migrer les vues vers window.api.*
    const legacyAttendus = [
      'dashboard:getStats',
      'commercial:getListDevis',
      'commercial:getDevisById',
      'commercial:createDevis',
      'commercial:getListFactures',
      'commercial:getFactureById',
      'commercial:getListClients',
      'chantier:getList',
      'entreprise:updateDevise'
    ];
    
    // Vérifier qu'AUCUN de ces canaux legacy n'est enregistré
    legacyAttendus.forEach(c => {
      expect(channels).not.toContain(c);
    });
    
    // Vérifier que les canaux corrects (non-legacy) sont présents
    expect(channels).toContain('dashboard:stats');
    expect(channels).toContain('devis:list');
    expect(channels).toContain('chantiers:list');
  });
});