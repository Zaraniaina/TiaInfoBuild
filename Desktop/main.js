// Desktop/main.js
const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron')
const path = require('path')
const { initDatabase } = require('./models/init')
const fs = require('fs')
const db = require('./models/db')
const permissions = require('./shared/permissions')

// Repositories
const ChantierRepository = require('./models/repositories/ChantierRepository')
const PhaseRepository = require('./models/repositories/PhaseRepository')
const IncidentRepository = require('./models/repositories/IncidentRepository')
const EmployeRepository = require('./models/repositories/EmployeRepository')
const PointageRepository = require('./models/repositories/PointageRepository')
const HeureSupplementaireRepository = require('./models/repositories/HeureSupplementaireRepository')
const EquipeRepository = require('./models/repositories/EquipeRepository')
const ArticleRepository = require('./models/repositories/ArticleRepository')
const FournisseurRepository = require('./models/repositories/FournisseurRepository')
const MouvementStockRepository = require('./models/repositories/MouvementStockRepository')
const ClientRepository = require('./models/repositories/ClientRepository')
const ClientAdresseRepository = require('./models/repositories/ClientAdresseRepository')
const DevisRepository = require('./models/repositories/DevisRepository')
const LigneDevisRepository = require('./models/repositories/LigneDevisRepository')
const ContratRepository = require('./models/repositories/ContratRepository')
const FactureRepository = require('./models/repositories/FactureRepository')
const PaiementRepository = require('./models/repositories/PaiementRepository')
const DepenseRepository = require('./models/repositories/DepenseRepository')
const AlerteRepository = require('./models/repositories/AlerteRepository')
const MaterielRepository = require('./models/repositories/MaterielRepository')
const MaintenanceRepository = require('./models/repositories/MaintenanceRepository')
const DashboardRepository = require('./models/repositories/DashboardRepository')
const SyncRepository = require('./models/repositories/SyncRepository')
const UtilisateurRepository = require('./models/repositories/UtilisateurRepository')
const AffectationRessourceRepository = require('./models/repositories/AffectationRessourceRepository')
const HistoriquePosteRepository = require('./models/repositories/HistoriquePosteRepository')
const AuditLogRepository = require('./models/repositories/AuditLogRepository')

// Controllers
const { handleLogin, handleRegister } = require('./controllers/authController')
const ChantierController = require('./controllers/chantierController')
const RhController = require('./controllers/rhController')
const StockController = require('./controllers/stockController')
const MaterielController = require('./controllers/materielController')
const CommercialController = require('./controllers/commercialController')
const FinanceController = require('./controllers/financeController')
const DashboardController = require('./controllers/dashboardController')
const SyncController = require('./controllers/syncController')
const UtilisateurController = require('./controllers/utilisateurController')
const AlerteController = require('./controllers/alerteController')
const AuditController = require('./controllers/auditController')

// Services
const SyncService = require('./services/syncService')

// Instanciation unique de tous les repositories
const repos = {
  chantiers: new ChantierRepository(),
  affectations: new AffectationRessourceRepository(),
  phases: new PhaseRepository(),
  incidents: new IncidentRepository(),
  employes: new EmployeRepository(),
  pointages: new PointageRepository(),
  heuresSup: new HeureSupplementaireRepository(),
  equipes: new EquipeRepository(),
  articles: new ArticleRepository(),
  fournisseurs: new FournisseurRepository(),
  mouvements: new MouvementStockRepository(),
  clients: new ClientRepository(),
  clientAdresses: new ClientAdresseRepository(),
  devis: new DevisRepository(),
  lignesDevis: new LigneDevisRepository(),
  contrats: new ContratRepository(),
  factures: new FactureRepository(),
  paiements: new PaiementRepository(),
  depenses: new DepenseRepository(),
  alertes: new AlerteRepository(),
  materiels: new MaterielRepository(),
  maintenances: new MaintenanceRepository(),
  dashboard: new DashboardRepository(),
  sync: new SyncRepository(),
  utilisateurs: new UtilisateurRepository(),
  historiquePostes: new HistoriquePosteRepository(),
  auditLog: new AuditLogRepository()
}

// Instanciation des contrôleurs
const chantierCtrl = new ChantierController(repos)
const rhCtrl = new RhController(repos)
const stockCtrl = new StockController(repos)
const materielCtrl = new MaterielController(repos)
const commercialCtrl = new CommercialController(repos)
const financeCtrl = new FinanceController(repos)
const dashboardCtrl = new DashboardController(repos)
const syncCtrl = new SyncController(repos)
const utilisateurCtrl = new UtilisateurController(repos)
const alerteCtrl = new AlerteController(repos)
const auditCtrl = new AuditController(repos)

// Instanciation des services
const syncService = new SyncService(repos.sync)

const dbPath = path.join(__dirname, 'tia_info_build.sqlite')
const backupsDir = path.join(app.getPath('userData'), 'backups')
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true })

function createWindow() {
  Menu.setApplicationMenu(null)
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: 'default',
    show: false
  })
  win.maximize()
  win.once('ready-to-show', () => { win.show() })
  win.loadFile('views/index.html')
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ============================================================
// HELPER: Wrapper sécurisé pour les appels repository
// ============================================================
function safeRepo(fn) {
  try {
    const result = fn()
    return { success: true, data: result }
  } catch (err) {
    console.error('Repository error:', err)
    return { success: false, error: err.message }
  }
}

// ============================================================
// HELPER: Wrapper pour sécuriser les IPC (Authentification + RBAC)
// ============================================================
const ROLE_CODE_ALIASES = {
  ADMIN: ['admin', 'administrateur', 'entreprise'],
  DIRECTEUR: ['direction', 'daf', 'directeur'],
  COMPTABLE: ['comptable', 'finance'],
  RH: ['rh', 'responsable rh', 'responsable_rh'],
  MATERIEL: ['materiel', 'responsable materiel', 'responsable_materiel', 'logisticien'],
  MAGASINIER: ['magasinier', 'stock'],
  COMMERCIAL: ['commercial'],
  CHEF_CHANTIER: ['chef de chantier', 'conducteur', 'chef_chantier'],
  CHEF_PROJET: ['chef de projet', 'chef_projet']
};

