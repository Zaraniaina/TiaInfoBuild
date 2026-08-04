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

  win.once('ready-to-show', () => {
    win.show()
  })

  win.loadFile('views/index.html')

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ============================================================
// REGISTRATION DES IPC HANDLERS VIA CONTROULERS (Style MVC)
// ============================================================

// --- Auth & Session ---
let _session = null;

ipcMain.handle('auth:login', handleLogin)
ipcMain.handle('auth:logout', async () => {
  _session = null;
  return { success: true };
})
ipcMain.handle('auth:check', async () => {
  return { authenticated: !!_session, user: _session };
})
ipcMain.handle('auth:register', handleRegister)
ipcMain.handle('session:get', async () => {
  return { success: true, data: _session };
})
ipcMain.handle('session:set', async (e, data) => {
  _session = data;
  return { success: true };
})
ipcMain.handle('session:clear', async () => {
  _session = null;
  return { success: true };
})

// --- Utilisateurs & Rôles (Paramètres Admin) ---
ipcMain.handle('utilisateurs:list', (e, params) => utilisateurCtrl.getList(e, params))
ipcMain.handle('utilisateurs:getAll', (e, params) => utilisateurCtrl.getList(e, params))
ipcMain.handle('utilisateurs:get', (e, id) => utilisateurCtrl.getById(e, id))
ipcMain.handle('utilisateurs:create', (e, data, entId) => utilisateurCtrl.create(e, data, entId))
ipcMain.handle('utilisateurs:update', (e, id, data) => utilisateurCtrl.update(e, id, data))
ipcMain.handle('utilisateurs:delete', (e, id) => utilisateurCtrl.delete(e, id))

ipcMain.handle('users:list', (e, params) => utilisateurCtrl.getList(e, params))
ipcMain.handle('users:getAll', (e, params) => utilisateurCtrl.getList(e, params))
ipcMain.handle('users:get', (e, id) => utilisateurCtrl.getById(e, id))
ipcMain.handle('users:create', (e, data, entId) => utilisateurCtrl.create(e, data, entId))
ipcMain.handle('users:update', (e, id, data) => utilisateurCtrl.update(e, id, data))
ipcMain.handle('users:delete', (e, id) => utilisateurCtrl.delete(e, id))

ipcMain.handle('roles:list', async () => {
  try {
    const roles = repos.utilisateurs.rawQuery("SELECT * FROM Role WHERE is_deleted = 0");
    return { success: true, data: roles };
  } catch (err) {
    return { success: false, error: err.message };
  }
})
// --- Entreprise (Paramètres) ---
ipcMain.handle('entreprises:get', (e, id) => {
  try {
    return db.prepare('SELECT * FROM Entreprise WHERE id = ?').get(id) || null
  } catch (err) {
    console.error('entreprises:get error:', err)
    return null
  }
})

ipcMain.handle('entreprises:update', (e, id, data) => {
  try {
    const allowed = ['nom', 'nomCommercial', 'siret', 'numeroTVA', 'codeAPE', 'adresse', 'codePostal',
      'ville', 'telephone', 'email', 'siteWeb', 'prefixeDevis', 'prefixeFacture', 'prefixeContrat',
      'tvaDefaut', 'delaiPaiementDefaut', 'validiteDevis', 'mentionsLegales', 'devise']
    const fields = Object.keys(data).filter(k => allowed.includes(k))
    if (fields.length === 0) return { success: true }
    const setClause = fields.map(f => `${f} = @${f}`).join(', ')
    db.prepare(`UPDATE Entreprise SET ${setClause} WHERE id = @id`).run({ ...data, id })
    return { success: true }
  } catch (err) {
    console.error('entreprises:update error:', err)
    throw err
  }
})

