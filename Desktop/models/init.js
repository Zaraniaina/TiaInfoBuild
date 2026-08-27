// Desktop/models/init.js
const db = require('./db');

function columnExists(tableName, columnName) {
  try {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return rows.some(row => row.name === columnName);
  } catch (e) {
    return false;
  }
}

function ensureColumn(tableName, columnName, definition) {
  if (!columnExists(tableName, columnName)) {
    try {
      db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
      console.log(`[Migration] Colonne ${columnName} ajoutée à la table ${tableName}`);
    } catch (e) {
      console.warn(`Note: Impossible d'ajouter ${columnName} à ${tableName}: ${e.message}`);
    }
  }
}

function initDatabase() {
  db.pragma('foreign_keys = ON');

  // ============================================================
  // 1. MODULE TRANVERSE — Entreprise, Rôle, Utilisateur
  // ============================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Entreprise (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      nom TEXT NOT NULL,
      nomCommercial TEXT,
      adresse TEXT,
      codePostal TEXT,
      ville TEXT,
      telephone TEXT,
      email TEXT,
      logo TEXT,
      abonnement TEXT,
      devise TEXT DEFAULT 'MGA',
      siret TEXT,
      numeroTVA TEXT,
      codeAPE TEXT,
      siteWeb TEXT,
      prefixeDevis TEXT DEFAULT 'DEV',
      prefixeFacture TEXT DEFAULT 'FAC',
      prefixeContrat TEXT DEFAULT 'CTR',
      tvaDefaut REAL DEFAULT 20,
      delaiPaiementDefaut TEXT DEFAULT '30 jours',
      validiteDevis INTEGER DEFAULT 30,
      mentionsLegales TEXT,
      smtpHost TEXT,
      smtpPort INTEGER DEFAULT 587,
      smtpUser TEXT,
      smtpPass TEXT,
      smtpFrom TEXT,
      smtpSecure INTEGER DEFAULT 1,
      dateCreation DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Role (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      nom TEXT NOT NULL,
      description TEXT,
      code TEXT UNIQUE,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Utilisateur (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER,
      roleId INTEGER,
      nom TEXT NOT NULL,
      prenom TEXT,
      email TEXT UNIQUE NOT NULL,
      motDePasseHash TEXT,
      telephone TEXT,
      statut TEXT DEFAULT 'actif',
      dateCreation DATETIME DEFAULT CURRENT_TIMESTAMP,
      derniereConnexion DATETIME,
      must_change_password INTEGER DEFAULT 1,
      credentialsDownloadedAt DATETIME,
      login_attempts INTEGER DEFAULT 0,
      locked_until DATETIME,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id),
      FOREIGN KEY (roleId) REFERENCES Role(id)
    )
  `).run();

  ensureColumn('Utilisateur', 'login_attempts', 'INTEGER DEFAULT 0');
  ensureColumn('Utilisateur', 'locked_until', 'DATETIME');

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Preference (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER UNIQUE NOT NULL,
      theme TEXT DEFAULT 'auto',
      langue TEXT DEFAULT 'fr',
      dateFormat TEXT DEFAULT 'DD/MM/YYYY',
      devise TEXT DEFAULT 'MGA',
      notifEmail INTEGER DEFAULT 1,
      notifPush INTEGER DEFAULT 1,
      notifFacturesRetard INTEGER DEFAULT 1,
      notifStockBas INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES Utilisateur(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS AuditLog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entrepriseId INTEGER,
      utilisateurId INTEGER,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      entityId INTEGER,
      payload TEXT,
      dateAction DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (utilisateurId) REFERENCES Utilisateur(id)
    )
  `).run();

  // ============================================================
  // 2. MODULE COMMERCIAL — Client
  // ============================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Client (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      nom TEXT NOT NULL,
      type TEXT DEFAULT 'particulier',
      civilite TEXT,
      prenom TEXT,
      entreprise TEXT,
      siret TEXT,
      numeroTVA TEXT,
      adresse TEXT,
      codePostal TEXT,
      ville TEXT,
      telephone TEXT,
      portable TEXT,
      email TEXT,
      siteWeb TEXT,
      notes TEXT,
      conditionsPaiement TEXT DEFAULT '30 jours',
      modePaiement TEXT DEFAULT 'virement',
      encoursMax REAL DEFAULT 0,
      commercialId INTEGER,
      origine TEXT,
      rib TEXT,
      caTotal REAL DEFAULT 0,
      encoursActuel REAL DEFAULT 0,
      dernierContact DATETIME,
      nbDevis INTEGER DEFAULT 0,
      nbFactures INTEGER DEFAULT 0,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id),
      FOREIGN KEY (commercialId) REFERENCES Utilisateur(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS ClientAdresse (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      clientId INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('facturation', 'livraison', 'chantier', 'autre', 'siege')),
      ligne1 TEXT NOT NULL,
      ligne2 TEXT,
      codePostal TEXT NOT NULL,
      ville TEXT NOT NULL,
      pays TEXT DEFAULT 'Madagascar',
      defaut INTEGER DEFAULT 0,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clientId) REFERENCES Client(id) ON DELETE CASCADE
    )
  `).run();

  // ============================================================
  // 3. MODULE CHANTIERS
  // ============================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Chantier (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      clientId INTEGER,
      chefChantierId INTEGER,
      numero TEXT,
      nom TEXT NOT NULL,
      adresse TEXT,
      codePostal TEXT,
      ville TEXT,
      dateDebut DATE,
      dateFinPrevue DATE,
      dateFinReelle DATE,
      budgetPrevu REAL DEFAULT 0,
      budgetPrevisionnel REAL DEFAULT 0,
      budgetReel REAL DEFAULT 0,
      margeCible REAL DEFAULT 0,
      tva REAL DEFAULT 20,
      statut TEXT DEFAULT 'planification',
      description TEXT,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id),
      FOREIGN KEY (clientId) REFERENCES Client(id),
      FOREIGN KEY (chefChantierId) REFERENCES Utilisateur(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Phase (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      chantierId INTEGER NOT NULL,
      nom TEXT NOT NULL,
      description TEXT,
      dateDebut DATE,
      dateFin DATE,
      budget REAL DEFAULT 0,
      avancementPct INTEGER DEFAULT 0,
      statut TEXT DEFAULT 'non_commencee',
      ordre INTEGER DEFAULT 0,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chantierId) REFERENCES Chantier(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Incident (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      chantierId INTEGER NOT NULL,
      declarePar INTEGER,
      titre TEXT NOT NULL,
      description TEXT,
      dateIncident DATE DEFAULT (date('now')),
      gravite TEXT DEFAULT 'moyenne',
      statut TEXT DEFAULT 'signale',
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chantierId) REFERENCES Chantier(id) ON DELETE CASCADE,
      FOREIGN KEY (declarePar) REFERENCES Utilisateur(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS AffectationRessource (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      chantierId INTEGER NOT NULL,
      typeRessource TEXT NOT NULL CHECK (typeRessource IN ('Employe', 'Materiel')),
      ressourceId INTEGER NOT NULL,
      dateDebut DATE,
      dateFin DATE,
      role TEXT,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chantierId) REFERENCES Chantier(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS PhotoChantier (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      chantierId INTEGER NOT NULL,
      nom TEXT,
      donnees TEXT NOT NULL,
      contentType TEXT DEFAULT 'image/jpeg',
      taille INTEGER DEFAULT 0,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chantierId) REFERENCES Chantier(id) ON DELETE CASCADE
    )
  `).run();

  // ============================================================
  // 4. COMMERCIAL SUITE — Devis, Contrat, Factures
  // ============================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Devis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      clientId INTEGER NOT NULL,
      chantierId INTEGER,
      numero TEXT,
      reference TEXT,
      dateCreation DATE DEFAULT (date('now')),
      dateEmission DATE DEFAULT (date('now')),
      dateValidite DATE,
      tva REAL DEFAULT 20,
      montantHT REAL DEFAULT 0,
      montantTVA REAL DEFAULT 0,
      montantTTC REAL DEFAULT 0,
      montantTotal REAL DEFAULT 0,
      remiseGlobale REAL DEFAULT 0,
      acomptePourcent REAL DEFAULT 0,
      acompteMontant REAL DEFAULT 0,
      conditionsPaiement TEXT DEFAULT 'Comptant',
      modePaiement TEXT DEFAULT 'virement',
      objet TEXT,
      notes TEXT,
      conditionsGenerales TEXT,
      mentionsLegales TEXT,
      statut TEXT DEFAULT 'brouillon',
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id),
      FOREIGN KEY (clientId) REFERENCES Client(id),
      FOREIGN KEY (chantierId) REFERENCES Chantier(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS LigneDevis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      devisId INTEGER NOT NULL,
      description TEXT,
      reference TEXT,
      type TEXT DEFAULT 'produit',
      articleId INTEGER,
      quantite REAL DEFAULT 0,
      prixUnitaire REAL DEFAULT 0,
      tauxTVA REAL DEFAULT 20,
      remise REAL DEFAULT 0,
      unite TEXT,
      ligneTotal REAL DEFAULT 0,
      ligneTotalTTC REAL DEFAULT 0,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (devisId) REFERENCES Devis(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Contrat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER,
      devisId INTEGER,
      clientId INTEGER,
      chantierId INTEGER,
      reference TEXT,
      typeContrat TEXT DEFAULT 'travaux',
      dateSignature DATE,
      dateDebut DATE,
      dateFin DATE,
      montant REAL DEFAULT 0,
      montantHT REAL DEFAULT 0,
      montantTTC REAL DEFAULT 0,
      tva REAL DEFAULT 0,
      acompteVerse REAL DEFAULT 0,
      conditionsPaiement TEXT DEFAULT '30 jours',
      conditions TEXT,
      garantieMois INTEGER DEFAULT 0,
      objet TEXT,
      notes TEXT,
      statut TEXT DEFAULT 'en_cours',
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id),
      FOREIGN KEY (devisId) REFERENCES Devis(id),
      FOREIGN KEY (clientId) REFERENCES Client(id),
      FOREIGN KEY (chantierId) REFERENCES Chantier(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Facture (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      contratId INTEGER,
      clientId INTEGER,
      numero TEXT,
      dateEmission DATE DEFAULT (date('now')),
      dateEcheance DATE,
      montant REAL DEFAULT 0,
      montantHT REAL DEFAULT 0,
      montantTTC REAL DEFAULT 0,
      tva REAL DEFAULT 0,
      montantPaye REAL DEFAULT 0,
      statut TEXT DEFAULT 'emis',
      notes TEXT,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id),
      FOREIGN KEY (contratId) REFERENCES Contrat(id) ON DELETE CASCADE,
      FOREIGN KEY (clientId) REFERENCES Client(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Paiement (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      factureId INTEGER NOT NULL,
      entrepriseId INTEGER,
      datePaiement DATE DEFAULT (date('now')),
      montant REAL DEFAULT 0,
      modePaiement TEXT,
      reference TEXT,
      banque TEXT,
      notes TEXT,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (factureId) REFERENCES Facture(id) ON DELETE CASCADE
    )
  `).run();

  // ============================================================
  // 5. MODULE RESSOURCES HUMAINES
  // ============================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Employe (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      utilisateurId INTEGER,
      matricule TEXT,
      nom TEXT NOT NULL,
      prenom TEXT,
      poste TEXT,
      photo TEXT,
      dateEmbauche DATE,
      salaireBase REAL DEFAULT 0,
      telephone TEXT,
      email TEXT,
      adresse TEXT,
      statut TEXT DEFAULT 'actif',
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id),
      FOREIGN KEY (utilisateurId) REFERENCES Utilisateur(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS LoginHistory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      utilisateurId INTEGER NOT NULL,
      entrepriseId INTEGER,
      dateConnexion DATETIME DEFAULT CURRENT_TIMESTAMP,
      adresseIP TEXT,
      userAgent TEXT,
      reussi INTEGER DEFAULT 1,
      motifEchec TEXT,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (utilisateurId) REFERENCES Utilisateur(id),
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
    )
  `).run();

  // Table historique des postes (carrière d'un employé)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS HistoriquePoste (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entrepriseId INTEGER NOT NULL,
      employeId INTEGER NOT NULL,
      poste TEXT NOT NULL,
      typeContrat TEXT DEFAULT 'CDI',
      salaireBase REAL DEFAULT 0,
      dateDebut DATE NOT NULL,
      dateFin DATE,
      motifChangement TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employeId) REFERENCES Employe(id) ON DELETE CASCADE,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Equipe (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      chefEquipeId INTEGER,
      nom TEXT NOT NULL,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id),
      FOREIGN KEY (chefEquipeId) REFERENCES Employe(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS MembreEquipe (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      equipeId INTEGER NOT NULL,
      employeId INTEGER NOT NULL,
      dateAffectation DATE DEFAULT (date('now')),
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (equipeId) REFERENCES Equipe(id) ON DELETE CASCADE,
      FOREIGN KEY (employeId) REFERENCES Employe(id) ON DELETE CASCADE,
      UNIQUE(equipeId, employeId)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS AffectationChantier (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      employeId INTEGER NOT NULL,
      chantierId INTEGER NOT NULL,
      dateDebut DATE,
      dateFin DATE,
      role TEXT,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employeId) REFERENCES Employe(id) ON DELETE CASCADE,
      FOREIGN KEY (chantierId) REFERENCES Chantier(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Pointage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      employeId INTEGER NOT NULL,
      chantierId INTEGER,
      dateJour DATE NOT NULL,
      heureArrivee TIME,
      heureDepart TIME,
      statut TEXT DEFAULT 'present',
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employeId) REFERENCES Employe(id) ON DELETE CASCADE,
      FOREIGN KEY (chantierId) REFERENCES Chantier(id),
      UNIQUE(employeId, dateJour)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS HeureSupplementaire (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      employeId INTEGER NOT NULL,
      chantierId INTEGER,
      dateJour DATE NOT NULL,
      nombreHeures REAL DEFAULT 0,
      tauxMajoration REAL DEFAULT 1.5,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employeId) REFERENCES Employe(id) ON DELETE CASCADE,
      FOREIGN KEY (chantierId) REFERENCES Chantier(id)
    )
  `).run();

  // ============================================================
  // 6. MODULE MATÉRIELS
  // ============================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Materiel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      nom TEXT NOT NULL,
      designation TEXT,
      type TEXT,
      marque TEXT,
      modele TEXT,
      numeroSerie TEXT,
      dateAcquisition DATE,
      valeurAchat REAL DEFAULT 0,
      description TEXT,
      statut TEXT DEFAULT 'disponible',
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS AffectationMateriel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      materielId INTEGER NOT NULL,
      chantierId INTEGER NOT NULL,
      dateDebut DATE,
      dateFin DATE,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (materielId) REFERENCES Materiel(id) ON DELETE CASCADE,
      FOREIGN KEY (chantierId) REFERENCES Chantier(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Maintenance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      materielId INTEGER NOT NULL,
      type TEXT,
      dateMaintenance DATE DEFAULT (date('now')),
      cout REAL DEFAULT 0,
      description TEXT,
      prochaineDateEcheance DATE,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (materielId) REFERENCES Materiel(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS AlerteMateriel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      materielId INTEGER NOT NULL,
      type TEXT,
      message TEXT,
      dateAlerte DATETIME DEFAULT CURRENT_TIMESTAMP,
      statut TEXT DEFAULT 'ouverte',
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (materielId) REFERENCES Materiel(id) ON DELETE CASCADE
    )
  `).run();

  // ============================================================
  // 7. MODULE STOCKS
  // ============================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Article (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      nom TEXT NOT NULL,
      designation TEXT,
      reference TEXT,
      categorie TEXT,
      unite TEXT,
      prixUnitaire REAL DEFAULT 0,
      seuilAlerte REAL DEFAULT 0,
      quantiteStock REAL DEFAULT 0,
      stockActuel REAL DEFAULT 0,
      description TEXT,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Fournisseur (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      nom TEXT NOT NULL,
      contact TEXT,
      adresse TEXT,
      codePostal TEXT,
      ville TEXT,
      siret TEXT,
      telephone TEXT,
      email TEXT,
      conditionsPaiement TEXT,
      notes TEXT,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS MouvementStock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      articleId INTEGER NOT NULL,
      chantierId INTEGER,
      fournisseurId INTEGER,
      typeMouvement TEXT NOT NULL CHECK (typeMouvement IN ('entree', 'sortie')),
      quantite REAL NOT NULL,
      dateMouvement DATE DEFAULT (date('now')),
      motif TEXT,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (articleId) REFERENCES Article(id) ON DELETE CASCADE,
      FOREIGN KEY (chantierId) REFERENCES Chantier(id),
      FOREIGN KEY (fournisseurId) REFERENCES Fournisseur(id)
    )
  `).run();

  // ============================================================
  // 8. MODULE FINANCE & ALERTES
  // ============================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Depense (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      chantierId INTEGER NOT NULL,
      categorie TEXT,
      montant REAL DEFAULT 0,
      dateDepense DATE DEFAULT (date('now')),
      justificatif TEXT,
      valideePar INTEGER,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chantierId) REFERENCES Chantier(id) ON DELETE CASCADE,
      FOREIGN KEY (valideePar) REFERENCES Utilisateur(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS RapportFinancier (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      chantierId INTEGER NOT NULL,
      periode TEXT,
      chiffreAffaires REAL DEFAULT 0,
      depensesTotal REAL DEFAULT 0,
      marge REAL DEFAULT 0,
      dateGeneration DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chantierId) REFERENCES Chantier(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Alerte (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      typeEntite TEXT,
      entiteId INTEGER,
      titre TEXT,
      message TEXT,
      niveauGravite TEXT DEFAULT 'info',
      roleDestinataire TEXT,
      dateAlerte DATETIME DEFAULT CURRENT_TIMESTAMP,
      statut TEXT DEFAULT 'non_lue',
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
    )
  `).run();

  // ============================================================
  // 8B. BUDGETS PRÉVISIONNELS
  // ============================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS BudgetPrevisionnel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      chantierId INTEGER NOT NULL,
      periode TEXT NOT NULL,
      montantPrevu REAL DEFAULT 0,
      montantRealise REAL DEFAULT 0,
      dateCreation DATE DEFAULT (date('now')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id),
      FOREIGN KEY (chantierId) REFERENCES Chantier(id) ON DELETE CASCADE
    )
  `).run();

  // ============================================================
  // 8C. SOUS-TRAITANTS
  // ============================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS SousTraitant (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      nom TEXT NOT NULL,
      contact TEXT,
      email TEXT,
      telephone TEXT,
      adresse TEXT,
      specialite TEXT,
      statut TEXT DEFAULT 'actif',
      notes TEXT,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS AffectationSousTraitant (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      sousTraitantId INTEGER NOT NULL,
      chantierId INTEGER NOT NULL,
      dateDebut DATE,
      dateFin DATE,
      montantContrat REAL DEFAULT 0,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sousTraitantId) REFERENCES SousTraitant(id) ON DELETE CASCADE,
      FOREIGN KEY (chantierId) REFERENCES Chantier(id) ON DELETE CASCADE
    )
  `).run();

  // ============================================================
  // 8D. CATALOGUE DEVIS
  // ============================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS CatalogueDevis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      nom TEXT NOT NULL,
      categorie TEXT,
      description TEXT,
      lignes TEXT,
      tauxMarge REAL DEFAULT 0,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
    )
  `).run();

  // ============================================================
  // 8E. NOTIFICATIONS
  // ============================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS Notification (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      utilisateurId INTEGER,
      titre TEXT NOT NULL,
      message TEXT,
      type TEXT DEFAULT 'info',
      lu INTEGER DEFAULT 0,
      dateCreation DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id),
      FOREIGN KEY (utilisateurId) REFERENCES Utilisateur(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS SystemMetric (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      valeur REAL,
      donnees TEXT,
      dateMesure DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS UserTemplate (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER,
      nom TEXT NOT NULL,
      description TEXT,
      roleId INTEGER,
      donnees TEXT,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id),
      FOREIGN KEY (roleId) REFERENCES Role(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS CustomRole (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER,
      nom TEXT NOT NULL,
      description TEXT,
      code TEXT UNIQUE,
      isSystem INTEGER DEFAULT 0,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS CustomRolePermission (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customRoleId INTEGER NOT NULL,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      scope TEXT,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customRoleId) REFERENCES CustomRole(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS HabilitationChantier (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      utilisateurId INTEGER NOT NULL,
      chantierId INTEGER NOT NULL,
      module TEXT NOT NULL,
      permissions TEXT,
      dateDebut DATE,
      dateFin DATE,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (utilisateurId) REFERENCES Utilisateur(id) ON DELETE CASCADE,
      FOREIGN KEY (chantierId) REFERENCES Chantier(id) ON DELETE CASCADE,
      UNIQUE(utilisateurId, chantierId, module)
    )
  `).run();

  // ============================================================
  // 9B. DEMANDE DE SUPPORT (Ticketing utilisateur)
  // ============================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS DemandeSupport (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      utilisateurId INTEGER NOT NULL,
      sujet TEXT NOT NULL,
      description TEXT,
      priorite TEXT DEFAULT 'normale' CHECK (priorite IN ('basse', 'normale', 'haute', 'urgente')),
      statut TEXT DEFAULT 'ouverte' CHECK (statut IN ('ouverte', 'en_cours', 'resolue', 'fermee')),
      reponse TEXT,
      dateTraitement DATETIME,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id),
      FOREIGN KEY (utilisateurId) REFERENCES Utilisateur(id)
    )
  `).run();

  // ============================================================
  // 9C. CONFIGURATION D'INTÉGRATIONS (SAGE, QuickBooks, AD, Google)
  // ============================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS IntegrationConfig (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('SAGE', 'QUICKBOOKS', 'ACTIVE_DIRECTORY', 'GOOGLE_WORKSPACE', 'AUTRE')),
      nom TEXT NOT NULL,
      actif INTEGER DEFAULT 0,
      parametres TEXT,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
    )
  `).run();

  // ============================================================
  // 9D. CONFIGURATION SYSTÈME (Seuils de maintenance préventive, etc.)
  // ============================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS SystemConfig (
      cle TEXT PRIMARY KEY,
      valeur TEXT,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // ============================================================
  // 9. TABLE DE SYNCHRONISATION
  // ============================================================

  db.prepare(`
    CREATE TABLE IF NOT EXISTS SyncQueue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tableName TEXT NOT NULL,
      recordId INTEGER NOT NULL,
      serverId INTEGER,
      operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'push', 'pull')),
      payload TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'synced', 'failed', 'conflict', 'success', 'error')),
      retryCount INTEGER DEFAULT 0,
      errorMessage TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON SyncQueue(status)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_sync_queue_table_record ON SyncQueue(tableName, recordId)`).run();

  // ============================================================
  // MIGRATIONS AUTOMATIQUES
  // ============================================================

  const allTables = [
    'Entreprise', 'Role', 'Utilisateur', 'Preference',
    'Chantier', 'Phase', 'Incident', 'AffectationRessource',
    'Employe', 'HistoriquePoste', 'Equipe', 'MembreEquipe', 'AffectationChantier', 'Pointage', 'HeureSupplementaire',
    'Materiel', 'AffectationMateriel', 'Maintenance', 'AlerteMateriel',
    'Article', 'Fournisseur', 'MouvementStock',
    'Client', 'ClientAdresse', 'Devis', 'LigneDevis', 'Contrat', 'Facture', 'Paiement',
    'Depense', 'RapportFinancier', 'Alerte', 'LoginHistory',
    'BudgetPrevisionnel', 'SousTraitant', 'AffectationSousTraitant', 'CatalogueDevis', 'Notification',
    'SystemMetric', 'UserTemplate', 'CustomRole', 'CustomRolePermission', 'HabilitationChantier',
    'DemandeSupport', 'IntegrationConfig', 'SystemConfig'
  ];

  allTables.forEach(tableName => {
    ensureColumn(tableName, 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
    ensureColumn(tableName, 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
    ensureColumn(tableName, 'is_synced', 'INTEGER DEFAULT 0');
    ensureColumn(tableName, 'is_deleted', 'INTEGER DEFAULT 0');
  });

  // MIGRATIONS SPECIFIQUES - TABLE CHANTIER
  ensureColumn('Chantier', 'numero', 'TEXT');
  ensureColumn('Chantier', 'budgetPrevisionnel', 'REAL DEFAULT 0');
  ensureColumn('Chantier', 'budgetPrevu', 'REAL DEFAULT 0');
  ensureColumn('Chantier', 'budgetReel', 'REAL DEFAULT 0');
  ensureColumn('Chantier', 'margeCible', 'REAL DEFAULT 0');
  ensureColumn('Chantier', 'tva', 'REAL DEFAULT 20');
  ensureColumn('Chantier', 'codePostal', 'TEXT');
  ensureColumn('Chantier', 'ville', 'TEXT');
  ensureColumn('Chantier', 'latitude', 'REAL');
  ensureColumn('Chantier', 'longitude', 'REAL');
  ensureColumn('Chantier', 'chefChantierId', 'INTEGER');
  ensureColumn('Chantier', 'dateDebutReelle', 'DATE');
  ensureColumn('Chantier', 'dateFinReelle', 'DATE');

  // MIGRATIONS SPECIFIQUES - TABLE PHASE
  ensureColumn('Phase', 'description', 'TEXT');
  ensureColumn('Phase', 'budget', 'REAL DEFAULT 0');

  // MIGRATIONS SPECIFIQUES - TABLE AFFECTATION RESSOURCE
  ensureColumn('AffectationRessource', 'role', 'TEXT');

  // MIGRATIONS SPECIFIQUES - TABLE CLIENT
  ensureColumn('Client', 'type', "TEXT DEFAULT 'particulier'");
  ensureColumn('Client', 'civilite', 'TEXT');
  ensureColumn('Client', 'prenom', 'TEXT');
  ensureColumn('Client', 'entreprise', 'TEXT');
  ensureColumn('Client', 'siret', 'TEXT');
  ensureColumn('Client', 'numeroTVA', 'TEXT');
  ensureColumn('Client', 'adresse', 'TEXT');
  ensureColumn('Client', 'codePostal', 'TEXT');
  ensureColumn('Client', 'ville', 'TEXT');
  ensureColumn('Client', 'telephone', 'TEXT');
  ensureColumn('Client', 'portable', 'TEXT');
  ensureColumn('Client', 'email', 'TEXT');
  ensureColumn('Client', 'siteWeb', 'TEXT');
  ensureColumn('Client', 'notes', 'TEXT');
  ensureColumn('Client', 'conditionsPaiement', "TEXT DEFAULT '30 jours'");
  ensureColumn('Client', 'modePaiement', "TEXT DEFAULT 'virement'");
  ensureColumn('Client', 'encoursMax', 'REAL DEFAULT 0');
  ensureColumn('Client', 'commercialId', 'INTEGER');
  ensureColumn('Client', 'origine', 'TEXT');
  ensureColumn('Client', 'rib', 'TEXT');
  ensureColumn('Client', 'caTotal', 'REAL DEFAULT 0');
  ensureColumn('Client', 'encoursActuel', 'REAL DEFAULT 0');
  ensureColumn('Client', 'dernierContact', 'DATETIME');
  ensureColumn('Client', 'nbDevis', 'INTEGER DEFAULT 0');
  ensureColumn('Client', 'nbFactures', 'INTEGER DEFAULT 0');
  ensureColumn('Client', 'scoreCredit', 'REAL DEFAULT 0');
  ensureColumn('Client', 'dernierRappel', 'DATETIME');

  // MIGRATIONS ENTREPRISE
  ensureColumn('Entreprise', 'devise', "TEXT DEFAULT 'MGA'");
  ensureColumn('Entreprise', 'codePostal', 'TEXT');
  ensureColumn('Entreprise', 'ville', 'TEXT');
  ensureColumn('Entreprise', 'nomCommercial', 'TEXT');
  ensureColumn('Entreprise', 'siret', 'TEXT');
  ensureColumn('Entreprise', 'numeroTVA', 'TEXT');
  ensureColumn('Entreprise', 'codeAPE', 'TEXT');
  ensureColumn('Entreprise', 'siteWeb', 'TEXT');
  ensureColumn('Entreprise', 'prefixeDevis', "TEXT DEFAULT 'DEV'");
  ensureColumn('Entreprise', 'prefixeFacture', "TEXT DEFAULT 'FAC'");
  ensureColumn('Entreprise', 'prefixeContrat', "TEXT DEFAULT 'CTR'");

  // MIGRATIONS TABLE UTILISATEUR
  ensureColumn('Utilisateur', 'must_change_password', "INTEGER DEFAULT 1");
  ensureColumn('Utilisateur', 'credentialsDownloadedAt', 'DATETIME');
  ensureColumn('Utilisateur', 'plainPassword', 'TEXT');

  // MIGRATIONS TABLE ALERTE
  ensureColumn('Alerte', 'titre', 'TEXT');
  ensureColumn('Alerte', 'roleDestinataire', 'TEXT');

  // MIGRATIONS TABLE EMPLOYE
  ensureColumn('Employe', 'typeContrat', "TEXT DEFAULT 'CDI'");
  ensureColumn('Employe', 'dateDebutContrat', 'DATE');
  ensureColumn('Employe', 'dateFinContrat', 'DATE');
  ensureColumn('Employe', 'utilisateurId', 'INTEGER');

  // MIGRATIONS SPECIFIQUES - TABLE DEVIS
  ensureColumn('Devis', 'chantierId', 'INTEGER');
  ensureColumn('Devis', 'reference', 'TEXT');
  ensureColumn('Devis', 'dateEmission', 'DATE');
  ensureColumn('Devis', 'tva', 'REAL DEFAULT 20');
  ensureColumn('Devis', 'montantHT', 'REAL DEFAULT 0');
  ensureColumn('Devis', 'montantTVA', 'REAL DEFAULT 0');
  ensureColumn('Devis', 'montantTTC', 'REAL DEFAULT 0');
  ensureColumn('Devis', 'remiseGlobale', 'REAL DEFAULT 0');
  ensureColumn('Devis', 'acomptePourcent', 'REAL DEFAULT 0');
  ensureColumn('Devis', 'acompteMontant', 'REAL DEFAULT 0');
  ensureColumn('Devis', 'conditionsPaiement', "TEXT DEFAULT 'Comptant'");
  ensureColumn('Devis', 'modePaiement', "TEXT DEFAULT 'virement'");
  ensureColumn('Devis', 'objet', 'TEXT');
  ensureColumn('Devis', 'notes', 'TEXT');
  ensureColumn('Devis', 'conditionsGenerales', 'TEXT');
  ensureColumn('Devis', 'mentionsLegales', 'TEXT');
  ensureColumn('Devis', 'modeleDevis', 'TEXT');
  ensureColumn('Devis', 'tauxMarge', 'REAL DEFAULT 0');

  // MIGRATIONS SPECIFIQUES - TABLE LIGNEDEVIS
  ensureColumn('LigneDevis', 'reference', 'TEXT');
  ensureColumn('LigneDevis', 'type', "TEXT DEFAULT 'produit'");
  ensureColumn('LigneDevis', 'articleId', 'INTEGER');
  ensureColumn('LigneDevis', 'tauxTVA', 'REAL DEFAULT 20');
  ensureColumn('LigneDevis', 'remise', 'REAL DEFAULT 0');
  ensureColumn('LigneDevis', 'unite', 'TEXT');
  ensureColumn('LigneDevis', 'ligneTotal', 'REAL DEFAULT 0');
  ensureColumn('LigneDevis', 'ligneTotalTTC', 'REAL DEFAULT 0');

  // MIGRATIONS SPECIFIQUES - TABLE CONTRAT
  ensureColumn('Contrat', 'clientId', 'INTEGER');
  ensureColumn('Contrat', 'reference', 'TEXT');
  ensureColumn('Contrat', 'typeContrat', "TEXT DEFAULT 'travaux'");
  ensureColumn('Contrat', 'dateDebut', 'DATE');
  ensureColumn('Contrat', 'dateFin', 'DATE');
  ensureColumn('Contrat', 'montantHT', 'REAL DEFAULT 0');
  ensureColumn('Contrat', 'montantTTC', 'REAL DEFAULT 0');
  ensureColumn('Contrat', 'tva', 'REAL DEFAULT 0');
  ensureColumn('Contrat', 'acompteVerse', 'REAL DEFAULT 0');
  ensureColumn('Contrat', 'conditionsPaiement', "TEXT DEFAULT '30 jours'");
  ensureColumn('Contrat', 'conditions', 'TEXT');
  ensureColumn('Contrat', 'garantieMois', 'INTEGER DEFAULT 0');
  ensureColumn('Contrat', 'objet', 'TEXT');
  ensureColumn('Contrat', 'notes', 'TEXT');

  // MIGRATIONS SPECIFIQUES - TABLE ENTREPRISE (SMTP)
  ensureColumn('Entreprise', 'smtpHost', 'TEXT');
  ensureColumn('Entreprise', 'smtpPort', 'INTEGER DEFAULT 587');
  ensureColumn('Entreprise', 'smtpUser', 'TEXT');
  ensureColumn('Entreprise', 'smtpPass', 'TEXT');
  ensureColumn('Entreprise', 'smtpFrom', 'TEXT');
  ensureColumn('Entreprise', 'smtpSecure', 'INTEGER DEFAULT 1');

  // MIGRATIONS SPECIFIQUES - TABLE FACTURE
  ensureColumn('Facture', 'clientId', 'INTEGER');
  ensureColumn('Facture', 'montantHT', 'REAL DEFAULT 0');
  ensureColumn('Facture', 'tva', 'REAL DEFAULT 0');
  ensureColumn('Facture', 'notes', 'TEXT');
  ensureColumn('Facture', 'typeFacture', "TEXT DEFAULT 'normale'");
  ensureColumn('Facture', 'referenceExterne', 'TEXT');
  ensureColumn('Facture', 'datePaiementEffectif', 'DATETIME');
  ensureColumn('Facture', 'acomptePourcent', 'REAL DEFAULT 0');
  ensureColumn('Facture', 'acompteMontant', 'REAL DEFAULT 0');
  ensureColumn('Facture', 'retournePourcent', 'REAL DEFAULT 0');

  // MIGRATIONS SPECIFIQUES - TABLE PAIEMENT
  ensureColumn('Paiement', 'entrepriseId', 'INTEGER');
  ensureColumn('Paiement', 'reference', 'TEXT');
  ensureColumn('Paiement', 'banque', 'TEXT');
  ensureColumn('Paiement', 'notes', 'TEXT');

  // MIGRATIONS SPECIFIQUES - TABLE DEPENSE
  ensureColumn('Depense', 'codeBudgetaire', 'TEXT');
  ensureColumn('Depense', 'imputationChantier', 'TEXT');
  ensureColumn('Depense', 'statutValidation', "TEXT DEFAULT 'en_attente'");

  // ============================================================
  // 8B. MODULE BUDGETS PRÉVISIONNELS
  // ============================================================
  db.prepare(`
    CREATE TABLE IF NOT EXISTS BudgetPrevisionnel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      chantierId INTEGER NOT NULL,
      periode TEXT NOT NULL,
      montantPrevu REAL DEFAULT 0,
      montantRealise REAL DEFAULT 0,
      dateCreation DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chantierId) REFERENCES Chantier(id) ON DELETE CASCADE,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
    )
  `).run();

  // ============================================================
  // 8C. MODULE SOUS-TRAITANTS
  // ============================================================
  db.prepare(`
    CREATE TABLE IF NOT EXISTS SousTraitant (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      nom TEXT NOT NULL,
      contact TEXT,
      email TEXT,
      telephone TEXT,
      adresse TEXT,
      specialite TEXT,
      statut TEXT DEFAULT 'actif',
      notes TEXT,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS AffectationSousTraitant (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      sousTraitantId INTEGER NOT NULL,
      chantierId INTEGER NOT NULL,
      dateDebut DATE,
      dateFin DATE,
      montant REAL DEFAULT 0,
      statut TEXT DEFAULT 'en_cours',
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sousTraitantId) REFERENCES SousTraitant(id) ON DELETE CASCADE,
      FOREIGN KEY (chantierId) REFERENCES Chantier(id) ON DELETE CASCADE
    )
  `).run();

  // ============================================================
  // 8D. MODULE CATALOGUE DEVIS
  // ============================================================
  db.prepare(`
    CREATE TABLE IF NOT EXISTS CatalogueDevis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      nom TEXT NOT NULL,
      categorie TEXT,
      description TEXT,
      lignes TEXT,
      tva REAL DEFAULT 20,
      statut TEXT DEFAULT 'actif',
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
    )
  `).run();

  // ============================================================
  // 8E. MODULE NOTIFICATIONS
  // ============================================================
  db.prepare(`
    CREATE TABLE IF NOT EXISTS Notification (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      entrepriseId INTEGER NOT NULL,
      utilisateurId INTEGER NOT NULL,
      titre TEXT NOT NULL,
      message TEXT,
      type TEXT DEFAULT 'info',
      lu INTEGER DEFAULT 0,
      dateCreation DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_synced INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (utilisateurId) REFERENCES Utilisateur(id) ON DELETE CASCADE,
      FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
    )
  `).run();

  // ============================================================
  // TRIGGERS SQLite
  // ============================================================

  allTables.forEach(table => {
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trigger_${table}_updated_at
      AFTER UPDATE ON ${table}
      FOR EACH ROW
      WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NEW.updated_at
      BEGIN
        UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `).run();
  });

  // ============================================================
  // TRIGGERS MÉTIER — Notifications automatiques
  // ============================================================

  db.prepare(`
    CREATE TRIGGER IF NOT EXISTS trigger_depense_validation_notification
    AFTER INSERT ON Depense
    FOR EACH ROW
    WHEN NEW.statutValidation = 'en_attente_comptable'
    BEGIN
      INSERT INTO Notification (entrepriseId, titre, message, type, roleDestinataire, lu, dateCreation)
      VALUES (
        (SELECT entrepriseId FROM Chantier WHERE id = NEW.chantierId AND is_deleted = 0),
        'Dépense en attente de validation',
        'La dépense #' || NEW.id || ' d un montant de ' || COALESCE(NEW.montant, 0) || ' Ar nécessite une validation comptable.',
        'info',
        'COMPTABLE',
        0,
        CURRENT_TIMESTAMP
      );
    END
  `).run();

  db.prepare(`
    CREATE TRIGGER IF NOT EXISTS trigger_facture_emission_notification
    AFTER INSERT ON Facture
    FOR EACH ROW
    WHEN NEW.statut IN ('emise', 'envoyee', 'partiellement_payee')
    BEGIN
      INSERT INTO Notification (entrepriseId, titre, message, type, roleDestinataire, lu, dateCreation)
      VALUES (
        NEW.entrepriseId,
        'Nouvelle facture émise',
        'La facture ' || NEW.numero || ' d un montant de ' || COALESCE(NEW.montantTTC, NEW.montant, 0) || ' Ar a été émise.',
        'info',
        'COMMERCIAL',
        0,
        CURRENT_TIMESTAMP
      );
    END
  `).run();

  db.prepare(`
    CREATE TRIGGER IF NOT EXISTS trigger_incident_ouverture_notification
    AFTER INSERT ON Incident
    FOR EACH ROW
    BEGIN
      INSERT INTO Notification (entrepriseId, titre, message, type, roleDestinataire, lu, dateCreation)
      VALUES (
        (SELECT entrepriseId FROM Chantier WHERE id = NEW.chantierId AND is_deleted = 0),
        'Nouvel incident déclaré',
        'Un incident "' || NEW.titre || '" a été déclaré sur le chantier #' || NEW.chantierId || '.',
        'avertissement',
        'CHEF_CHANTIER',
        0,
        CURRENT_TIMESTAMP
      );
    END
  `).run();

  // ============================================================
  // TRIGGERS — Calcul automatique montantPaye dans Facture
  // ============================================================

  db.prepare(`
    CREATE TRIGGER IF NOT EXISTS trigger_paiement_insert_montantpaye
    AFTER INSERT ON Paiement
    FOR EACH ROW
    BEGIN
      UPDATE Facture
      SET montantPaye = (
        SELECT COALESCE(SUM(montant), 0) FROM Paiement WHERE factureId = NEW.factureId AND is_deleted = 0
      )
      WHERE id = NEW.factureId;
    END
  `).run();

  db.prepare(`
    CREATE TRIGGER IF NOT EXISTS trigger_paiement_update_montantpaye
    AFTER UPDATE ON Paiement
    FOR EACH ROW
    BEGIN
      UPDATE Facture
      SET montantPaye = (
        SELECT COALESCE(SUM(montant), 0) FROM Paiement WHERE factureId = NEW.factureId AND is_deleted = 0
      )
      WHERE id = NEW.factureId;
    END
  `).run();

  db.prepare(`
    CREATE TRIGGER IF NOT EXISTS trigger_paiement_delete_montantpaye
    AFTER DELETE ON Paiement
    FOR EACH ROW
    BEGIN
      UPDATE Facture
      SET montantPaye = (
        SELECT COALESCE(SUM(montant), 0) FROM Paiement WHERE factureId = OLD.factureId AND is_deleted = 0
      )
      WHERE id = OLD.factureId;
    END
  `).run();

  // ============================================================
  // TRIGGER — Purge automatique des anciennes notifications supprimées
  // ============================================================

  db.prepare(`
    CREATE TRIGGER IF NOT EXISTS trigger_notification_purge_anciennes
    AFTER UPDATE ON Notification
    FOR EACH ROW
    WHEN NEW.is_deleted = 1
    BEGIN
      DELETE FROM Notification WHERE is_deleted = 1 AND updated_at < datetime('now', '-90 days');
    END
  `).run();

  db.prepare(`
    UPDATE Chantier
    SET budgetPrevisionnel = COALESCE(budgetPrevisionnel, budgetPrevu, 0)
    WHERE COALESCE(budgetPrevisionnel, 0) = 0
  `).run();

  // ============================================================
  // SEED DATA
  // ============================================================

  const entCount = db.prepare('SELECT COUNT(*) as count FROM Entreprise').get().count;
  if (entCount === 0) {
    db.prepare(`
      INSERT OR IGNORE INTO Entreprise (id, server_id, nom, devise, is_synced)
      VALUES (1, 1, 'TIA Construction', 'MGA', 1)
    `).run();

    // Insertion des 9 rôles officiels selon roles_avec_admin_entreprise_tia_info_build.md
    const roles = [
      { id: 1, nom: 'Administrateur d\'Entreprise', code: 'ADMIN' },
      { id: 2, nom: 'Comptable / Responsable Financier', code: 'COMPTABLE' },
      { id: 3, nom: 'Direction Générale / DAF', code: 'DIRECTEUR' },
      { id: 4, nom: 'Chef de Chantier / Conducteur de Travaux', code: 'CHEF_CHANTIER' },
      { id: 5, nom: 'Chef de Projet / Directeur Technique', code: 'CHEF_PROJET' },
      { id: 6, nom: 'Responsable RH', code: 'RH' },
      { id: 7, nom: 'Responsable Matériel / Logisticien', code: 'MATERIEL' },
      { id: 8, nom: 'Magasinier / Responsable Stock', code: 'MAGASINIER' },
      { id: 9, nom: 'Commercial / Responsable Commercial', code: 'COMMERCIAL' }
    ];

    const insertRole = db.prepare(`INSERT OR IGNORE INTO Role (id, nom, code) VALUES (@id, @nom, @code)`);
    db.transaction(() => {
      for (const role of roles) insertRole.run(role);
    })();

  }

  console.log("Base de données initialisée et migrée avec succès !");
}

module.exports = { initDatabase };