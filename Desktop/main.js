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
const PhotoChantierRepository = require('./models/repositories/PhotoChantierRepository')
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
const BudgetPrevisionnelRepository = require('./models/repositories/BudgetPrevisionnelRepository')
const SousTraitantRepository = require('./models/repositories/SousTraitantRepository')
const CatalogueDevisRepository = require('./models/repositories/CatalogueDevisRepository')
const NotificationRepository = require('./models/repositories/NotificationRepository')

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
const BudgetController = require('./controllers/budgetController')
const SousTraitantController = require('./controllers/sousTraitantController')
const CatalogueController = require('./controllers/catalogueController')
const NotificationController = require('./controllers/notificationController')

// Services
const SyncService = require('./services/syncService')
const { sendInvoiceEmail } = require('./services/emailService')

// Instanciation unique de tous les repositories
const repos = {
  chantiers: new ChantierRepository(),
  affectations: new AffectationRessourceRepository(),
  phases: new PhaseRepository(),
  incidents: new IncidentRepository(),
  photosChantier: new PhotoChantierRepository(),
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
  auditLog: new AuditLogRepository(),
  budgetPrevisionnels: new BudgetPrevisionnelRepository(),
  sousTraitants: new SousTraitantRepository(),
  catalogues: new CatalogueDevisRepository(),
  notifications: new NotificationRepository()
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
const budgetCtrl = new BudgetController(repos)
const sousTraitantCtrl = new SousTraitantController(repos)
const catalogueCtrl = new CatalogueController(repos)
const notificationCtrl = new NotificationController(repos)

// Instanciation des services
const syncService = new SyncService(repos.sync)

const dbPath = path.join(__dirname, 'tia_info_build.sqlite')

function createWindow() {
  Menu.setApplicationMenu(null)
  const backupsDir = path.join(app.getPath('userData'), 'backups')
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true })
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
  DIRECTEUR: ['direction', 'daf', 'directeur', 'direction générale'],
  COMPTABLE: ['comptable', 'finance'],
  RH: ['rh', 'responsable rh', 'responsable_rh'],
  MATERIEL: ['materiel', 'logisticien'],
  MAGASINIER: ['magasinier', 'stock'],
  COMMERCIAL: ['commercial'],
  CHEF_CHANTIER: ['chef de chantier', 'conducteur', 'chef_chantier'],
  CHEF_PROJET: ['chef de projet', 'chef_projet', 'directeur technique']
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
      'factures:ajouterPaiement', 'factures:envoyer', 'factures:dupliquer',
      'entreprises:update',
      'photos:create', 'photos:delete',
      'backup:import', 'backup:restore', 'backup:delete',
      'budgets:create', 'budgets:update', 'budgets:delete',
      'sous-traitants:create', 'sous-traitants:update', 'sous-traitants:delete',
      'catalogues:create', 'catalogues:update', 'catalogues:delete',
      'notifications:create', 'notifications:update', 'notifications:delete'
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
    const allowed = ['nom','nomCommercial','siret','numeroTVA','codeAPE','adresse','codePostal','ville','telephone','email','siteWeb','prefixeDevis','prefixeFacture','prefixeContrat','tvaDefaut','delaiPaiementDefaut','validiteDevis','mentionsLegales','devise','smtpHost','smtpPort','smtpUser','smtpPass','smtpFrom','smtpSecure']
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
const rolesChantiers = permissions.PERMISSIONS.chantiers.read;
const rolesChantiersWrite = permissions.PERMISSIONS.chantiers.write;

secureHandle('chantiers:list', rolesChantiers, (e, params) => chantierCtrl.getList(e, params))
secureHandle('chantiers:get', rolesChantiers, (e, id) => chantierCtrl.getById(e, id))
secureHandle('chantiers:create', rolesChantiersWrite, (e, data, entrepriseId) => chantierCtrl.create(e, data, entrepriseId))
secureHandle('chantiers:update', rolesChantiersWrite, (e, id, data) => chantierCtrl.update(e, id, data))
secureHandle('chantiers:delete', rolesChantiersWrite, (e, id) => chantierCtrl.delete(e, id))
secureHandle('chantiers:stats', rolesChantiers, (e, entrepriseId) => chantierCtrl.getStats(e, entrepriseId))
secureHandle('chantiers:addPhase', rolesChantiersWrite, (e, chantierId, data) => chantierCtrl.addPhase(e, chantierId, data))
secureHandle('chantiers:savePhases', rolesChantiersWrite, (e, chantierId, phases) => chantierCtrl.savePhases(e, chantierId, phases))
secureHandle('chantiers:addIncident', rolesChantiersWrite, (e, chantierId, data, userId) => chantierCtrl.addIncident(e, chantierId, data, userId))
secureHandle('chantiers:updateIncident', rolesChantiersWrite, (e, id, data) => chantierCtrl.updateIncident(e, id, data))
secureHandle('chantiers:deleteIncident', rolesChantiersWrite, (e, id) => chantierCtrl.deleteIncident(e, id))
secureHandle('chantiers:recalculerBudget', rolesChantiersWrite, (e, chantierId) => chantierCtrl.recalculerBudget(e, chantierId))
secureHandle('chantiers:addAffectation', rolesChantiersWrite, (e, data) => chantierCtrl.createAffectation(e, data))
secureHandle('chantiers:updateAffectation', rolesChantiersWrite, (e, id, data) => chantierCtrl.updateAffectation(e, id, data))
secureHandle('chantiers:deleteAffectation', rolesChantiersWrite, (e, id) => chantierCtrl.deleteAffectation(e, id))