function normalizeRoleCode(rawRole) {
  if (!rawRole) return 'ADMIN';
  const normalized = rawRole.toString().trim().toUpperCase();
  if (ROLE_CODE_ALIASES[normalized] || Object.keys(ROLE_CODE_ALIASES).includes(normalized)) {
    return Object.keys(ROLE_CODE_ALIASES).includes(normalized) ? normalized : normalized;
  }
  for (const [code, aliases] of Object.entries(ROLE_CODE_ALIASES)) {
    if (aliases.some(alias => normalized.includes(alias.toUpperCase()))) {
      return code;
    }
  }
  return 'ADMIN';
}

function getSessionRoles() {
  if (!_session) return [];
  const rawRoles = [];
  if (_session.roleCode) rawRoles.push(..._session.roleCode.toString().split(/[,;|]+/));
  if (_session.roleNom) rawRoles.push(..._session.roleNom.toString().split(/[,;|]+/));
  const roles = rawRoles
    .map(r => normalizeRoleCode(r))
    .filter(Boolean);
  return roles.length ? Array.from(new Set(roles)) : ['ADMIN'];
}

function isRoleAllowed(allowedRoles, currentRoles) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return currentRoles.some(role => allowedRoles.includes(role));
}

function secureHandle(channel, allowedRoles, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!_session) {
      console.warn(`[Security] Tentative d'accès non authentifiée à ${channel}`);
      return { success: false, error: 'Non authentifié. Veuillez vous connecter.' };
    }

    if (allowedRoles && allowedRoles.length > 0) {
      const userRoles = getSessionRoles();
      const isAdmin = userRoles.includes('ADMIN');
      if (!isAdmin && !isRoleAllowed(allowedRoles, userRoles)) {
        console.warn(`[Security] Accès refusé à ${channel} pour le rôle ${_session.roleNom || _session.roleCode}`);
        return { success: false, error: "Vous n'avez pas les droits nécessaires pour effectuer cette action." };
      }
    }

    event.user = _session;

    const auditChannels = [
      'utilisateurs:create', 'utilisateurs:update', 'utilisateurs:delete',
      'chantiers:create', 'chantiers:update', 'chantiers:delete',
      'depenses:create', 'depenses:update', 'depenses:delete',
      'factures:create', 'factures:update', 'factures:delete',
      'entreprises:update'
    ];

    if (auditChannels.includes(channel)) {
      try {
        const module = channel.split(':')[0];
        const entityId = args[0] || args[1] || null;
        repos.auditLog.log({
          entrepriseId: _session.entrepriseId,
          utilisateurId: _session.id,
          action: channel,
          module,
          entityId,
          payload: { args }
        });
      } catch (auditErr) {
        console.error('[Audit] Logging failed:', auditErr.message);
      }
    }

    return handler(event, ...args);
  });
}

// ============================================================
// AUTH & SESSION
// ============================================================
let _session = null

ipcMain.handle('auth:login', async (e, data) => {
  const result = await handleLogin(e, data);
  if (result.success) {
    _session = result.user;
  }
  return result;
});

ipcMain.handle('auth:logout', async () => { _session = null; return { success: true } })
ipcMain.handle('auth:check', async () => ({ authenticated: !!_session, user: _session }))

ipcMain.handle('auth:register', async (e, data) => {
  const result = await handleRegister(e, data);
  if (result.success) {
    _session = result.user;
  }
  return result;
});

ipcMain.handle('auth:changePassword', async (e, userId, data) => {
  const result = await changePassword(e, userId, data);
  if (result.success && result.user) {
    _session = result.user;
  }
  return result;
});

ipcMain.handle('session:get', async () => ({ success: true, data: _session }))
// Suppression de session:set qui permettait au frontend d'usurper une session
ipcMain.handle('session:clear', async () => { _session = null; return { success: true } })

// ============================================================
// UTILISATEURS & RÔLES
// ============================================================
const rolesAdmin = permissions.PERMISSIONS.utilisateurs;

secureHandle('utilisateurs:list', rolesAdmin, (e, params) => utilisateurCtrl.getList(e, params))
secureHandle('utilisateurs:getAll', rolesAdmin, (e, params) => utilisateurCtrl.getList(e, params))
secureHandle('utilisateurs:get', rolesAdmin, (e, id) => utilisateurCtrl.getById(e, id))
secureHandle('utilisateurs:create', rolesAdmin, (e, data, entId) => utilisateurCtrl.create(e, data, entId))
secureHandle('utilisateurs:update', rolesAdmin, (e, id, data) => utilisateurCtrl.update(e, id, data))
secureHandle('utilisateurs:updateOwnProfile', [], (e, id, data) => utilisateurCtrl.updateOwnProfile(e, id, data))
secureHandle('utilisateurs:delete', rolesAdmin, (e, id) => utilisateurCtrl.delete(e, id))
secureHandle('utilisateurs:downloadCredentials', ['ADMIN'], (e, id) => utilisateurCtrl.downloadCredentials(e, id))
secureHandle('users:list', rolesAdmin, (e, params) => utilisateurCtrl.getList(e, params))
secureHandle('users:getAll', rolesAdmin, (e, params) => utilisateurCtrl.getList(e, params))
secureHandle('users:get', rolesAdmin, (e, id) => utilisateurCtrl.getById(e, id))
secureHandle('users:create', rolesAdmin, (e, data, entId) => utilisateurCtrl.create(e, data, entId))
secureHandle('users:update', rolesAdmin, (e, id, data) => utilisateurCtrl.update(e, id, data))
secureHandle('users:delete', rolesAdmin, (e, id) => utilisateurCtrl.delete(e, id))
secureHandle('roles:list', rolesAdmin, async () => {
  try {
    const roles = db.prepare("SELECT * FROM Role WHERE is_deleted = 0").all()
    return { success: true, data: roles }
  } catch (err) { return { success: false, error: err.message } }
})

// ============================================================
// ENTREPRISE
// ============================================================
const rolesAdminDg = permissions.PERMISSIONS.entreprises.write;