// --- Préférences utilisateur (Paramètres) ---
ipcMain.handle('preferences:get', (e, userId) => {
  try {
    let row = db.prepare('SELECT * FROM Preference WHERE userId = ?').get(userId)
    if (!row) {
      db.prepare('INSERT INTO Preference (userId) VALUES (?)').run(userId)
      row = db.prepare('SELECT * FROM Preference WHERE userId = ?').get(userId)
    }
    return {
      ...row,
      notifEmail: !!row.notifEmail,
      notifPush: !!row.notifPush,
      notifFacturesRetard: !!row.notifFacturesRetard,
      notifStockBas: !!row.notifStockBas
    }
  } catch (err) {
    console.error('preferences:get error:', err)
    return null
  }
})

ipcMain.handle('preferences:update', (e, userId, data) => {
  try {
    const allowed = ['theme', 'langue', 'dateFormat', 'devise', 'notifEmail', 'notifPush', 'notifFacturesRetard', 'notifStockBas']
    const payload = { userId }
    allowed.filter(k => k in data).forEach(f => {
      payload[f] = typeof data[f] === 'boolean' ? (data[f] ? 1 : 0) : data[f]
    })
    const exists = db.prepare('SELECT id FROM Preference WHERE userId = ?').get(userId)
    if (exists) {
      const fields = Object.keys(payload).filter(f => f !== 'userId')
      const setClause = fields.map(f => `${f} = @${f}`).join(', ')
      db.prepare(`UPDATE Preference SET ${setClause} WHERE userId = @userId`).run(payload)
    } else {
      const cols = Object.keys(payload)
      db.prepare(`INSERT INTO Preference (${cols.join(', ')}) VALUES (${cols.map(c => `@${c}`).join(', ')})`).run(payload)
    }
    return { success: true }
  } catch (err) {
    console.error('preferences:update error:', err)
    throw err
  }
})