secureHandle('phases:list', rolesChantiers, (e, chantierId) => chantierCtrl.getPhasesByChantier(e, chantierId))
secureHandle('phases:create', rolesChantiersWrite, (e, data) => chantierCtrl.createPhase(e, data))
secureHandle('phases:update', rolesChantiersWrite, (e, id, data) => chantierCtrl.updatePhase(e, id, data))
secureHandle('phases:delete', rolesChantiersWrite, (e, id) => chantierCtrl.deletePhase(e, id))
secureHandle('phases:updateAvancement', rolesChantiersWrite, (e, id, pct) => chantierCtrl.updatePhaseAvancement(e, id, pct))
secureHandle('phases:reorder', rolesChantiersWrite, (e, chantierId, ids) => chantierCtrl.reorderPhases(e, chantierId, ids))
secureHandle('phases:avancementGlobal', rolesChantiers, (e, chantierId) => chantierCtrl.getAvancementGlobalPhases(e, chantierId))

secureHandle('incidents:list', rolesChantiers, (e, chantierId) => chantierCtrl.getIncidentsByChantier(e, chantierId))
secureHandle('incidents:create', rolesChantiersWrite, (e, data) => chantierCtrl.createIncident(e, data))
secureHandle('incidents:update', rolesChantiersWrite, (e, id, data) => chantierCtrl.updateIncident(e, id, data))
secureHandle('incidents:delete', rolesChantiersWrite, (e, id) => chantierCtrl.deleteIncident(e, id))
secureHandle('incidents:changerStatut', rolesChantiersWrite, (e, id, statut) => chantierCtrl.changerStatutIncident(e, id, statut))
secureHandle('incidents:ouvertsByEntreprise', rolesChantiers, (e, entrepriseId) => chantierCtrl.getIncidentsOuvertsByEntreprise(e, entrepriseId))

secureHandle('affectations:byChantier', rolesChantiers, (e, chantierId) => chantierCtrl.getAffectationsByChantier(e, chantierId))
secureHandle('affectations:create', rolesChantiersWrite, (e, data) => chantierCtrl.createAffectation(e, data))
secureHandle('affectations:update', rolesChantiersWrite, (e, id, data) => chantierCtrl.updateAffectation(e, id, data))
secureHandle('affectations:delete', rolesChantiersWrite, (e, id) => chantierCtrl.deleteAffectation(e, id))

secureHandle('photos:list', rolesChantiers, (e, chantierId) => chantierCtrl.getPhotos(e, chantierId))
secureHandle('photos:create', rolesChantiersWrite, (e, chantierId, data, entrepriseId) => chantierCtrl.createPhoto(e, chantierId, data, entrepriseId))
secureHandle('photos:delete', rolesChantiersWrite, (e, id) => chantierCtrl.deletePhoto(e, id))

// ============================================================
// RESSOURCES HUMAINES
// ============================================================
const rolesEmployesRead = permissions.PERMISSIONS.employes.read;
const rolesEmployesWrite = permissions.PERMISSIONS.employes.write;
const rolesPointagesRead = permissions.PERMISSIONS.pointages.read;
const rolesPointagesWrite = permissions.PERMISSIONS.pointages.write;
const rolesHeuresSupRead = permissions.PERMISSIONS.heuresSup.read;
const rolesHeuresSupWrite = permissions.PERMISSIONS.heuresSup.write;
const rolesEquipesRead = permissions.PERMISSIONS.equipes.read;
const rolesEquipesWrite = permissions.PERMISSIONS.equipes.write;

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

secureHandle('pointages:list', rolesPointagesRead, (e, params) => rhCtrl.getListPointages(e, params))
secureHandle('pointages:create', rolesPointagesWrite, (e, data) => rhCtrl.createPointage(e, data))
secureHandle('pointages:update', rolesPointagesWrite, (e, id, data) => safeRepo(() => repos.pointages.update(id, data)))
secureHandle('pointages:delete', rolesPointagesWrite, (e, id) => safeRepo(() => repos.pointages.delete(id)))

secureHandle('heures-sup:list', rolesHeuresSupRead, (e, params) => rhCtrl.getListHeuresSup(e, params))
secureHandle('heures-sup:create', rolesHeuresSupWrite, (e, data) => rhCtrl.createHeureSup(e, data))
secureHandle('heures-sup:update', rolesHeuresSupWrite, (e, id, data) => safeRepo(() => repos.heuresSup.update(id, data)))
secureHandle('heures-sup:delete', rolesHeuresSupWrite, (e, id) => safeRepo(() => repos.heuresSup.delete(id)))

secureHandle('equipes:list', rolesEquipesRead, (e, entrepriseId) => rhCtrl.getListEquipes(e, entrepriseId))
secureHandle('equipes:create', rolesEquipesWrite, (e, data, entrepriseId) => rhCtrl.createEquipe(e, data, entrepriseId))
secureHandle('equipes:update', rolesEquipesWrite, (e, id, data) => safeRepo(() => repos.equipes.update(id, data)))
secureHandle('equipes:delete', rolesEquipesWrite, (e, id) => safeRepo(() => repos.equipes.delete(id)))
secureHandle('equipes:ajouterMembre', rolesEquipesWrite, (e, equipeId, employeId) => safeRepo(() => repos.equipes.ajouterMembre(equipeId, employeId)))
secureHandle('equipes:retirerMembre', rolesEquipesWrite, (e, membreId) => safeRepo(() => repos.equipes.retirerMembre(membreId)))
secureHandle('equipes:assignerChantier', rolesEquipesWrite, (e, data) => safeRepo(() => repos.equipes.assignerChantier(data)))

// ============================================================
// STOCKS & FOURNISSEURS
// ============================================================
const rolesArticlesRead = permissions.PERMISSIONS.articles.read;
const rolesArticlesWrite = permissions.PERMISSIONS.articles.write;
const rolesFournisseursRead = permissions.PERMISSIONS.fournisseurs.read;
const rolesFournisseursWrite = permissions.PERMISSIONS.fournisseurs.write;