secureHandle('entreprises:get', ['ADMIN', 'DIRECTEUR'], (e, id) => {
  try { return db.prepare('SELECT * FROM Entreprise WHERE id = ?').get(id) || null }
  catch (err) { return null }
})
secureHandle('entreprises:update', rolesAdminDg, (e, id, data) => {
  try {
    const allowed = ['nom','nomCommercial','siret','numeroTVA','codeAPE','adresse','codePostal','ville','telephone','email','siteWeb','prefixeDevis','prefixeFacture','prefixeContrat','tvaDefaut','delaiPaiementDefaut','validiteDevis','mentionsLegales','devise']
    const fields = Object.keys(data).filter(k => allowed.includes(k))
    if (fields.length === 0) return { success: true }
    const setClause = fields.map(f => `${f} = @${f}`).join(', ')
    db.prepare(`UPDATE Entreprise SET ${setClause} WHERE id = @id`).run({ ...data, id })
    return { success: true }
  } catch (err) { throw err }
})

// ============================================================
// CHANTIERS, PHASES, INCIDENTS, AFFECTATIONS
// ============================================================
const rolesChantiers = permissions.PERMISSIONS.chantiers;

secureHandle('chantiers:list', rolesChantiers, (e, params) => chantierCtrl.getList(e, params))
secureHandle('chantiers:get', rolesChantiers, (e, id) => chantierCtrl.getById(e, id))
secureHandle('chantiers:create', rolesChantiers, (e, data, entrepriseId) => chantierCtrl.create(e, data, entrepriseId))
secureHandle('chantiers:update', rolesChantiers, (e, id, data) => chantierCtrl.update(e, id, data))
secureHandle('chantiers:delete', rolesChantiers, (e, id) => chantierCtrl.delete(e, id))
secureHandle('chantiers:stats', rolesChantiers, (e, entrepriseId) => chantierCtrl.getStats(e, entrepriseId))
secureHandle('chantiers:addPhase', rolesChantiers, (e, chantierId, data) => chantierCtrl.addPhase(e, chantierId, data))
secureHandle('chantiers:savePhases', rolesChantiers, (e, chantierId, phases) => chantierCtrl.savePhases(e, chantierId, phases))
secureHandle('chantiers:addIncident', rolesChantiers, (e, chantierId, data, userId) => chantierCtrl.addIncident(e, chantierId, data, userId))
secureHandle('chantiers:updateIncident', rolesChantiers, (e, id, data) => chantierCtrl.updateIncident(e, id, data))
secureHandle('chantiers:deleteIncident', rolesChantiers, (e, id) => chantierCtrl.deleteIncident(e, id))
secureHandle('chantiers:recalculerBudget', rolesChantiers, (e, chantierId) => chantierCtrl.recalculerBudget(e, chantierId))
secureHandle('chantiers:addAffectation', rolesChantiers, (e, data) => chantierCtrl.createAffectation(e, data))
secureHandle('chantiers:updateAffectation', rolesChantiers, (e, id, data) => chantierCtrl.updateAffectation(e, id, data))
secureHandle('chantiers:deleteAffectation', rolesChantiers, (e, id) => chantierCtrl.deleteAffectation(e, id))

secureHandle('phases:list', rolesChantiers, (e, chantierId) => chantierCtrl.getPhasesByChantier(e, chantierId))
secureHandle('phases:create', rolesChantiers, (e, data) => chantierCtrl.createPhase(e, data))
secureHandle('phases:update', rolesChantiers, (e, id, data) => chantierCtrl.updatePhase(e, id, data))
secureHandle('phases:delete', rolesChantiers, (e, id) => chantierCtrl.deletePhase(e, id))
secureHandle('phases:updateAvancement', rolesChantiers, (e, id, pct) => chantierCtrl.updatePhaseAvancement(e, id, pct))
secureHandle('phases:reorder', rolesChantiers, (e, chantierId, ids) => chantierCtrl.reorderPhases(e, chantierId, ids))
secureHandle('phases:avancementGlobal', rolesChantiers, (e, chantierId) => chantierCtrl.getAvancementGlobalPhases(e, chantierId))

secureHandle('incidents:list', rolesChantiers, (e, chantierId) => chantierCtrl.getIncidentsByChantier(e, chantierId))
secureHandle('incidents:create', rolesChantiers, (e, data) => chantierCtrl.createIncident(e, data))
secureHandle('incidents:update', rolesChantiers, (e, id, data) => chantierCtrl.updateIncident(e, id, data))
secureHandle('incidents:delete', rolesChantiers, (e, id) => chantierCtrl.deleteIncident(e, id))
secureHandle('incidents:changerStatut', rolesChantiers, (e, id, statut) => chantierCtrl.changerStatutIncident(e, id, statut))
secureHandle('incidents:ouvertsByEntreprise', rolesChantiers, (e, entrepriseId) => chantierCtrl.getIncidentsOuvertsByEntreprise(e, entrepriseId))

secureHandle('affectations:byChantier', rolesChantiers, (e, chantierId) => chantierCtrl.getAffectationsByChantier(e, chantierId))
secureHandle('affectations:create', rolesChantiers, (e, data) => chantierCtrl.createAffectation(e, data))
secureHandle('affectations:update', rolesChantiers, (e, id, data) => chantierCtrl.updateAffectation(e, id, data))
secureHandle('affectations:delete', rolesChantiers, (e, id) => chantierCtrl.deleteAffectation(e, id))

// ============================================================
// RESSOURCES HUMAINES
// ============================================================
const rolesRH = permissions.PERMISSIONS.employes.read;

