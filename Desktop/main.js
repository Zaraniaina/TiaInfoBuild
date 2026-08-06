// Desktop/main.js
const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron')
const path = require('path')
const { initDatabase } = require('./models/init')
const fs = require('fs')
const db = require('./models/db')

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
  utilisateurs: new UtilisateurRepository()
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

ipcMain.handle('session:get', async () => ({ success: true, data: _session }))
// Suppression de session:set qui permettait au frontend d'usurper une session
ipcMain.handle('session:clear', async () => { _session = null; return { success: true } })

// ============================================================
// UTILISATEURS & RÔLES
// ============================================================
const rolesAdminRh = ['ADMIN', 'RH'];

secureHandle('utilisateurs:list', rolesAdminRh, (e, params) => utilisateurCtrl.getList(e, params))
secureHandle('utilisateurs:getAll', rolesAdminRh, (e, params) => utilisateurCtrl.getList(e, params))
secureHandle('utilisateurs:get', rolesAdminRh, (e, id) => utilisateurCtrl.getById(e, id))
secureHandle('utilisateurs:create', rolesAdminRh, (e, data, entId) => utilisateurCtrl.create(e, data, entId))
secureHandle('utilisateurs:update', rolesAdminRh, (e, id, data) => utilisateurCtrl.update(e, id, data))
secureHandle('utilisateurs:delete', rolesAdminRh, (e, id) => utilisateurCtrl.delete(e, id))
secureHandle('users:list', rolesAdminRh, (e, params) => utilisateurCtrl.getList(e, params))
secureHandle('users:getAll', rolesAdminRh, (e, params) => utilisateurCtrl.getList(e, params))
secureHandle('users:get', rolesAdminRh, (e, id) => utilisateurCtrl.getById(e, id))
secureHandle('users:create', rolesAdminRh, (e, data, entId) => utilisateurCtrl.create(e, data, entId))
secureHandle('users:update', rolesAdminRh, (e, id, data) => utilisateurCtrl.update(e, id, data))
secureHandle('users:delete', rolesAdminRh, (e, id) => utilisateurCtrl.delete(e, id))
secureHandle('roles:list', rolesAdminRh, async () => {
  try {
    const roles = db.prepare("SELECT * FROM Role WHERE is_deleted = 0").all()
    return { success: true, data: roles }
  } catch (err) { return { success: false, error: err.message } }
})

// ============================================================
// ENTREPRISE
// ============================================================
const rolesAdminDg = ['ADMIN', 'DIRECTEUR'];