secureHandle('articles:list', rolesArticlesRead, (e, params) => stockCtrl.getListArticles(e, params))
secureHandle('articles:get', rolesArticlesRead, (e, id) => stockCtrl.getArticleById(e, id))
secureHandle('articles:create', rolesArticlesWrite, (e, data, entrepriseId) => stockCtrl.createArticle(e, data, entrepriseId))
secureHandle('articles:update', rolesArticlesWrite, (e, id, data) => stockCtrl.updateArticle(e, id, data))
secureHandle('articles:delete', rolesArticlesWrite, (e, id) => stockCtrl.deleteArticle(e, id))
secureHandle('articles:enAlerte', rolesArticlesRead, (e, entrepriseId) => stockCtrl.getArticlesEnAlerte(e, entrepriseId))
secureHandle('articles:updateStock', rolesArticlesWrite, (e, articleId, qte, type, opt) => stockCtrl.updateStockArticle(e, articleId, qte, type, opt))
secureHandle('articles:stats', rolesArticlesRead, (e, entrepriseId) => stockCtrl.getStatsArticles(e, entrepriseId))

secureHandle('fournisseurs:list', rolesFournisseursRead, (e, params) => stockCtrl.getListFournisseurs(e, params))
secureHandle('fournisseurs:get', rolesFournisseursRead, (e, id) => safeRepo(() => repos.fournisseurs.getById(id)))
secureHandle('fournisseurs:create', rolesFournisseursWrite, (e, data, entrepriseId) => stockCtrl.createFournisseur(e, data, entrepriseId))
secureHandle('fournisseurs:update', rolesFournisseursWrite, (e, id, data) => stockCtrl.updateFournisseur(e, id, data))
secureHandle('fournisseurs:delete', rolesFournisseursWrite, (e, id) => stockCtrl.deleteFournisseur(e, id))

secureHandle('mouvements:byArticle', rolesArticlesRead, (e, id) => stockCtrl.getMouvementsByArticle(e, id))
secureHandle('mouvements:byChantier', rolesArticlesRead, (e, id) => stockCtrl.getMouvementsByChantier(e, id))
secureHandle('mouvements:byPeriode', rolesArticlesRead, (e, params) => stockCtrl.getMouvementsByPeriode(e, params.entrepriseId, params.dateDebut, params.dateFin))
secureHandle('mouvements:stats', rolesArticlesRead, (e, params) => stockCtrl.getMouvementsStats(e, params.entrepriseId, params.dateDebut, params.dateFin))
secureHandle('mouvements:create', rolesArticlesWrite, (e, data) => safeRepo(() => repos.mouvements.create(data)))
secureHandle('mouvements:delete', rolesArticlesWrite, (e, id) => safeRepo(() => repos.mouvements.delete(id)))

// ============================================================
// MATÉRIELS
// ============================================================
const rolesMaterielsRead = permissions.PERMISSIONS.materiels.read;
const rolesMaterielsWrite = permissions.PERMISSIONS.materiels.write;

secureHandle('materiels:list', rolesMaterielsRead, (e, params) => materielCtrl.getListMateriels(e, params))
secureHandle('materiels:get', rolesMaterielsRead, (e, id) => materielCtrl.getMaterielById(e, id))
secureHandle('materiels:create', rolesMaterielsWrite, (e, data, entrepriseId) => materielCtrl.createMateriel(e, data, entrepriseId))
secureHandle('materiels:update', rolesMaterielsWrite, (e, id, data) => materielCtrl.updateMateriel(e, id, data))
secureHandle('materiels:delete', rolesMaterielsWrite, (e, id) => materielCtrl.deleteMateriel(e, id))
secureHandle('materiels:stats', rolesMaterielsRead, (e, entrepriseId) => materielCtrl.getStatsMateriels(e, entrepriseId))
secureHandle('materiels:disponibles', rolesMaterielsRead, (e, entrepriseId) => materielCtrl.getDisponibles(e, entrepriseId))
secureHandle('materiels:maintenanceEnRetard', rolesMaterielsRead, (e, entrepriseId) => materielCtrl.getMaintenanceEnRetard(e, entrepriseId))
secureHandle('maintenances:list', rolesMaterielsRead, (e, params) => materielCtrl.getListMaintenances(e, params))
secureHandle('maintenances:create', rolesMaterielsWrite, (e, data) => materielCtrl.createMaintenance(e, data))
secureHandle('maintenances:update', rolesMaterielsWrite, (e, id, data) => materielCtrl.updateMaintenance(e, id, data))

// ============================================================
// COMMERCIAL (Clients, Devis, Contrats, Factures, Paiements)
// ============================================================
const rolesClientsRead = permissions.PERMISSIONS.clients.read;
const rolesClientsWrite = permissions.PERMISSIONS.clients.write;
const rolesDevisRead = permissions.PERMISSIONS.devis.read;
const rolesDevisWrite = permissions.PERMISSIONS.devis.write;
const rolesContratsRead = permissions.PERMISSIONS.contrats.read;
const rolesContratsWrite = permissions.PERMISSIONS.contrats.write;
const rolesFacturesRead = permissions.PERMISSIONS.factures.read;
const rolesFacturesWrite = permissions.PERMISSIONS.factures.write;
const rolesPaiementsRead = permissions.PERMISSIONS.paiements.read;
const rolesPaiementsCreate = permissions.PERMISSIONS.paiements.create;
const rolesPaiementsUpdate = permissions.PERMISSIONS.paiements.update;
const rolesPaiementsDelete = permissions.PERMISSIONS.paiements.delete;

