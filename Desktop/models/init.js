const db = require('./db');

function columnExists(tableName, columnName) {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return rows.some(row => row.name === columnName);
}

function ensureColumn(tableName, columnName, definition) {
    if (!columnExists(tableName, columnName)) {
        db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
    }
}

function initDatabase() {
    // Activer les clés étrangères
    db.pragma('foreign_keys = ON');

    // ============================================================
    // MODULE TRANVERSE — Entreprise, Rôle, Utilisateur
    // ============================================================

    // Table Entreprise (multi-tenant)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Entreprise (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            nom TEXT NOT NULL,
            adresse TEXT,
            telephone TEXT,
            email TEXT,
            logo TEXT,
            abonnement TEXT,
            dateCreation DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_synced INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // Table Role
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

    // Table Utilisateur (Modèle Transverse)
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
            statut TEXT,
            dateCreation DATETIME DEFAULT CURRENT_TIMESTAMP,
            derniereConnexion DATETIME,
            is_synced INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id),
            FOREIGN KEY (roleId) REFERENCES Role(id)
        )
    `).run();

    // ============================================================
    // MODULE CHANTIERS
    // ============================================================

    // Table Chantier
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Chantier (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            entrepriseId INTEGER NOT NULL,
            clientId INTEGER,
            chefChantierId INTEGER,
            nom TEXT NOT NULL,
            adresse TEXT,
            dateDebut DATE,
            dateFinPrevue DATE,
            dateFinReelle DATE,
            budgetPrevu REAL DEFAULT 0,
            budgetReel REAL DEFAULT 0,
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

    // Table Phase
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Phase (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            chantierId INTEGER NOT NULL,
            nom TEXT NOT NULL,
            description TEXT,
            dateDebut DATE,
            dateFin DATE,
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

    // Table Incident
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

    // Table AffectationRessource (pivot générique Employe/Materiel)
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

    // ============================================================
    // MODULE RESSOURCES HUMAINES
    // ============================================================

    // Table Employe
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Employe (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            entrepriseId INTEGER NOT NULL,
            matricule TEXT,
            nom TEXT NOT NULL,
            prenom TEXT,
            poste TEXT,
            dateEmbauche DATE,
            salaireBase REAL DEFAULT 0,
            telephone TEXT,
            statut TEXT DEFAULT 'actif',
            is_synced INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
        )
    `).run();

    // Table Equipe
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

    // Table MembreEquipe
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

    // Table AffectationChantier (Employe <-> Chantier)
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

    // Table Pointage
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

    // Table HeureSupplementaire
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
    // MODULE MATÉRIELS
    // ============================================================

    // Table Materiel
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Materiel (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            entrepriseId INTEGER NOT NULL,
            nom TEXT NOT NULL,
            type TEXT,
            numeroSerie TEXT,
            dateAcquisition DATE,
            valeurAchat REAL DEFAULT 0,
            statut TEXT DEFAULT 'disponible',
            is_synced INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
        )
    `).run();

    // Table AffectationMateriel
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

    // Table Maintenance
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

    // Table AlerteMateriel
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
    // MODULE STOCKS
    // ============================================================

    // Table Article
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Article (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            entrepriseId INTEGER NOT NULL,
            nom TEXT NOT NULL,
            categorie TEXT,
            unite TEXT,
            seuilAlerte REAL DEFAULT 0,
            quantiteStock REAL DEFAULT 0,
            is_synced INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
        )
    `).run();

    // Table Fournisseur
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Fournisseur (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            entrepriseId INTEGER NOT NULL,
            nom TEXT NOT NULL,
            contact TEXT,
            adresse TEXT,
            telephone TEXT,
            email TEXT,
            is_synced INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
        )
    `).run();

    // Table MouvementStock
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
    // MODULE COMMERCIAL
    // ============================================================

    // Table Client
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Client (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            entrepriseId INTEGER NOT NULL,
            nom TEXT NOT NULL,
            type TEXT,
            adresse TEXT,
            telephone TEXT,
            email TEXT,
            is_synced INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
        )
    `).run();

    // Table Devis
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Devis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            entrepriseId INTEGER NOT NULL,
            clientId INTEGER NOT NULL,
            dateCreation DATE DEFAULT (date('now')),
            dateValidite DATE,
            montantTotal REAL DEFAULT 0,
            statut TEXT DEFAULT 'brouillon',
            is_synced INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id),
            FOREIGN KEY (clientId) REFERENCES Client(id)
        )
    `).run();

    // Table LigneDevis
    db.prepare(`
        CREATE TABLE IF NOT EXISTS LigneDevis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            devisId INTEGER NOT NULL,
            description TEXT,
            quantite REAL DEFAULT 0,
            prixUnitaire REAL DEFAULT 0,
            is_synced INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (devisId) REFERENCES Devis(id) ON DELETE CASCADE
        )
    `).run();

    // Table Contrat
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Contrat (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            devisId INTEGER,
            chantierId INTEGER,
            dateSignature DATE,
            montant REAL DEFAULT 0,
            statut TEXT DEFAULT 'en_cours',
            is_synced INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (devisId) REFERENCES Devis(id),
            FOREIGN KEY (chantierId) REFERENCES Chantier(id)
        )
    `).run();

    // Table Facture
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Facture (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            contratId INTEGER NOT NULL,
            dateEmission DATE DEFAULT (date('now')),
            dateEcheance DATE,
            montant REAL DEFAULT 0,
            statut TEXT DEFAULT 'emis',
            is_synced INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (contratId) REFERENCES Contrat(id) ON DELETE CASCADE
        )
    `).run();

    // Table Paiement
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Paiement (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            factureId INTEGER NOT NULL,
            datePaiement DATE DEFAULT (date('now')),
            montant REAL DEFAULT 0,
            modePaiement TEXT,
            is_synced INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (factureId) REFERENCES Facture(id) ON DELETE CASCADE
        )
    `).run();

    // ============================================================
    // MODULE FINANCE & AIDE À LA DÉCISION
    // ============================================================

    // Table Depense
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

    // Table RapportFinancier
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

    // Table Alerte (transverse générique)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Alerte (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            entrepriseId INTEGER NOT NULL,
            typeEntite TEXT,
            entiteId INTEGER,
            message TEXT,
            niveauGravite TEXT DEFAULT 'info',
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
    // TABLE DE SYNCHRONISATION (Queue)
    // ============================================================

    // Table SyncQueue pour l'offline-first sync
    db.prepare(`
        CREATE TABLE IF NOT EXISTS SyncQueue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tableName TEXT NOT NULL,
            recordId INTEGER NOT NULL,
            serverId INTEGER,
            operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
            payload TEXT, -- JSON string
            status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'synced', 'failed', 'conflict')),
            retryCount INTEGER DEFAULT 0,
            errorMessage TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // Index pour performance sync
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON SyncQueue(status)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_sync_queue_table_record ON SyncQueue(tableName, recordId)`).run();

    // Triggers pour updated_at automatique
    const tablesWithUpdatedAt = [
        'Entreprise', 'Role', 'Utilisateur',
        'Chantier', 'Phase', 'Incident', 'AffectationRessource',
        'Employe', 'Equipe', 'MembreEquipe', 'AffectationChantier', 'Pointage', 'HeureSupplementaire',
        'Materiel', 'AffectationMateriel', 'Maintenance', 'AlerteMateriel',
        'Article', 'Fournisseur', 'MouvementStock',
        'Client', 'Devis', 'LigneDevis', 'Contrat', 'Facture', 'Paiement',
        'Depense', 'RapportFinancier', 'Alerte'
    ];

    tablesWithUpdatedAt.forEach(table => {
        db.prepare(`
            CREATE TRIGGER IF NOT EXISTS trigger_${table}_updated_at
            AFTER UPDATE ON ${table}
            FOR EACH ROW
            BEGIN
                UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
        `).run();
    });

    // Compatibilité avec la base existante (ajout de colonnes manquantes)
    ensureColumn('Chantier', 'budgetPrevisionnel', 'REAL DEFAULT 0');
    ensureColumn('Phase', 'budget', 'REAL DEFAULT 0');
    ensureColumn('Article', 'stockActuel', 'REAL DEFAULT 0');
    ensureColumn('Article', 'prixUnitaire', 'REAL DEFAULT 0');
    ensureColumn('Facture', 'montantTTC', 'REAL DEFAULT 0');
    ensureColumn('Facture', 'montantPaye', 'REAL DEFAULT 0');
    ensureColumn('Employe', 'photo', 'TEXT');

    const tablesWithTimestamps = [
        'Entreprise', 'Role', 'Utilisateur',
        'Chantier', 'Phase', 'Incident', 'AffectationRessource',
        'Employe', 'Equipe', 'MembreEquipe', 'AffectationChantier', 'Pointage', 'HeureSupplementaire',
        'Materiel', 'AffectationMateriel', 'Maintenance', 'AlerteMateriel',
        'Article', 'Fournisseur', 'MouvementStock',
        'Client', 'Devis', 'LigneDevis', 'Contrat', 'Facture', 'Paiement',
        'Depense', 'RapportFinancier', 'Alerte'
    ];

    tablesWithTimestamps.forEach(tableName => {
        ensureColumn(tableName, 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        ensureColumn(tableName, 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
    });

    db.prepare(`UPDATE Chantier SET budgetPrevisionnel = COALESCE(budgetPrevisionnel, budgetPrevu, 0) WHERE COALESCE(budgetPrevisionnel, 0) = 0`).run();
    db.prepare(`UPDATE Article SET stockActuel = COALESCE(stockActuel, quantiteStock, 0) WHERE COALESCE(stockActuel, 0) = 0`).run();
    db.prepare(`UPDATE Facture SET montantTTC = COALESCE(montantTTC, montant, 0) WHERE COALESCE(montantTTC, 0) = 0`).run();
    db.prepare(`UPDATE Facture SET montantPaye = COALESCE(montantPaye, 0)`).run();

    // Initial Seed Data si base vide (Permet la première connexion immédiate)
    const entCount = db.prepare('SELECT COUNT(*) as count FROM Entreprise').get().count;
    if (entCount === 0) {
        const crypto = require('crypto');
        const adminHash = crypto.createHash('sha256').update('admin123').digest('hex');
        db.prepare(`INSERT OR IGNORE INTO Entreprise (id, server_id, nom, is_synced) VALUES (1, 1, 'TIA Construction', 1)`).run();
        db.prepare(`INSERT OR IGNORE INTO Role (id, nom, code) VALUES (1, 'Administrateur', 'ADMIN')`).run();
        db.prepare(`INSERT OR IGNORE INTO Utilisateur (id, server_id, nom, prenom, email, motDePasseHash, roleId, entrepriseId, is_synced) VALUES (1, 1, 'Admin', 'TIA', 'admin@tiabuild.com', ?, 1, 1, 1)`).run(adminHash);
    }

    console.log("Base de données initialisée avec succès ! (toutes tables créées)");
}

module.exports = { initDatabase };