secureHandle('entreprises:get', [], (e, id) => {
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
const rolesChantiers = ['ADMIN', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET'];

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
const rolesRH = ['ADMIN', 'RH', 'DIRECTEUR', 'CHEF_CHANTIER', 'CHEF_PROJET', 'COMPTABLE'];

secureHandle('employes:list', rolesRH, (e, params) => rhCtrl.getListEmployes(e, params))
secureHandle('employes:get', rolesRH, (e, id) => rhCtrl.getEmployeById(e, id))
secureHandle('employes:create', rolesRH, (e, data, entrepriseId) => rhCtrl.createEmploye(e, data, entrepriseId))
secureHandle('employes:update', rolesRH, (e, id, data) => rhCtrl.updateEmploye(e, id, data))
secureHandle('employes:delete', rolesRH, (e, id) => rhCtrl.deleteEmploye(e, id))
secureHandle('employes:presentsToday', rolesRH, (e, entrepriseId) => rhCtrl.getPresentsToday(e, entrepriseId))
secureHandle('employes:pointer', rolesRH, (e, data) => rhCtrl.pointer(e, data))
secureHandle('employes:stats', rolesRH, (e, entrepriseId) => rhCtrl.getStatsEmployes(e, entrepriseId))

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
const rolesStocks = ['ADMIN', 'MAGASINIER', 'CHEF_CHANTIER'];

secureHandle('articles:list', rolesStocks, (e, params) => stockCtrl.getListArticles(e, params))
secureHandle('articles:get', rolesStocks, (e, id) => stockCtrl.getArticleById(e, id))
secureHandle('articles:create', rolesStocks, (e, data, entrepriseId) => stockCtrl.createArticle(e, data, entrepriseId))
secureHandle('articles:update', rolesStocks, (e, id, data) => stockCtrl.updateArticle(e, id, data))
secureHandle('articles:delete', rolesStocks, (e, id) => stockCtrl.deleteArticle(e, id))
secureHandle('articles:enAlerte', rolesStocks, (e, entrepriseId) => stockCtrl.getArticlesEnAlerte(e, entrepriseId))
secureHandle('articles:updateStock', rolesStocks, (e, articleId, qte, type, opt) => stockCtrl.updateStockArticle(e, articleId, qte, type, opt))
secureHandle('articles:stats', rolesStocks, (e, entrepriseId) => stockCtrl.getStatsArticles(e, entrepriseId))

secureHandle('fournisseurs:list', rolesStocks, (e, params) => stockCtrl.getListFournisseurs(e, params))
secureHandle('fournisseurs:get', rolesStocks, (e, id) => safeRepo(() => repos.fournisseurs.getById(id)))
secureHandle('fournisseurs:create', rolesStocks, (e, data, entrepriseId) => stockCtrl.createFournisseur(e, data, entrepriseId))
secureHandle('fournisseurs:update', rolesStocks, (e, id, data) => stockCtrl.updateFournisseur(e, id, data))
secureHandle('fournisseurs:delete', rolesStocks, (e, id) => stockCtrl.deleteFournisseur(e, id))

secureHandle('mouvements:byArticle', rolesStocks, (e, id) => stockCtrl.getMouvementsByArticle(e, id))
secureHandle('mouvements:byChantier', rolesStocks, (e, id) => stockCtrl.getMouvementsByChantier(e, id))
secureHandle('mouvements:byPeriode', rolesStocks, (e, params) => stockCtrl.getMouvementsByPeriode(e, params.entrepriseId, params.dateDebut, params.dateFin))
secureHandle('mouvements:stats', rolesStocks, (e, params) => stockCtrl.getMouvementsStats(e, params.entrepriseId, params.dateDebut, params.dateFin))
secureHandle('mouvements:create', rolesStocks, (e, data) => safeRepo(() => repos.mouvements.create(data)))
secureHandle('mouvements:delete', rolesStocks, (e, id) => safeRepo(() => repos.mouvements.delete(id)))

// ============================================================
// MATÉRIELS
// ============================================================
const rolesMateriel = ['ADMIN', 'MATERIEL', 'CHEF_CHANTIER'];

secureHandle('materiels:list', rolesMateriel, (e, params) => materielCtrl.getListMateriels(e, params))
secureHandle('materiels:get', rolesMateriel, (e, id) => materielCtrl.getMaterielById(e, id))
secureHandle('materiels:create', rolesMateriel, (e, data, entrepriseId) => materielCtrl.createMateriel(e, data, entrepriseId))
secureHandle('materiels:update', rolesMateriel, (e, id, data) => materielCtrl.updateMateriel(e, id, data))
secureHandle('materiels:delete', rolesMateriel, (e, id) => materielCtrl.deleteMateriel(e, id))
secureHandle('materiels:stats', rolesMateriel, (e, entrepriseId) => materielCtrl.getStatsMateriels(e, entrepriseId))
secureHandle('materiels:disponibles', rolesMateriel, (e, entrepriseId) => materielCtrl.getDisponibles(e, entrepriseId))
secureHandle('materiels:maintenanceEnRetard', rolesMateriel, (e, entrepriseId) => materielCtrl.getMaintenanceEnRetard(e, entrepriseId))
secureHandle('maintenances:list', rolesMateriel, (e, params) => materielCtrl.getListMaintenances(e, params))
secureHandle('maintenances:create', rolesMateriel, (e, data) => materielCtrl.createMaintenance(e, data))
secureHandle('maintenances:update', rolesMateriel, (e, id, data) => materielCtrl.updateMaintenance(e, id, data))

// ============================================================
// COMMERCIAL (Clients, Devis, Contrats, Factures, Paiements)
// ============================================================
const rolesCommercial = ['ADMIN', 'COMMERCIAL', 'DIRECTION', 'COMPTABLE'];

secureHandle('clients:list', rolesCommercial, (e, params) => commercialCtrl.getListClients(e, params))
secureHandle('clients:get', rolesCommercial, (e, id) => commercialCtrl.getClientById(e, id))
secureHandle('clients:create', rolesCommercial, (e, data, entrepriseId) => commercialCtrl.createClient(e, data, entrepriseId))
secureHandle('clients:update', rolesCommercial, (e, id, data) => commercialCtrl.updateClient(e, id, data))
secureHandle('clients:delete', rolesCommercial, (e, id) => commercialCtrl.deleteClient(e, id))

secureHandle('clientAdresses:list', rolesCommercial, (e, clientId) => commercialCtrl.getClientAdresses(e, clientId))
secureHandle('clientAdresses:create', rolesCommercial, (e, clientId, data) => commercialCtrl.createClientAdresse(e, clientId, data))
secureHandle('clientAdresses:update', rolesCommercial, (e, id, data) => commercialCtrl.updateClientAdresse(e, id, data))
secureHandle('clientAdresses:delete', rolesCommercial, (e, id) => commercialCtrl.deleteClientAdresse(e, id))

secureHandle('devis:list', rolesCommercial, (e, params) => commercialCtrl.getListDevis(e, params))
secureHandle('devis:get', rolesCommercial, (e, id) => commercialCtrl.getDevisById(e, id))
secureHandle('devis:create', rolesCommercial, (e, data, entrepriseId) => commercialCtrl.createDevis(e, data, entrepriseId))
secureHandle('devis:update', rolesCommercial, (e, id, data) => commercialCtrl.updateDevis(e, id, data))
secureHandle('devis:delete', rolesCommercial, (e, id) => safeRepo(() => repos.devis.delete(id)))
secureHandle('devis:transformerEnContrat', rolesCommercial, (e, devisId, data) => commercialCtrl.transformerDevisEnContrat(e, devisId, data))
secureHandle('devis:saveLignes', rolesCommercial, (e, devisId, lignes) => safeRepo(() => {
  // Supprimer les anciennes lignes et recréer
  const existing = repos.lignesDevis.getByDevis(devisId)
  if (existing) existing.forEach(l => repos.lignesDevis.delete(l.id))
  lignes.forEach(l => repos.lignesDevis.create({ ...l, devisId }))
  return { saved: lignes.length }
}))

secureHandle('contrats:list', rolesCommercial, (e, params) => commercialCtrl.getListContrats(e, params))
secureHandle('contrats:get', rolesCommercial, (e, id) => commercialCtrl.getContratById(e, id))
secureHandle('contrats:create', rolesCommercial, (e, data) => safeRepo(() => repos.contrats.create(data)))
secureHandle('contrats:update', rolesCommercial, (e, id, data) => safeRepo(() => repos.contrats.update(id, data)))
secureHandle('contrats:delete', rolesCommercial, (e, id) => safeRepo(() => repos.contrats.delete(id)))

secureHandle('factures:list', rolesCommercial, (e, params) => commercialCtrl.getListFactures(e, params))
secureHandle('factures:get', rolesCommercial, (e, id) => commercialCtrl.getFactureById(e, id))
secureHandle('factures:create', rolesCommercial, (e, data, entrepriseId) => commercialCtrl.createFacture(e, data, entrepriseId))
secureHandle('factures:update', rolesCommercial, (e, id, data) => commercialCtrl.updateFacture(e, id, data))
secureHandle('factures:delete', rolesCommercial, (e, id) => commercialCtrl.deleteFacture(e, id))
secureHandle('factures:enRetard', rolesCommercial, (e, entrepriseId) => commercialCtrl.getFacturesEnRetard(e, entrepriseId))
secureHandle('factures:ajouterPaiement', rolesCommercial, (e, factureId, data) => commercialCtrl.ajouterPaiementFacture(e, factureId, data))

secureHandle('paiements:byFacture', rolesCommercial, (e, id) => commercialCtrl.getPaiementsByFacture(e, id))
secureHandle('paiements:list', rolesCommercial, (e, params) => safeRepo(() => repos.paiements.list(params)))
secureHandle('paiements:create', rolesCommercial, (e, data) => safeRepo(() => repos.paiements.create(data)))
secureHandle('paiements:update', rolesCommercial, (e, id, data) => safeRepo(() => repos.paiements.update(id, data)))
secureHandle('paiements:delete', rolesCommercial, (e, id) => safeRepo(() => repos.paiements.delete(id)))

// ============================================================
// FINANCE & ALERTES
// ============================================================
const rolesFinance = ['ADMIN', 'COMPTABLE', 'DIRECTEUR'];

secureHandle('depenses:byChantier', rolesFinance, (e, id) => financeCtrl.getDepensesByChantier(e, id))
secureHandle('depenses:totalByChantier', rolesFinance, (e, id) => financeCtrl.getTotalDepensesByChantier(e, id))
secureHandle('depenses:byCategorie', rolesFinance, (e, id) => financeCtrl.getDepensesByCategorie(e, id))
secureHandle('depenses:enAttenteValidation', rolesFinance, (e, entrepriseId) => financeCtrl.getDepensesEnAttenteValidation(e, entrepriseId))
secureHandle('depenses:create', rolesFinance, (e, data) => safeRepo(() => repos.depenses.create(data)))
secureHandle('depenses:update', rolesFinance, (e, id, data) => safeRepo(() => repos.depenses.update(id, data)))
secureHandle('depenses:delete', rolesFinance, (e, id) => safeRepo(() => repos.depenses.delete(id)))
secureHandle('depenses:list', rolesFinance, (e, params) => safeRepo(() => repos.depenses.list(params)))

secureHandle('alertes:nonLues', [], (e, entrepriseId, limit) => financeCtrl.getAlertesNonLues(e, entrepriseId, limit))
secureHandle('alertes:marquerLue', [], (e, id) => financeCtrl.marquerAlerteLue(e, id))
secureHandle('alertes:marquerToutesLues', [], (e, entrepriseId) => financeCtrl.marquerToutesAlertesLues(e, entrepriseId))
secureHandle('alertes:creer', [], (e, data) => financeCtrl.creerAlerte(e, data))
secureHandle('alertes:countNonLues', [], (e, entrepriseId) => financeCtrl.countAlertesNonLues(e, entrepriseId))
secureHandle('alertes:list', [], (e, params) => safeRepo(() => repos.alertes.list(params)))

// ============================================================
// DASHBOARD
// ============================================================
// Tous les utilisateurs authentifiés ont accès au dashboard, les filtres de données seront gérés plus bas
secureHandle('dashboard:stats', [], (e, entrepriseId) => dashboardCtrl.getDashboardStats(e, entrepriseId))
secureHandle('dashboard:getCAEvolution', [], (e, entrepriseId) => dashboardCtrl.getCAEvolution(e, entrepriseId))
secureHandle('dashboard:getTopChantiersBudget', [], (e, entrepriseId) => dashboardCtrl.getTopChantiersBudget(e, entrepriseId))
secureHandle('dashboard:getActiviteRecente', [], (e, entrepriseId, limit) => dashboardCtrl.getActiviteRecente(e, entrepriseId, limit))

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