secureHandle('clients:list', rolesClientsRead, (e, params) => commercialCtrl.getListClients(e, params))
secureHandle('clients:get', rolesClientsRead, (e, id) => commercialCtrl.getClientById(e, id))
secureHandle('clients:create', rolesClientsWrite, (e, data, entrepriseId) => commercialCtrl.createClient(e, data, entrepriseId))
secureHandle('clients:update', rolesClientsWrite, (e, id, data) => commercialCtrl.updateClient(e, id, data))
secureHandle('clients:delete', rolesClientsWrite, (e, id) => commercialCtrl.deleteClient(e, id))

secureHandle('clientAdresses:list', rolesClientsRead, (e, clientId) => commercialCtrl.getClientAdresses(e, clientId))
secureHandle('clientAdresses:create', rolesClientsWrite, (e, clientId, data) => commercialCtrl.createClientAdresse(e, clientId, data))
secureHandle('clientAdresses:update', rolesClientsWrite, (e, id, data) => commercialCtrl.updateClientAdresse(e, id, data))
secureHandle('clientAdresses:delete', rolesClientsWrite, (e, id) => commercialCtrl.deleteClientAdresse(e, id))

secureHandle('devis:list', rolesDevisRead, (e, params) => commercialCtrl.getListDevis(e, params))
secureHandle('devis:get', rolesDevisRead, (e, id) => commercialCtrl.getDevisById(e, id))
secureHandle('devis:create', rolesDevisWrite, (e, data, entrepriseId) => commercialCtrl.createDevis(e, data, entrepriseId))
secureHandle('devis:update', rolesDevisWrite, (e, id, data) => commercialCtrl.updateDevis(e, id, data))
secureHandle('devis:delete', rolesDevisWrite, (e, id) => safeRepo(() => repos.devis.delete(id)))
secureHandle('devis:transformerEnContrat', rolesDevisWrite, (e, devisId, data) => commercialCtrl.transformerDevisEnContrat(e, devisId, data))
secureHandle('devis:saveLignes', rolesDevisWrite, (e, devisId, lignes) => safeRepo(() => {
  // Supprimer les anciennes lignes et recréer
  const existing = repos.lignesDevis.getByDevis(devisId)
  if (existing) existing.forEach(l => repos.lignesDevis.delete(l.id))
  lignes.forEach(l => repos.lignesDevis.create({ ...l, devisId }))
  return { saved: lignes.length }
}))

secureHandle('contrats:list', rolesContratsRead, (e, params) => commercialCtrl.getListContrats(e, params))
secureHandle('contrats:get', rolesContratsRead, (e, id) => commercialCtrl.getContratById(e, id))
secureHandle('contrats:create', rolesContratsWrite, (e, data) => safeRepo(() => repos.contrats.create(data)))
secureHandle('contrats:update', rolesContratsWrite, (e, id, data) => safeRepo(() => repos.contrats.update(id, data)))
secureHandle('contrats:delete', rolesContratsWrite, (e, id) => safeRepo(() => repos.contrats.delete(id)))