const rolesEmployesRead = ['ADMIN', 'RH', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET', 'COMPTABLE'];
const rolesEmployesWrite = ['ADMIN', 'RH'];

secureHandle('employes:list', rolesEmployesRead, (e, params) => rhCtrl.getListEmployes(e, params))
secureHandle('employes:get', rolesEmployesRead, (e, id) => rhCtrl.getEmployeById(e, id))
secureHandle('employes:create', rolesEmployesWrite, (e, data, entrepriseId) => rhCtrl.createEmploye(e, data, entrepriseId))
secureHandle('employes:update', rolesEmployesWrite, (e, id, data) => rhCtrl.updateEmploye(e, id, data))
secureHandle('employes:delete', rolesEmployesWrite, (e, id) => rhCtrl.deleteEmploye(e, id))
secureHandle('employes:presentsToday', rolesEmployesRead, (e, entrepriseId) => rhCtrl.getPresentsToday(e, entrepriseId))
secureHandle('employes:pointer', ['ADMIN', 'RH', 'CHEF_CHANTIER'], (e, data) => rhCtrl.pointer(e, data))
secureHandle('employes:stats', rolesEmployesRead, (e, entrepriseId) => rhCtrl.getStatsEmployes(e, entrepriseId))
secureHandle('employes:changerPoste', rolesEmployesWrite, (e, employeId, data) => safeRepo(() => repos.employes.changerPoste(employeId, data)))
secureHandle('employes:historiquePoste', rolesEmployesRead, (e, employeId) => safeRepo(() => repos.historiquePostes.getByEmploye(employeId)))

secureHandle('pointages:list', rolesRH, (e, params) => rhCtrl.getListPointages(e, params))
secureHandle('pointages:create', rolesRH, (e, data) => rhCtrl.createPointage(e, data))
secureHandle('pointages:update', rolesRH, (e, id, data) => safeRepo(() => repos.pointages.update(id, data)))
secureHandle('pointages:delete', rolesRH, (e, id) => safeRepo(() => repos.pointages.delete(id)))

secureHandle('heures-sup:list', rolesRH, (e, params) => rhCtrl.getListHeuresSup(e, params))
secureHandle('heures-sup:create', rolesRH, (e, data) => rhCtrl.createHeureSup(e, data))
secureHandle('heures-sup:update', rolesRH, (e, id, data) => safeRepo(() => repos.heuresSup.update(id, data)))
secureHandle('heures-sup:delete', rolesRH, (e, id) => safeRepo(() => repos.heuresSup.delete(id)))

secureHandle('equipes:list', rolesRH, (e, entrepriseId) => rhCtrl.getListEquipes(e, entrepriseId))
secureHandle('equipes:create', rolesRH, (e, data, entrepriseId) => rhCtrl.createEquipe(e, data, entrepriseId))
secureHandle('equipes:update', rolesRH, (e, id, data) => safeRepo(() => repos.equipes.update(id, data)))
secureHandle('equipes:delete', rolesRH, (e, id) => safeRepo(() => repos.equipes.delete(id)))
secureHandle('equipes:ajouterMembre', rolesRH, (e, equipeId, employeId) => safeRepo(() => repos.equipes.ajouterMembre(equipeId, employeId)))
secureHandle('equipes:retirerMembre', rolesRH, (e, membreId) => safeRepo(() => repos.equipes.retirerMembre(membreId)))
secureHandle('equipes:assignerChantier', rolesRH, (e, data) => safeRepo(() => repos.equipes.assignerChantier(data)))

// ============================================================
// STOCKS & FOURNISSEURS
// ============================================================
const rolesStocks = permissions.PERMISSIONS.articles;
const rolesStocksWrite = Array.isArray(rolesStocks) ? rolesStocks : (rolesStocks.write || []);
const rolesFournisseurs = permissions.PERMISSIONS.fournisseurs;
const rolesFournisseursWrite = Array.isArray(rolesFournisseurs) ? rolesFournisseurs : (rolesFournisseurs.write || []);

secureHandle('articles:list', rolesStocks, (e, params) => stockCtrl.getListArticles(e, params))
secureHandle('articles:get', rolesStocks, (e, id) => stockCtrl.getArticleById(e, id))
secureHandle('articles:create', rolesStocksWrite, (e, data, entrepriseId) => stockCtrl.createArticle(e, data, entrepriseId))
secureHandle('articles:update', rolesStocksWrite, (e, id, data) => stockCtrl.updateArticle(e, id, data))
secureHandle('articles:delete', rolesStocksWrite, (e, id) => stockCtrl.deleteArticle(e, id))
secureHandle('articles:enAlerte', rolesStocks, (e, entrepriseId) => stockCtrl.getArticlesEnAlerte(e, entrepriseId))
secureHandle('articles:updateStock', rolesStocksWrite, (e, articleId, qte, type, opt) => stockCtrl.updateStockArticle(e, articleId, qte, type, opt))
secureHandle('articles:stats', rolesStocks, (e, entrepriseId) => stockCtrl.getStatsArticles(e, entrepriseId))

secureHandle('fournisseurs:list', rolesFournisseurs, (e, params) => stockCtrl.getListFournisseurs(e, params))
secureHandle('fournisseurs:get', rolesFournisseurs, (e, id) => safeRepo(() => repos.fournisseurs.getById(id)))
secureHandle('fournisseurs:create', rolesFournisseursWrite, (e, data, entrepriseId) => stockCtrl.createFournisseur(e, data, entrepriseId))
secureHandle('fournisseurs:update', rolesFournisseursWrite, (e, id, data) => stockCtrl.updateFournisseur(e, id, data))
secureHandle('fournisseurs:delete', rolesFournisseursWrite, (e, id) => stockCtrl.deleteFournisseur(e, id))

secureHandle('mouvements:byArticle', rolesStocks, (e, id) => stockCtrl.getMouvementsByArticle(e, id))
secureHandle('mouvements:byChantier', rolesStocks, (e, id) => stockCtrl.getMouvementsByChantier(e, id))
secureHandle('mouvements:byPeriode', rolesStocks, (e, params) => stockCtrl.getMouvementsByPeriode(e, params.entrepriseId, params.dateDebut, params.dateFin))
secureHandle('mouvements:stats', rolesStocks, (e, params) => stockCtrl.getMouvementsStats(e, params.entrepriseId, params.dateDebut, params.dateFin))
secureHandle('mouvements:create', rolesStocksWrite, (e, data) => safeRepo(() => repos.mouvements.create(data)))
secureHandle('mouvements:delete', rolesStocksWrite, (e, id) => safeRepo(() => repos.mouvements.delete(id)))

// ============================================================
// MATÉRIELS
// ============================================================
const rolesMateriel = permissions.PERMISSIONS.materiels;
const rolesMaterielWrite = Array.isArray(rolesMateriel) ? rolesMateriel : (rolesMateriel.write || []);

secureHandle('materiels:list', rolesMateriel, (e, params) => materielCtrl.getListMateriels(e, params))
secureHandle('materiels:get', rolesMateriel, (e, id) => materielCtrl.getMaterielById(e, id))
secureHandle('materiels:create', rolesMaterielWrite, (e, data, entrepriseId) => materielCtrl.createMateriel(e, data, entrepriseId))
secureHandle('materiels:update', rolesMaterielWrite, (e, id, data) => materielCtrl.updateMateriel(e, id, data))
secureHandle('materiels:delete', rolesMaterielWrite, (e, id) => materielCtrl.deleteMateriel(e, id))
secureHandle('materiels:stats', rolesMateriel, (e, entrepriseId) => materielCtrl.getStatsMateriels(e, entrepriseId))
secureHandle('materiels:disponibles', rolesMateriel, (e, entrepriseId) => materielCtrl.getDisponibles(e, entrepriseId))
secureHandle('materiels:maintenanceEnRetard', rolesMateriel, (e, entrepriseId) => materielCtrl.getMaintenanceEnRetard(e, entrepriseId))
secureHandle('maintenances:list', rolesMateriel, (e, params) => materielCtrl.getListMaintenances(e, params))
secureHandle('maintenances:create', rolesMaterielWrite, (e, data) => materielCtrl.createMaintenance(e, data))
secureHandle('maintenances:update', rolesMaterielWrite, (e, id, data) => materielCtrl.updateMaintenance(e, id, data))

// ============================================================
// COMMERCIAL (Clients, Devis, Contrats, Factures, Paiements)
// ============================================================
const rolesCommercial = permissions.PERMISSIONS.clients;
const rolesCommercialWrite = Array.isArray(rolesCommercial) ? rolesCommercial : (rolesCommercial.write || []);

secureHandle('clients:list', rolesCommercial, (e, params) => commercialCtrl.getListClients(e, params))
secureHandle('clients:get', rolesCommercial, (e, id) => commercialCtrl.getClientById(e, id))
secureHandle('clients:create', rolesCommercialWrite, (e, data, entrepriseId) => commercialCtrl.createClient(e, data, entrepriseId))
secureHandle('clients:update', rolesCommercialWrite, (e, id, data) => commercialCtrl.updateClient(e, id, data))
secureHandle('clients:delete', rolesCommercialWrite, (e, id) => commercialCtrl.deleteClient(e, id))

secureHandle('clientAdresses:list', rolesCommercial, (e, clientId) => commercialCtrl.getClientAdresses(e, clientId))
secureHandle('clientAdresses:create', rolesCommercialWrite, (e, clientId, data) => commercialCtrl.createClientAdresse(e, clientId, data))
secureHandle('clientAdresses:update', rolesCommercialWrite, (e, id, data) => commercialCtrl.updateClientAdresse(e, id, data))
secureHandle('clientAdresses:delete', rolesCommercialWrite, (e, id) => commercialCtrl.deleteClientAdresse(e, id))

secureHandle('devis:list', rolesCommercial, (e, params) => commercialCtrl.getListDevis(e, params))
secureHandle('devis:get', rolesCommercial, (e, id) => commercialCtrl.getDevisById(e, id))
secureHandle('devis:create', rolesCommercialWrite, (e, data, entrepriseId) => commercialCtrl.createDevis(e, data, entrepriseId))
secureHandle('devis:update', rolesCommercialWrite, (e, id, data) => commercialCtrl.updateDevis(e, id, data))
secureHandle('devis:delete', rolesCommercialWrite, (e, id) => safeRepo(() => repos.devis.delete(id)))
secureHandle('devis:transformerEnContrat', rolesCommercialWrite, (e, devisId, data) => commercialCtrl.transformerDevisEnContrat(e, devisId, data))
secureHandle('devis:saveLignes', rolesCommercialWrite, (e, devisId, lignes) => safeRepo(() => {
  // Supprimer les anciennes lignes et recréer
  const existing = repos.lignesDevis.getByDevis(devisId)
  if (existing) existing.forEach(l => repos.lignesDevis.delete(l.id))
  lignes.forEach(l => repos.lignesDevis.create({ ...l, devisId }))
  return { saved: lignes.length }
}))

secureHandle('contrats:list', rolesCommercial, (e, params) => commercialCtrl.getListContrats(e, params))
secureHandle('contrats:get', rolesCommercial, (e, id) => commercialCtrl.getContratById(e, id))
secureHandle('contrats:create', rolesCommercialWrite, (e, data) => safeRepo(() => repos.contrats.create(data)))
secureHandle('contrats:update', rolesCommercialWrite, (e, id, data) => safeRepo(() => repos.contrats.update(id, data)))
secureHandle('contrats:delete', rolesCommercialWrite, (e, id) => safeRepo(() => repos.contrats.delete(id)))

secureHandle('factures:list', rolesCommercial, (e, params) => commercialCtrl.getListFactures(e, params))
secureHandle('factures:get', rolesCommercial, (e, id) => commercialCtrl.getFactureById(e, id))
secureHandle('factures:create', rolesCommercialWrite, (e, data, entrepriseId) => commercialCtrl.createFacture(e, data, entrepriseId))
secureHandle('factures:update', rolesCommercialWrite, (e, id, data) => commercialCtrl.updateFacture(e, id, data))
secureHandle('factures:delete', rolesCommercialWrite, (e, id) => commercialCtrl.deleteFacture(e, id))
secureHandle('factures:enRetard', rolesCommercial, (e, entrepriseId) => commercialCtrl.getFacturesEnRetard(e, entrepriseId))
secureHandle('factures:ajouterPaiement', rolesCommercialWrite, (e, factureId, data) => commercialCtrl.ajouterPaiementFacture(e, factureId, data))

secureHandle('paiements:byFacture', rolesCommercial, (e, id) => commercialCtrl.getPaiementsByFacture(e, id))
secureHandle('paiements:list', rolesCommercial, (e, params) => safeRepo(() => repos.paiements.list(params)))
secureHandle('paiements:create', rolesCommercialWrite, (e, data) => safeRepo(() => repos.paiements.create(data)))
secureHandle('paiements:update', rolesCommercialWrite, (e, id, data) => safeRepo(() => repos.paiements.update(id, data)))
secureHandle('paiements:delete', rolesCommercialWrite, (e, id) => safeRepo(() => repos.paiements.delete(id)))

// ============================================================
// FINANCE & ALERTES
// ============================================================
const rolesFinance = permissions.PERMISSIONS.factures;

const rolesDepensesRead = permissions.PERMISSIONS.depenses.read;
const rolesDepensesWrite = permissions.PERMISSIONS.depenses.write;
const rolesDepensesValidate = permissions.PERMISSIONS.depenses.validate;

secureHandle('depenses:byChantier', rolesDepensesRead, (e, id) => financeCtrl.getDepensesByChantier(e, id))
secureHandle('depenses:totalByChantier', rolesDepensesRead, (e, id) => financeCtrl.getTotalDepensesByChantier(e, id))
secureHandle('depenses:byCategorie', rolesDepensesRead, (e, id) => financeCtrl.getDepensesByCategorie(e, id))
secureHandle('depenses:enAttenteValidation', rolesDepensesValidate, (e, entrepriseId) => financeCtrl.getDepensesEnAttenteValidation(e, entrepriseId))
secureHandle('depenses:create', rolesDepensesWrite, (e, data) => safeRepo(() => repos.depenses.create(data)))
secureHandle('depenses:update', rolesDepensesWrite, (e, id, data) => safeRepo(() => repos.depenses.update(id, data)))
secureHandle('depenses:delete', rolesDepensesValidate, (e, id) => safeRepo(() => repos.depenses.delete(id)))
secureHandle('depenses:list', rolesDepensesRead, (e, params) => safeRepo(() => repos.depenses.list(params)))



// ============================================================
// DASHBOARD
// ============================================================
// Tous les utilisateurs authentifiés ont accès au dashboard, les filtres de données seront gérés plus bas
secureHandle('dashboard:stats', [], (e, entrepriseId) => dashboardCtrl.getDashboardStats(e, entrepriseId))
secureHandle('dashboard:getCAEvolution', [], (e, entrepriseId) => dashboardCtrl.getCAEvolution(e, entrepriseId))
secureHandle('dashboard:getTopChantiersBudget', [], (e, entrepriseId) => dashboardCtrl.getTopChantiersBudget(e, entrepriseId))
secureHandle('dashboard:getActiviteRecente', [], (e, entrepriseId, limit) => dashboardCtrl.getActiviteRecente(e, entrepriseId, limit))
secureHandle('dashboard:getFacturesRetard', ['ADMIN', 'COMPTABLE', 'DIRECTEUR'], (e, entrepriseId) => dashboardCtrl.getFacturesRetard(e, entrepriseId))

secureHandle('dashboard:getRHStats', ['ADMIN', 'RH', 'DIRECTEUR'], (e, entrepriseId) => dashboardCtrl.getRHStats(e, entrepriseId))
secureHandle('dashboard:getCommercialStats', ['ADMIN', 'COMMERCIAL', 'DIRECTEUR'], (e, entrepriseId) => dashboardCtrl.getCommercialStats(e, entrepriseId))
secureHandle('dashboard:getLogistiqueStats', ['ADMIN', 'MAGASINIER', 'MATERIEL', 'CHEF_CHANTIER'], (e, entrepriseId) => dashboardCtrl.getLogistiqueStats(e, entrepriseId))
secureHandle('dashboard:getTopClients', ['ADMIN', 'COMMERCIAL', 'DIRECTEUR'], (e, entrepriseId) => dashboardCtrl.getTopClients(e, entrepriseId))
secureHandle('dashboard:getCAByMois', ['ADMIN', 'COMMERCIAL', 'DIRECTEUR', 'COMPTABLE'], (e, entrepriseId) => dashboardCtrl.getCAByMois(e, entrepriseId))
secureHandle('loginHistory:list', ['ADMIN', 'DIRECTEUR'], (e, params) => safeRepo(() => {
    const { entrepriseId, limit = 100, offset = 0, utilisateurId } = params || {};
    let sql = `
      SELECT lh.*, u.nom, u.prenom, u.email, r.nom as roleNom, r.code as roleCode
      FROM LoginHistory lh
      JOIN Utilisateur u ON lh.utilisateurId = u.id
      LEFT JOIN Role r ON u.roleId = r.id AND r.is_deleted = 0
      WHERE lh.is_deleted = 0 AND lh.entrepriseId = ?
    `;
    const allParams = [entrepriseId];
    if (utilisateurId) {
      sql += ' AND lh.utilisateurId = ?';
      allParams.push(utilisateurId);
    }
    sql += ' ORDER BY lh.dateConnexion DESC LIMIT ? OFFSET ?';
    allParams.push(limit, offset);
    const items = db.prepare(sql).all(...allParams);
    const totalStmt = db.prepare('SELECT COUNT(*) as total FROM LoginHistory WHERE is_deleted = 0 AND entrepriseId = ?' + (utilisateurId ? ' AND utilisateurId = ?' : ''));
    const totalResult = utilisateurId ? totalStmt.get(entrepriseId, utilisateurId) : totalStmt.get(entrepriseId);
    return { items, total: totalResult?.total || 0 };
}))


// ============================================================
// SYNCHRONISATION
// ============================================================
ipcMain.handle('sync:getConfig', (e) => syncCtrl.getConfig(e))
ipcMain.handle('sync:setConfig', (e, config) => syncCtrl.setConfig(e, config))
ipcMain.handle('sync:getHistory', (e, limit) => syncCtrl.getHistory(e, limit))
ipcMain.handle('sync:getStatus', (e) => syncCtrl.getStatus(e))
ipcMain.handle('sync:status', () => syncService.getStatus())
ipcMain.handle('sync:push', () => syncCtrl.push())
ipcMain.handle('sync:pull', () => syncCtrl.pull())
ipcMain.handle('sync:testConnection', (e) => syncCtrl.testConnection(e))
ipcMain.handle('sync:syncNow', (e) => syncCtrl.syncNow(e))
ipcMain.handle('sync:setAutoConfig', (e, config) => syncCtrl.setAutoConfig(e, config))

// ============================================================
// PRÉFÉRENCES UTILISATEUR
// ============================================================
ipcMain.handle('preferences:get', (e, userId) => safeRepo(() => {
  const row = db.prepare('SELECT * FROM Preference WHERE userId = ?').get(userId)
  return row || {}
}))
ipcMain.handle('preferences:update', (e, userId, data) => safeRepo(() => {
  const existing = db.prepare('SELECT id FROM Preference WHERE userId = ?').get(userId)
  if (existing) {
    db.prepare(`
      UPDATE Preference 
      SET theme = @theme, langue = @langue, dateFormat = @dateFormat, devise = @devise,
          notifEmail = @notifEmail, notifPush = @notifPush, 
          notifFacturesRetard = @notifFacturesRetard, notifStockBas = @notifStockBas
      WHERE userId = @userId
    `).run({ ...data, userId })
  } else {
    db.prepare(`
      INSERT INTO Preference (
        userId, theme, langue, dateFormat, devise, 
        notifEmail, notifPush, notifFacturesRetard, notifStockBas
      ) VALUES (
        @userId, @theme, @langue, @dateFormat, @devise, 
        @notifEmail, @notifPush, @notifFacturesRetard, @notifStockBas
      )
    `).run({ ...data, userId })
  }
  return data
}))

// ============================================================
// BACKUP
// ============================================================
ipcMain.handle('backup:exportSQLite', async () => {
  try {
    const data = fs.readFileSync(dbPath)
    return new Uint8Array(data)
  } catch (err) { throw err }
})
ipcMain.handle('backup:exportSQL', async () => {
  try {
    const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all()
    let sql = ''
    tables.forEach(t => { sql += t.sql + ';\n' })
    return new Uint8Array(Buffer.from(sql))
  } catch (err) { throw err }
})
ipcMain.handle('backup:list', () => {
  try {
    if (!fs.existsSync(backupsDir)) return []
    return fs.readdirSync(backupsDir).map(f => ({ fichier: f, date: fs.statSync(path.join(backupsDir, f)).mtime, taille: fs.statSync(path.join(backupsDir, f)).size }))
  } catch { return [] }
})

// ============================================================
// AUDIT LOG
// ============================================================
secureHandle('audit:recent', ['ADMIN', 'DIRECTEUR'], (e, entrepriseId, limit) => auditCtrl.getRecent(e, entrepriseId, limit))
secureHandle('audit:byModule', ['ADMIN', 'DIRECTEUR'], (e, entrepriseId, module, limit, offset) => auditCtrl.getByModule(e, entrepriseId, module, limit, offset))
secureHandle('audit:byUtilisateur', ['ADMIN', 'DIRECTEUR'], (e, entrepriseId, utilisateurId, limit, offset) => auditCtrl.getByUtilisateur(e, entrepriseId, utilisateurId, limit, offset))

// ============================================================
// ALERTES
// ============================================================
const allRoles = ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'RH', 'CHEF_CHANTIER', 'CHEF_PROJET', 'MATERIEL', 'MAGASINIER', 'COMMERCIAL'];
const rolesAlertesWrite = ['ADMIN', 'DIRECTEUR', 'COMPTABLE'];
secureHandle('alertes:list',           allRoles, (e, p) => alerteCtrl.getList(e, p))
secureHandle('alertes:nonLues',        allRoles, (e, entId, limit) => alerteCtrl.getNonLues(e, entId, limit, getSessionRoles()[0]))
secureHandle('alertes:countNonLues',   allRoles, (e, entId) => alerteCtrl.countNonLues(e, entId))
secureHandle('alertes:markAsRead',     allRoles, (e, id) => alerteCtrl.markAsRead(e, id))
secureHandle('alertes:marquerLue',     allRoles, (e, id) => alerteCtrl.marquerLue(e, id))
secureHandle('alertes:markAllAsRead',  allRoles, (e, entId) => alerteCtrl.markAllAsRead(e, entId))
secureHandle('alertes:marquerToutesLues', allRoles, (e, entId) => alerteCtrl.markAllAsRead(e, entId))
secureHandle('alertes:creer',          rolesAlertesWrite, (e, data) => alerteCtrl.creer(e, data))
secureHandle('alertes:delete',         allRoles, (e, id) => alerteCtrl.deleteAlerte(e, id))