// --- Sauvegarde / Restauration (Paramètres) ---
ipcMain.handle('backup:list', () => {
  try {
    return fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.sqlite'))
      .map(f => {
        const stat = fs.statSync(path.join(backupsDir, f))
        return { fichier: f, date: stat.mtime.toISOString(), taille: stat.size, type: f.startsWith('auto_') ? 'auto' : 'manuel' }
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  } catch (err) {
    console.error('backup:list error:', err)
    return []
  }
})

ipcMain.handle('backup:exportSQLite', () => {
  const bytes = fs.readFileSync(dbPath)
  fs.copyFileSync(dbPath, path.join(backupsDir, `manuel_${Date.now()}.sqlite`))
  return bytes
})

ipcMain.handle('backup:exportSQL', () => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
  let sql = ''
  tables.forEach(t => {
    const rows = db.prepare(`SELECT * FROM ${t.name}`).all()
    rows.forEach(row => {
      const cols = Object.keys(row)
      const values = cols.map(c => row[c] === null ? 'NULL' : `'${String(row[c]).replace(/'/g, "''")}'`)
      sql += `INSERT INTO ${t.name} (${cols.join(', ')}) VALUES (${values.join(', ')});\n`
    })
  })
  return Buffer.from(sql, 'utf-8')
})

ipcMain.handle('backup:download', (e, filename) => {
  const filePath = path.join(backupsDir, filename)
  if (!fs.existsSync(filePath)) throw new Error('Fichier introuvable')
  return fs.readFileSync(filePath)
})

ipcMain.handle('backup:restore', (e, filename) => {
  const filePath = path.join(backupsDir, filename)
  if (!fs.existsSync(filePath)) throw new Error('Sauvegarde introuvable')
  fs.copyFileSync(filePath, dbPath)
  return { success: true }
})

ipcMain.handle('backup:delete', (e, filename) => {
  const filePath = path.join(backupsDir, filename)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  return { success: true }
})

ipcMain.handle('backup:import', (e, fileBuffer) => {
  fs.writeFileSync(dbPath, Buffer.from(fileBuffer))
  return { success: true }
})

ipcMain.handle('backup:setAutoConfig', (e, config) => {
  try {
    fs.writeFileSync(path.join(backupsDir, 'auto-config.json'), JSON.stringify(config, null, 2))
    return { success: true }
  } catch (err) {
    console.error('backup:setAutoConfig error:', err)
    throw err
  }
})
// --- Chantiers, Phases & Incidents ---
ipcMain.handle('chantiers:list', (e, params) => chantierCtrl.getList(e, params))
ipcMain.handle('chantiers:get', (e, id) => chantierCtrl.getById(e, id))
ipcMain.handle('chantiers:create', (e, data, entrepriseId) => chantierCtrl.create(e, data, entrepriseId))
ipcMain.handle('chantiers:update', (e, id, data) => chantierCtrl.update(e, id, data))
ipcMain.handle('chantiers:delete', (e, id) => chantierCtrl.delete(e, id))
ipcMain.handle('chantiers:stats', (e, entrepriseId) => chantierCtrl.getStats(e, entrepriseId))
ipcMain.handle('chantiers:addPhase', (e, chantierId, data) => chantierCtrl.addPhase(e, chantierId, data))
ipcMain.handle('chantiers:addIncident', (e, chantierId, data, userId) => chantierCtrl.addIncident(e, chantierId, data, userId))
ipcMain.handle('chantiers:recalculerBudget', (e, chantierId) => chantierCtrl.recalculerBudget(e, chantierId))

ipcMain.handle('phases:list', (e, chantierId) => chantierCtrl.getPhasesByChantier(e, chantierId))
ipcMain.handle('phases:updateAvancement', (e, id, pct) => chantierCtrl.updatePhaseAvancement(e, id, pct))
ipcMain.handle('phases:reorder', (e, chantierId, ids) => chantierCtrl.reorderPhases(e, chantierId, ids))
ipcMain.handle('phases:avancementGlobal', (e, chantierId) => chantierCtrl.getAvancementGlobalPhases(e, chantierId))

ipcMain.handle('incidents:list', (e, chantierId) => chantierCtrl.getIncidentsByChantier(e, chantierId))
ipcMain.handle('incidents:changerStatut', (e, id, statut) => chantierCtrl.changerStatutIncident(e, id, statut))
ipcMain.handle('incidents:ouvertsByEntreprise', (e, entrepriseId) => chantierCtrl.getIncidentsOuvertsByEntreprise(e, entrepriseId))

// --- Ressources Humaines ---
ipcMain.handle('employes:list', (e, params) => rhCtrl.getListEmployes(e, params))
ipcMain.handle('employes:get', (e, id) => rhCtrl.getEmployeById(e, id))
ipcMain.handle('employes:create', (e, data, entrepriseId) => rhCtrl.createEmploye(e, data, entrepriseId))
ipcMain.handle('employes:update', (e, id, data) => rhCtrl.updateEmploye(e, id, data))
ipcMain.handle('employes:delete', (e, id) => rhCtrl.deleteEmploye(e, id))
ipcMain.handle('employes:presentsToday', (e, entrepriseId) => rhCtrl.getPresentsToday(e, entrepriseId))
ipcMain.handle('employes:pointer', (e, data) => rhCtrl.pointer(e, data))
ipcMain.handle('employes:stats', (e, entrepriseId) => rhCtrl.getStatsEmployes(e, entrepriseId))

ipcMain.handle('pointages:list', (e, params) => rhCtrl.getListPointages(e, params))
ipcMain.handle('pointages:create', (e, data) => rhCtrl.createPointage(e, data))

ipcMain.handle('heures-sup:list', (e, params) => rhCtrl.getListHeuresSup(e, params))
ipcMain.handle('heures-sup:create', (e, data) => rhCtrl.createHeureSup(e, data))

ipcMain.handle('equipes:list', (e, entrepriseId) => rhCtrl.getListEquipes(e, entrepriseId))
ipcMain.handle('equipes:create', (e, data, entrepriseId) => rhCtrl.createEquipe(e, data, entrepriseId))

// --- Stocks & Fournisseurs ---
ipcMain.handle('articles:list', (e, params) => stockCtrl.getListArticles(e, params))
ipcMain.handle('articles:get', (e, id) => stockCtrl.getArticleById(e, id))
ipcMain.handle('articles:create', (e, data, entrepriseId) => stockCtrl.createArticle(e, data, entrepriseId))
ipcMain.handle('articles:update', (e, id, data) => stockCtrl.updateArticle(e, id, data))
ipcMain.handle('articles:delete', (e, id) => stockCtrl.deleteArticle(e, id))
ipcMain.handle('articles:enAlerte', (e, entrepriseId) => stockCtrl.getArticlesEnAlerte(e, entrepriseId))
ipcMain.handle('articles:updateStock', (e, articleId, qte, type, opt) => stockCtrl.updateStockArticle(e, articleId, qte, type, opt))
ipcMain.handle('articles:stats', (e, entrepriseId) => stockCtrl.getStatsArticles(e, entrepriseId))

ipcMain.handle('fournisseurs:list', (e, params) => stockCtrl.getListFournisseurs(e, params))
ipcMain.handle('fournisseurs:create', (e, data, entrepriseId) => stockCtrl.createFournisseur(e, data, entrepriseId))
ipcMain.handle('fournisseurs:update', (e, id, data) => stockCtrl.updateFournisseur(e, id, data))
ipcMain.handle('fournisseurs:delete', (e, id) => stockCtrl.deleteFournisseur(e, id))

ipcMain.handle('mouvements:byArticle', (e, id) => stockCtrl.getMouvementsByArticle(e, id))
ipcMain.handle('mouvements:byChantier', (e, id) => stockCtrl.getMouvementsByChantier(e, id))
ipcMain.handle('mouvements:byPeriode', (e, params) => stockCtrl.getMouvementsByPeriode(e, params.entrepriseId, params.dateDebut, params.dateFin))
ipcMain.handle('mouvements:stats', (e, params) => stockCtrl.getMouvementsStats(e, params.entrepriseId, params.dateDebut, params.dateFin))

// --- Matériels ---
ipcMain.handle('materiels:list', (e, params) => materielCtrl.getListMateriels(e, params))
ipcMain.handle('materiels:get', (e, id) => materielCtrl.getMaterielById(e, id))
ipcMain.handle('materiels:create', (e, data, entrepriseId) => materielCtrl.createMateriel(e, data, entrepriseId))
ipcMain.handle('materiels:update', (e, id, data) => materielCtrl.updateMateriel(e, id, data))
ipcMain.handle('materiels:delete', (e, id) => materielCtrl.deleteMateriel(e, id))
ipcMain.handle('materiels:stats', (e, entrepriseId) => materielCtrl.getStatsMateriels(e, entrepriseId))
ipcMain.handle('materiels:disponibles', (e, entrepriseId) => materielCtrl.getDisponibles(e, entrepriseId))
ipcMain.handle('materiels:maintenanceEnRetard', (e, entrepriseId) => materielCtrl.getMaintenanceEnRetard(e, entrepriseId))
ipcMain.handle('maintenances:list', (e, params) => materielCtrl.getListMaintenances(e, params))
ipcMain.handle('maintenances:create', (e, data) => materielCtrl.createMaintenance(e, data))
ipcMain.handle('maintenances:update', (e, id, data) => materielCtrl.updateMaintenance(e, id, data))

// --- Commercial ---
ipcMain.handle('clients:list', (e, params) => commercialCtrl.getListClients(e, params))
ipcMain.handle('clients:get', (e, id) => commercialCtrl.getClientById(e, id))
ipcMain.handle('clients:create', (e, data, entrepriseId) => commercialCtrl.createClient(e, data, entrepriseId))
ipcMain.handle('clients:update', (e, id, data) => commercialCtrl.updateClient(e, id, data))
ipcMain.handle('clients:delete', (e, id) => commercialCtrl.deleteClient(e, id))

ipcMain.handle('devis:list', (e, params) => commercialCtrl.getListDevis(e, params))
ipcMain.handle('devis:get', (e, id) => commercialCtrl.getDevisById(e, id))
ipcMain.handle('devis:create', (e, data, entrepriseId) => commercialCtrl.createDevis(e, data, entrepriseId))
ipcMain.handle('devis:update', (e, id, data) => commercialCtrl.updateDevis(e, id, data))
ipcMain.handle('devis:transformerEnContrat', (e, devisId, data) => commercialCtrl.transformerDevisEnContrat(e, devisId, data))

ipcMain.handle('contrats:list', (e, params) => commercialCtrl.getListContrats(e, params))
ipcMain.handle('contrats:get', (e, id) => commercialCtrl.getContratById(e, id))

ipcMain.handle('factures:list', (e, params) => commercialCtrl.getListFactures(e, params))
ipcMain.handle('factures:get', (e, id) => commercialCtrl.getFactureById(e, id))
ipcMain.handle('factures:create', (e, data, entrepriseId) => commercialCtrl.createFacture(e, data, entrepriseId))
ipcMain.handle('factures:update', (e, id, data) => commercialCtrl.updateFacture(e, id, data))
ipcMain.handle('factures:delete', (e, id) => commercialCtrl.deleteFacture(e, id))
ipcMain.handle('factures:enRetard', (e, entrepriseId) => commercialCtrl.getFacturesEnRetard(e, entrepriseId))
ipcMain.handle('factures:ajouterPaiement', (e, factureId, data) => commercialCtrl.ajouterPaiementFacture(e, factureId, data))

ipcMain.handle('paiements:byFacture', (e, id) => commercialCtrl.getPaiementsByFacture(e, id))

// --- Finance & Alertes ---
ipcMain.handle('depenses:byChantier', (e, id) => financeCtrl.getDepensesByChantier(e, id))
ipcMain.handle('depenses:totalByChantier', (e, id) => financeCtrl.getTotalDepensesByChantier(e, id))
ipcMain.handle('depenses:byCategorie', (e, id) => financeCtrl.getDepensesByCategorie(e, id))
ipcMain.handle('depenses:enAttenteValidation', (e, entrepriseId) => financeCtrl.getDepensesEnAttenteValidation(e, entrepriseId))

ipcMain.handle('alertes:nonLues', (e, entrepriseId, limit) => financeCtrl.getAlertesNonLues(e, entrepriseId, limit))
ipcMain.handle('alertes:marquerLue', (e, id) => financeCtrl.marquerAlerteLue(e, id))
ipcMain.handle('alertes:marquerToutesLues', (e, entrepriseId) => financeCtrl.marquerToutesAlertesLues(e, entrepriseId))
ipcMain.handle('alertes:creer', (e, data) => financeCtrl.creerAlerte(e, data))
ipcMain.handle('alertes:countNonLues', (e, entrepriseId) => financeCtrl.countAlertesNonLues(e, entrepriseId))

// --- Dashboard ---
ipcMain.handle('dashboard:stats', (e, entrepriseId) => dashboardCtrl.getDashboardStats(e, entrepriseId))
ipcMain.handle('dashboard:getCAEvolution', (e, entrepriseId) => dashboardCtrl.getCAEvolution(e, entrepriseId))
ipcMain.handle('dashboard:getTopChantiersBudget', (e, entrepriseId) => dashboardCtrl.getTopChantiersBudget(e, entrepriseId))
ipcMain.handle('dashboard:getActiviteRecente', (e, entrepriseId, limit) => dashboardCtrl.getActiviteRecente(e, entrepriseId, limit))

// --- Synchronisation ---
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

// --- Utilitaires Systèmes ---
ipcMain.handle('app:getVersion', () => app.getVersion())
ipcMain.handle('app:openPath', async (e, targetPath) => {
  try {
    await shell.openPath(targetPath)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
ipcMain.handle('app:showItemInFolder', async (e, targetPath) => {
  try {
    shell.showItemInFolder(targetPath)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
ipcMain.handle('dialog:showOpenDialog', async (e, options) => {
  try {
    return await dialog.showOpenDialog(options)
  } catch (error) {
    return { canceled: true, filePaths: [] }
  }
})
ipcMain.handle('dialog:showSaveDialog', async (e, options) => {
  try {
    return await dialog.showSaveDialog(options)
  } catch (error) {
    return { canceled: true, filePath: '' }
  }
})
ipcMain.handle('notification:show', async (e, title, body) => {
  const { Notification } = require('electron');
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
  return { success: true };
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

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})