secureHandle('factures:list', rolesFacturesRead, (e, params) => commercialCtrl.getListFactures(e, params))
secureHandle('factures:get', rolesFacturesRead, (e, id) => commercialCtrl.getFactureById(e, id))
secureHandle('factures:create', rolesFacturesWrite, (e, data, entrepriseId) => commercialCtrl.createFacture(e, data, entrepriseId))
secureHandle('factures:update', rolesFacturesWrite, (e, id, data) => commercialCtrl.updateFacture(e, id, data))
secureHandle('factures:delete', rolesFacturesWrite, (e, id) => commercialCtrl.deleteFacture(e, id))
secureHandle('factures:enRetard', rolesFacturesRead, (e, entrepriseId) => commercialCtrl.getFacturesEnRetard(e, entrepriseId))
secureHandle('factures:ajouterPaiement', rolesFacturesWrite, (e, factureId, data) => commercialCtrl.ajouterPaiementFacture(e, factureId, data))
secureHandle('factures:envoyer', ['ADMIN', 'COMMERCIAL', 'COMPTABLE'], async (e, factureId) => {
  try {
    const facture = repos.factures.getWithPaiements(factureId);
    if (!facture) return { success: false, error: 'Facture non trouvée' };

    const entreprise = db.prepare('SELECT * FROM Entreprise WHERE id = ?').get(facture.entrepriseId);
    const client = db.prepare('SELECT * FROM Client WHERE id = ?').get(facture.clientId);

    if (!client?.email) return { success: false, error: 'Le client n\'a pas d\'adresse email' };

    const smtpConfig = {
      host: entreprise?.smtpHost,
      port: entreprise?.smtpPort || 587,
      user: entreprise?.smtpUser,
      pass: entreprise?.smtpPass,
      from: entreprise?.smtpFrom || entreprise?.email,
      secure: entreprise?.smtpSecure === 1
    };

    if (!smtpConfig.host) return { success: false, error: 'Configuration SMTP manquante. Veuillez configurer les paramètres SMTP dans les paramètres de l\'entreprise.' };

    const pdfWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    try {
      const templatePath = path.join(__dirname, 'views', 'commercial', 'factures', 'pdf-template.html');
      let pdfHtml = fs.readFileSync(templatePath, 'utf8');

      const totalHT = facture.montantHT || facture.montant || 0;
      const tva = facture.tva || entreprise?.tvaDefaut || 20;
      const totalTVA = totalHT * (tva / 100);
      const totalTTC = facture.montantTTC || facture.montant || 0;
      const totalPaye = facture.totalPaye || 0;
      const resteAPayer = Math.max(0, totalTTC - totalPaye);

      pdfHtml = pdfHtml.replace('{{entrepriseNom}}', entreprise?.nom || 'TIA INFO BUILD');
      pdfHtml = pdfHtml.replace('{{entrepriseAdresse}}', entreprise?.adresse || '');
      pdfHtml = pdfHtml.replace('{{entrepriseCP}}', entreprise?.codePostal || '');
      pdfHtml = pdfHtml.replace('{{entrepriseVille}}', entreprise?.ville || '');
      pdfHtml = pdfHtml.replace('{{entrepriseSiret}}', entreprise?.siret || '');
      pdfHtml = pdfHtml.replace('{{entrepriseTVA}}', entreprise?.numeroTVA || '');
      pdfHtml = pdfHtml.replace('{{clientNom}}', client ? `${client.prenom || ''} ${client.nom || ''}`.trim() : 'Client');
      pdfHtml = pdfHtml.replace('{{clientAdresse}}', client?.adresse || '');
      pdfHtml = pdfHtml.replace('{{clientCP}}', client?.codePostal || '');
      pdfHtml = pdfHtml.replace('{{clientVille}}', client?.ville || '');
      pdfHtml = pdfHtml.replace('{{clientSiret}}', client?.siret || '');
      pdfHtml = pdfHtml.replace('{{clientTVA}}', client?.numeroTVA || '');
      pdfHtml = pdfHtml.replace('{{numero}}', facture.numero || 'Brouillon');
      pdfHtml = pdfHtml.replace('{{dateEmission}}', facture.dateEmission ? new Date(facture.dateEmission).toLocaleDateString('fr-FR') : '');
      pdfHtml = pdfHtml.replace('{{dateEcheance}}', facture.dateEcheance ? new Date(facture.dateEcheance).toLocaleDateString('fr-FR') : '');
      pdfHtml = pdfHtml.replace('{{lignesHtml}}', (facture.lignes || []).map(l => `
        <tr>
          <td>${l.description || l.reference || 'Prestation'}</td>
          <td class="text-end">${l.quantite || 1}</td>
          <td class="text-end">${window.formatCurrencyGlobal ? window.formatCurrencyGlobal(l.prixUnitaire || 0) : `${(l.prixUnitaire || 0).toFixed(2)} Ar`}</td>
          <td class="text-end">${window.formatCurrencyGlobal ? window.formatCurrencyGlobal(l.ligneTotal || l.ligneTotalTTC || 0) : `${(l.ligneTotal || l.ligneTotalTTC || 0).toFixed(2)} Ar`}</td>
        </tr>
      `).join('') || '<tr><td colspan="4" class="text-center text-muted">Aucune ligne</td></tr>');
      pdfHtml = pdfHtml.replace('{{totalHT}}', window.formatCurrencyGlobal ? window.formatCurrencyGlobal(totalHT) : `${totalHT.toFixed(2)} Ar`);
      pdfHtml = pdfHtml.replace('{{totalTVA}}', window.formatCurrencyGlobal ? window.formatCurrencyGlobal(totalTVA) : `${totalTVA.toFixed(2)} Ar`);
      pdfHtml = pdfHtml.replace('{{totalTTC}}', window.formatCurrencyGlobal ? window.formatCurrencyGlobal(totalTTC) : `${totalTTC.toFixed(2)} Ar`);
      pdfHtml = pdfHtml.replace('{{tva}}', tva);
      pdfHtml = pdfHtml.replace('{{dateGeneration}}', new Date().toLocaleDateString('fr-FR'));
      pdfHtml = pdfHtml.replace('{{mentionsLegales}}', entreprise?.mentionsLegales || '');
      pdfHtml = pdfHtml.replace('{{conditionsPaiement}}', facture.conditionsPaiement || entreprise?.delaiPaiementDefaut || '30 jours');
      pdfHtml = pdfHtml.replace('{{modePaiement}}', facture.modePaiement || 'virement');

      let acompteHtml = '';
      if (facture.acompteMontant > 0 || facture.acomptePourcent > 0) {
        const acompte = facture.acompteMontant || (totalTTC * (facture.acomptePourcent / 100));
        acompteHtml = `<tr><td>Acompte</td><td class="text-end">-${window.formatCurrencyGlobal ? window.formatCurrencyGlobal(acompte) : `${acompte.toFixed(2)} Ar`}</td></tr>`;
      }
      pdfHtml = pdfHtml.replace('{{acompteHtml}}', acompteHtml);
      pdfHtml = pdfHtml.replace('{{resteAPayer}}', window.formatCurrencyGlobal ? window.formatCurrencyGlobal(resteAPayer) : `${resteAPayer.toFixed(2)} Ar`);

      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(pdfHtml)}`);
      const pdfData = await pdfWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
      pdfWindow.close();

      const emailHtml = `
        <h2>Facture ${facture.numero}</h2>
        <p>Bonjour,</p>
        <p>Veuillez trouver ci-joint votre facture ${facture.numero} d'un montant de ${window.formatCurrencyGlobal ? window.formatCurrencyGlobal(totalTTC) : `${totalTTC.toFixed(2)} Ar`}.</p>
        <p>Date d'émission: ${facture.dateEmission}</p>
        <p>Date d'échéance: ${facture.dateEcheance}</p>
        <p>Cordialement,<br>${entreprise?.nom || 'TIA INFO BUILD'}</p>
      `;

      await sendInvoiceEmail({
        to: client.email,
        subject: `Facture ${facture.numero} - ${entreprise?.nom || 'TIA INFO BUILD'}`,
        html: emailHtml,
        pdfBuffer: Buffer.from(pdfData),
        pdfFilename: `facture_${facture.numero}.pdf`,
        smtpConfig
      });

      return { success: true, message: 'Facture envoyée par email' };
    } catch (innerError) {
      pdfWindow.close();
      throw innerError;
    }
  } catch (error) {
    console.error('factures:envoyer error:', error);
    return { success: false, error: error.message };
  }
})
secureHandle('factures:dupliquer', rolesFacturesWrite, async (e, factureId) => {
  try {
    const facture = repos.factures.getById(factureId);
    if (!facture) return { success: false, error: 'Facture non trouvée' };

    const year = new Date().getFullYear();
    const countResult = db.prepare('SELECT COUNT(*) as count FROM Facture WHERE entrepriseId = ? AND numero LIKE ?').get(facture.entrepriseId, `FAC-${year}-%`);
    const nextNum = (countResult?.count || 0) + 1;
    const newNumero = `FAC-${year}-${String(nextNum).padStart(5, '0')}`;

    const newFacture = repos.factures.create({
      ...facture,
      id: undefined,
      numero: newNumero,
      dateCreation: new Date().toISOString().split('T')[0],
      dateEmission: new Date().toISOString().split('T')[0],
      dateEcheance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      statut: 'brouillon',
      montantPaye: 0,
      is_synced: 0
    });

    return { success: true, data: newFacture };
  } catch (error) {
    console.error('factures:dupliquer error:', error);
    return { success: false, error: error.message };
  }
})
secureHandle('factures:transformerDepuisDevis', rolesFacturesWrite, (e, devisId, data) => commercialCtrl.transformerDepuisDevis(e, devisId, data))
secureHandle('factures:getByStatut', rolesFacturesRead, (e, params) => commercialCtrl.getListFactures(e, { ...params, statut: params?.statut }))

secureHandle('paiements:byFacture', rolesPaiementsRead, (e, id) => commercialCtrl.getPaiementsByFacture(e, id))
secureHandle('paiements:list', rolesPaiementsRead, (e, params) => safeRepo(() => repos.paiements.list(params)))
secureHandle('paiements:create', rolesPaiementsCreate, (e, data) => safeRepo(() => repos.paiements.create(data)))
secureHandle('paiements:update', rolesPaiementsUpdate, (e, id, data) => safeRepo(() => repos.paiements.update(id, data)))
secureHandle('paiements:delete', rolesPaiementsDelete, (e, id) => safeRepo(() => repos.paiements.delete(id)))
secureHandle('paiements:envoyerRappel', ['ADMIN', 'COMMERCIAL', 'COMPTABLE'], (e, factureId) => financeCtrl.envoyerRappel(e, factureId))

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
secureHandle('depenses:enAttenteComptable', rolesDepensesValidate, (e, entrepriseId) => financeCtrl.getDepensesEnAttenteComptable(e, entrepriseId))
secureHandle('depenses:valider', rolesDepensesValidate, (e, depenseId, data) => financeCtrl.validerDepense(e, depenseId, data))
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
secureHandle('dashboard:getFinancesSante', ['ADMIN', 'DIRECTEUR', 'COMPTABLE'], (e, entrepriseId) => dashboardCtrl.getFinancesSante(e, entrepriseId))
secureHandle('dashboard:getTrésorerie', ['ADMIN', 'DIRECTEUR', 'COMPTABLE'], (e, entrepriseId) => dashboardCtrl.getTrésorerie(e, entrepriseId))
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
// BUDGETS PRÉVISIONNELS
// ============================================================
const rolesBudgets = permissions.PERMISSIONS.budgets || { read: ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'CHEF_PROJET'], write: ['ADMIN', 'COMPTABLE', 'CHEF_PROJET'] };

secureHandle('budgets:list', rolesBudgets.read || rolesBudgets, (e, params) => budgetCtrl.list(e, params))
secureHandle('budgets:get', rolesBudgets.read || rolesBudgets, (e, id) => budgetCtrl.get(e, id))
secureHandle('budgets:create', rolesBudgets.write || rolesBudgets, (e, data, entId) => budgetCtrl.create(e, data, entId))
secureHandle('budgets:update', rolesBudgets.write || rolesBudgets, (e, id, data) => budgetCtrl.update(e, id, data))
secureHandle('budgets:delete', rolesBudgets.write || rolesBudgets, (e, id) => budgetCtrl.delete(e, id))
secureHandle('budgets:byChantier', rolesBudgets.read || rolesBudgets, (e, chantierId) => budgetCtrl.byChantier(e, chantierId))
secureHandle('budgets:comparer', rolesBudgets.read || rolesBudgets, (e, chantierId, periodeDebut, periodeFin) => budgetCtrl.comparer(e, chantierId, periodeDebut, periodeFin))

// ============================================================
// SOUS-TRAITANTS
// ============================================================
const rolesSousTraitants = permissions.PERMISSIONS.sousTraitants || { read: ['ADMIN', 'CHEF_CHANTIER', 'CHEF_PROJET'], write: ['ADMIN', 'CHEF_CHANTIER'] };

secureHandle('sous-traitants:list', rolesSousTraitants.read || rolesSousTraitants, (e, params) => sousTraitantCtrl.list(e, params))
secureHandle('sous-traitants:get', rolesSousTraitants.read || rolesSousTraitants, (e, id) => sousTraitantCtrl.get(e, id))
secureHandle('sous-traitants:create', rolesSousTraitants.write || rolesSousTraitants, (e, data, entId) => sousTraitantCtrl.create(e, data, entId))
secureHandle('sous-traitants:update', rolesSousTraitants.write || rolesSousTraitants, (e, id, data) => sousTraitantCtrl.update(e, id, data))
secureHandle('sous-traitants:delete', rolesSousTraitants.write || rolesSousTraitants, (e, id) => sousTraitantCtrl.delete(e, id))
secureHandle('sous-traitants:byChantier', rolesSousTraitants.read || rolesSousTraitants, (e, chantierId) => sousTraitantCtrl.byChantier(e, chantierId))

// ============================================================
// CATALOGUE DEVIS
// ============================================================
const rolesCatalogues = permissions.PERMISSIONS.catalogues || { read: ['ADMIN', 'COMMERCIAL'], write: ['ADMIN', 'COMMERCIAL'] };

secureHandle('catalogues:list', rolesCatalogues.read || rolesCatalogues, (e, params) => catalogueCtrl.list(e, params))
secureHandle('catalogues:get', rolesCatalogues.read || rolesCatalogues, (e, id) => catalogueCtrl.get(e, id))
secureHandle('catalogues:create', rolesCatalogues.write || rolesCatalogues, (e, data, entId) => catalogueCtrl.create(e, data, entId))
secureHandle('catalogues:update', rolesCatalogues.write || rolesCatalogues, (e, id, data) => catalogueCtrl.update(e, id, data))
secureHandle('catalogues:delete', rolesCatalogues.write || rolesCatalogues, (e, id) => catalogueCtrl.delete(e, id))
secureHandle('catalogues:getByCategorie', rolesCatalogues.read || rolesCatalogues, (e, categorie) => catalogueCtrl.getByCategorie(e, categorie))

// ============================================================
// NOTIFICATIONS
// ============================================================
const allRoles = ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'RH', 'CHEF_CHANTIER', 'CHEF_PROJET', 'MATERIEL', 'MAGASINIER', 'COMMERCIAL'];
const rolesNotificationsWrite = permissions.PERMISSIONS.notifications?.write || ['ADMIN'];
const rolesNotificationsDelete = permissions.PERMISSIONS.notifications?.delete || ['ADMIN'];

secureHandle('notifications:list', allRoles, (e, params) => notificationCtrl.list(e, params))
secureHandle('notifications:get', allRoles, (e, id) => notificationCtrl.get(e, id))
secureHandle('notifications:create', rolesNotificationsWrite, (e, data, entId) => notificationCtrl.create(e, data, entId))
secureHandle('notifications:update', rolesNotificationsWrite, (e, id, data) => notificationCtrl.update(e, id, data))
secureHandle('notifications:markRead', allRoles, (e, id) => notificationCtrl.markRead(e, id))
secureHandle('notifications:markAllRead', allRoles, (e, entId, userId) => notificationCtrl.markAllRead(e, entId, userId))
secureHandle('notifications:delete', rolesNotificationsDelete, (e, id) => notificationCtrl.delete(e, id))
secureHandle('notifications:nonLues', allRoles, (e, entId, userId) => notificationCtrl.nonLues(e, entId, userId))
secureHandle('notifications:countNonLues', allRoles, (e, entId, userId) => notificationCtrl.countNonLues(e, entId, userId))


// ============================================================
// SYNCHRONISATION
// ============================================================
secureHandle('sync:getConfig', ['ADMIN', 'DIRECTEUR'], (e) => syncCtrl.getConfig(e))
secureHandle('sync:setConfig', ['ADMIN'], (e, config) => syncCtrl.setConfig(e, config))
secureHandle('sync:getHistory', ['ADMIN', 'DIRECTEUR'], (e, limit) => syncCtrl.getHistory(e, limit))
secureHandle('sync:getStatus', ['ADMIN', 'DIRECTEUR'], (e) => syncCtrl.getStatus(e))
secureHandle('sync:status', ['ADMIN', 'DIRECTEUR'], () => syncService.getStatus())
secureHandle('sync:push', ['ADMIN'], () => syncCtrl.push())
secureHandle('sync:pull', ['ADMIN'], () => syncCtrl.pull())
secureHandle('sync:testConnection', ['ADMIN'], (e) => syncCtrl.testConnection(e))
secureHandle('sync:syncNow', ['ADMIN'], (e) => syncCtrl.syncNow(e))
secureHandle('sync:setAutoConfig', ['ADMIN'], (e, config) => syncCtrl.setAutoConfig(e, config))

// ============================================================
// PRÉFÉRENCES UTILISATEUR
// ============================================================
secureHandle('preferences:get', ['ADMIN', 'RH'], async (e, userId) => {
  if (userId !== _session.id && !['ADMIN', 'RH'].includes(getSessionRoles()[0])) {
    return { success: false, error: 'Accès refusé' };
  }
  return safeRepo(() => {
    const row = db.prepare('SELECT * FROM Preference WHERE userId = ?').get(userId)
    return row || {}
  })
})
secureHandle('preferences:update', ['ADMIN', 'RH'], async (e, userId, data) => {
  if (userId !== _session.id && !['ADMIN', 'RH'].includes(getSessionRoles()[0])) {
    return { success: false, error: 'Accès refusé' };
  }
  return safeRepo(() => {
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
  })
})

// ============================================================
// BACKUP
// ============================================================
const backupRoles = ['ADMIN', 'DIRECTEUR'];
secureHandle('backup:exportSQLite', backupRoles, async () => {
  try {
    const data = fs.readFileSync(dbPath)
    return new Uint8Array(data)
  } catch (err) { throw err }
})
secureHandle('backup:exportSQL', backupRoles, async () => {
  try {
    const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all()
    let sql = ''
    tables.forEach(t => { sql += t.sql + ';\n' })
    return new Uint8Array(Buffer.from(sql))
  } catch (err) { throw err }
})
secureHandle('backup:list', backupRoles, () => {
  try {
    if (!fs.existsSync(backupsDir)) return []
    return fs.readdirSync(backupsDir).map(f => ({ fichier: f, date: fs.statSync(path.join(backupsDir, f)).mtime, taille: fs.statSync(path.join(backupsDir, f)).size }))
  } catch { return [] }
})
secureHandle('backup:import', backupRoles, async (e, data) => {
  try {
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].slice(0, 8)
    const filename = `import_${timestamp}.sqlite`
    fs.writeFileSync(path.join(backupsDir, filename), Buffer.from(data))
    return { success: true, filename }
  } catch (err) { throw err }
})
secureHandle('backup:download', backupRoles, (e, filename) => {
  try {
    const filePath = path.join(backupsDir, filename)
    if (!fs.existsSync(filePath)) throw new Error('Fichier introuvable')
    const data = fs.readFileSync(filePath)
    return new Uint8Array(data)
  } catch (err) { throw err }
})
secureHandle('backup:restore', backupRoles, async (e, filename) => {
  try {
    const src = path.join(backupsDir, filename)
    if (!fs.existsSync(src)) throw new Error('Fichier introuvable')
    fs.copyFileSync(src, dbPath)
    return { success: true }
  } catch (err) { throw err }
})
secureHandle('backup:delete', backupRoles, (e, filename) => {
  try {
    const filePath = path.join(backupsDir, filename)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    return { success: true }
  } catch (err) { throw err }
})
secureHandle('backup:setAutoConfig', backupRoles, (e, config) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'backup-config.json')
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    return { success: true }
  } catch (err) { throw err }
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
const rolesAlertesWrite = ['ADMIN', 'DIRECTEUR', 'COMPTABLE'];
const rolesAlertesDelete = ['ADMIN', 'DIRECTEUR', 'COMPTABLE'];
secureHandle('alertes:list',           allRoles, (e, p) => alerteCtrl.getList(e, p))
secureHandle('alertes:nonLues',        allRoles, (e, entId, limit) => alerteCtrl.getNonLues(e, entId, limit, getSessionRoles()[0]))
secureHandle('alertes:countNonLues',   allRoles, (e, entId) => alerteCtrl.countNonLues(e, entId))
secureHandle('alertes:markAsRead',     allRoles, (e, id) => alerteCtrl.markAsRead(e, id))
secureHandle('alertes:marquerLue',     allRoles, (e, id) => alerteCtrl.marquerLue(e, id))
secureHandle('alertes:markAllAsRead',  allRoles, (e, entId) => alerteCtrl.markAllAsRead(e, entId))
secureHandle('alertes:marquerToutesLues', allRoles, (e, entId) => alerteCtrl.markAllAsRead(e, entId))
secureHandle('alertes:creer',          rolesAlertesWrite, (e, data) => alerteCtrl.creer(e, data))
secureHandle('alertes:delete',         rolesAlertesDelete, (e, id) => alerteCtrl.deleteAlerte(e, id))

// ============================================================
// BUDGET PRÉVISIONNEL
// ============================================================
const rolesBudgetRead = ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'CHEF_PROJET'];
const rolesBudgetWrite = ['ADMIN', 'COMPTABLE', 'CHEF_PROJET'];

secureHandle('budgetPrevisionnel:list', rolesBudgetRead, (e, params) => budgetCtrl.list(e, params))
secureHandle('budgetPrevisionnel:get', rolesBudgetRead, (e, id) => budgetCtrl.get(e, id))
secureHandle('budgetPrevisionnel:create', rolesBudgetWrite, (e, data, entId) => budgetCtrl.create(e, data, entId))
secureHandle('budgetPrevisionnel:update', rolesBudgetWrite, (e, id, data) => budgetCtrl.update(e, id, data))
secureHandle('budgetPrevisionnel:delete', rolesBudgetWrite, (e, id) => budgetCtrl.delete(e, id))
secureHandle('budgetPrevisionnel:comparer', rolesBudgetRead, (e, chantierId) => budgetCtrl.comparer(e, chantierId))

// ============================================================
// SOUS-TRAITANTS
// ============================================================
const rolesSousTraitantRead = ['ADMIN', 'CHEF_CHANTIER', 'CHEF_PROJET', 'DIRECTEUR'];
const rolesSousTraitantWrite = ['ADMIN', 'CHEF_CHANTIER'];

secureHandle('sousTraitants:list', rolesSousTraitantRead, (e, params) => sousTraitantCtrl.list(e, params))
secureHandle('sousTraitants:get', rolesSousTraitantRead, (e, id) => sousTraitantCtrl.get(e, id))
secureHandle('sousTraitants:create', rolesSousTraitantWrite, (e, data, entId) => sousTraitantCtrl.create(e, data, entId))
secureHandle('sousTraitants:update', rolesSousTraitantWrite, (e, id, data) => sousTraitantCtrl.update(e, id, data))
secureHandle('sousTraitants:delete', rolesSousTraitantWrite, (e, id) => sousTraitantCtrl.delete(e, id))
secureHandle('sousTraitants:affectations', rolesSousTraitantRead, (e, sousTraitantId) => sousTraitantCtrl.getAffectations(e, sousTraitantId))

// ============================================================
// CATALOGUE DEVIS
// ============================================================
const rolesCatalogueRead = ['ADMIN', 'COMMERCIAL'];
const rolesCatalogueWrite = ['ADMIN', 'COMMERCIAL'];

secureHandle('catalogueDevis:list', rolesCatalogueRead, (e, params) => catalogueCtrl.list(e, params))
secureHandle('catalogueDevis:get', rolesCatalogueRead, (e, id) => catalogueCtrl.get(e, id))
secureHandle('catalogueDevis:create', rolesCatalogueWrite, (e, data, entId) => catalogueCtrl.create(e, data, entId))
secureHandle('catalogueDevis:update', rolesCatalogueWrite, (e, id, data) => catalogueCtrl.update(e, id, data))
secureHandle('catalogueDevis:delete', rolesCatalogueWrite, (e, id) => catalogueCtrl.delete(e, id))
secureHandle('catalogueDevis:categories', rolesCatalogueRead, (e, entId) => catalogueCtrl.getCategories(e, entId))

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
  try {
    repos.notifications.purgeAnciennes(90)
    console.log('[Main] Purge automatique des anciennes notifications effectuée')
  } catch (e) {
    console.warn('[Main] Purge notifications échouée:', e.message)
  }
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