// ============================================================
// UTILITAIRES SYSTÈMES
// ============================================================
ipcMain.handle('app:getVersion', () => app.getVersion())
ipcMain.handle('app:openPath', async (e, targetPath) => {
  try { await shell.openPath(targetPath); return { success: true } }
  catch (error) { return { success: false, error: error.message } }
})
ipcMain.handle('app:showItemInFolder', async (e, targetPath) => {
  try { shell.showItemInFolder(targetPath); return { success: true } }
  catch (error) { return { success: false, error: error.message } }
})
ipcMain.handle('dialog:showOpenDialog', async (e, options) => {
  try { return await dialog.showOpenDialog(options) }
  catch (error) { return { canceled: true, filePaths: [] } }
})
ipcMain.handle('dialog:showSaveDialog', async (e, options) => {
  try { return await dialog.showSaveDialog(options) }
  catch (error) { return { canceled: true, filePath: '' } }
})
ipcMain.handle('notification:show', async (e, title, body) => {
  const { Notification } = require('electron')
  if (Notification.isSupported()) new Notification({ title, body }).show()
  return { success: true }
})

// ============================================================
// PDF — GÉNÉRATION LOGIN CREDENTIALS
// ============================================================

/**
 * Génère le HTML du PDF de credentials de connexion
 */
function generateLoginPDFHtml(userData) {
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const entrepriseNom = userData.entrepriseNom || 'TIA INFO BUILD';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6fb; color: #1a1a2e; padding: 0; }
    .page { width: 210mm; min-height: 297mm; padding: 30mm 25mm; background: white; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: white; padding: 28px 32px; border-radius: 12px; margin-bottom: 32px; display: flex; align-items: center; gap: 20px; }
    .header-logo { font-size: 40px; }
    .header-text h1 { font-size: 22px; font-weight: 700; letter-spacing: 1px; }
    .header-text p { font-size: 13px; opacity: 0.75; margin-top: 4px; }
    .section-title { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #6c757d; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e9ecef; }
    .credentials-box { background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 12px; padding: 28px 32px; margin-bottom: 24px; }
    .cred-row { display: flex; align-items: flex-start; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e9ecef; }
    .cred-row:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
    .cred-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-right: 16px; flex-shrink: 0; }
    .icon-person { background: #e8f4fd; }
    .icon-email { background: #e8f5e9; }
    .icon-lock { background: #fef3e2; }
    .icon-role { background: #f3e5f5; }
    .icon-date { background: #e8eaf6; }
    .cred-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #9e9e9e; margin-bottom: 4px; }
    .cred-value { font-size: 16px; font-weight: 600; color: #1a1a2e; font-family: 'Courier New', monospace; }
    .warning-box { background: linear-gradient(135deg, #fff8e1, #fff3cd); border: 1px solid #ffc107; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; display: flex; gap: 12px; align-items: flex-start; }
    .warning-icon { font-size: 20px; flex-shrink: 0; }
    .warning-text { font-size: 13px; line-height: 1.6; color: #856404; }
    .warning-text strong { display: block; margin-bottom: 4px; font-size: 14px; }
    .steps-box { border: 1px solid #dee2e6; border-radius: 10px; padding: 20px 24px; margin-bottom: 24px; }
    .steps-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #1a1a2e; }
    .step { display: flex; align-items: flex-start; margin-bottom: 10px; font-size: 13px; color: #495057; line-height: 1.5; }
    .step-num { background: #0f3460; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; margin-right: 12px; flex-shrink: 0; margin-top: 1px; }
    .footer { border-top: 1px solid #dee2e6; padding-top: 16px; display: flex; justify-content: space-between; align-items: center; color: #adb5bd; font-size: 11px; }
    .confidential { background: #dc3545; color: white; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: 1px; }
    @media print { .page { padding: 20mm 20mm; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-logo">🏗️</div>
      <div class="header-text">
        <h1>TIA INFO BUILD</h1>
        <p>${entrepriseNom} — Informations de connexion</p>
      </div>
    </div>

    <p class="section-title">Identifiants de connexion</p>
    <div class="credentials-box">
      <div class="cred-row">
        <div class="cred-icon icon-person">👤</div>
        <div>
          <div class="cred-label">Nom complet</div>
          <div class="cred-value">${userData.prenom || ''} ${userData.nom || ''}</div>
        </div>
      </div>
      <div class="cred-row">
        <div class="cred-icon icon-email">✉️</div>
        <div>
          <div class="cred-label">Identifiant (Email)</div>
          <div class="cred-value">${userData.email || ''}</div>
        </div>
      </div>
      <div class="cred-row">
        <div class="cred-icon icon-lock">🔑</div>
        <div>
          <div class="cred-label">Mot de passe temporaire</div>
          <div class="cred-value">${userData.plainPassword || '(non communiqué)'}</div>
        </div>
      </div>
      <div class="cred-row">
        <div class="cred-icon icon-role">🎭</div>
        <div>
          <div class="cred-label">Rôle dans l'application</div>
          <div class="cred-value">${userData.roleLabel || ''}</div>
        </div>
      </div>
      <div class="cred-row">
        <div class="cred-icon icon-date">📅</div>
        <div>
          <div class="cred-label">Date de création du compte</div>
          <div class="cred-value">${dateStr}</div>
        </div>
      </div>
    </div>

    <div class="warning-box">
      <div class="warning-icon">⚠️</div>
      <div class="warning-text">
        <strong>Action requise dès la première connexion</strong>
        Vous devez changer votre mot de passe après votre première connexion à l'application. Ce document est strictement confidentiel et doit être remis en mains propres au titulaire du compte.
      </div>
    </div>

    <div class="steps-box">
      <div class="steps-title">🚀 Comment se connecter</div>
      <div class="step"><div class="step-num">1</div>Lancez l'application TIA INFO BUILD sur votre poste</div>
      <div class="step"><div class="step-num">2</div>Saisissez votre adresse email et le mot de passe temporaire ci-dessus</div>
      <div class="step"><div class="step-num">3</div>Accédez à Paramètres → Mon profil pour modifier votre mot de passe</div>
      <div class="step"><div class="step-num">4</div>En cas de problème, contactez l'administrateur de votre entreprise</div>
    </div>

    <div class="footer">
      <span>Document généré le ${new Date().toLocaleString('fr-FR')} • TIA INFO BUILD v1.0</span>
      <span class="confidential">CONFIDENTIEL</span>
    </div>
  </div>
</body>
</html>`;
}

ipcMain.handle('utilisateurs:generateLoginPDF', async (event, userData) => {
  try {
    // Créer une fenêtre BrowserWindow invisible pour le rendu PDF
    const pdfWin = new BrowserWindow({
      show: false,
      width: 800,
      height: 1100,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const htmlContent = generateLoginPDFHtml(userData);
    await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    // Générer le PDF
    const pdfData = await pdfWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 }
    });

    pdfWin.close();

    // Préparer le nom de fichier par défaut
    const safeName = `${(userData.prenom || '').replace(/[^a-zA-Z0-9]/g, '_')}_${(userData.nom || '').replace(/[^a-zA-Z0-9]/g, '_')}`;
    const defaultFilename = `login_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`;

    // Dialogue de sauvegarde
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Enregistrer les informations de connexion',
      defaultPath: defaultFilename,
      filters: [{ name: 'Fichier PDF', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) {
      return { success: false, error: 'Sauvegarde annulée' };
    }

    fs.writeFileSync(filePath, pdfData);

    // Ouvrir le PDF dans le lecteur par défaut
    await shell.openPath(filePath);

    return { success: true, filePath };
  } catch (error) {
    console.error('utilisateurs:generateLoginPDF error:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================
// APP LIFECYCLE
// ============================================================
app.whenReady().then(() => {
  initDatabase()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

process.on('uncaughtException', (error) => { console.error('Uncaught Exception:', error) })
process.on('unhandledRejection', (reason, promise) => { console.error('Unhandled Rejection:', reason) })
