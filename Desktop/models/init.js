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
        } catch (e) {
            console.warn(`Note: Impossible d'ajouter ${columnName} à ${tableName}: ${e.message}`);
        }
    }
}

function initDatabase() {
    db.pragma('foreign_keys = ON');

    // 1. MODULE TRANVERSE — Entreprise, Rôle, Utilisateur
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Entreprise (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            nom TEXT NOT NULL,
            adresse TEXT,
            codePostal TEXT,
            ville TEXT,
            telephone TEXT,
            email TEXT,
            logo TEXT,
            abonnement TEXT,
            devise TEXT DEFAULT 'MGA',
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

    // 2. MODULE COMMERCIAL — Client
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Client (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            entrepriseId INTEGER NOT NULL,
            nom TEXT NOT NULL,
            type TEXT,
            adresse TEXT,
            codePostal TEXT,
            ville TEXT,
            siret TEXT,
            telephone TEXT,
            email TEXT,
            notes TEXT,
            is_synced INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
        )
    `).run();

    // 3. MODULE CHANTIERS
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Chantier (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            entrepriseId INTEGER NOT NULL,
            clientId INTEGER,
            chefChantierId INTEGER,
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

    // 4. COMMERCIAL SUITE — Devis, Contrat, Factures
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Devis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            entrepriseId INTEGER NOT NULL,
            clientId INTEGER NOT NULL,
            numero TEXT,
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

    db.prepare(`
        CREATE TABLE IF NOT EXISTS Contrat (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            entrepriseId INTEGER,
            devisId INTEGER,
            chantierId INTEGER,
            dateSignature DATE,
            montant REAL DEFAULT 0,
            statut TEXT DEFAULT 'en_cours',
            is_synced INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id),
            FOREIGN KEY (devisId) REFERENCES Devis(id),
            FOREIGN KEY (chantierId) REFERENCES Chantier(id)
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS Facture (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            entrepriseId INTEGER NOT NULL,
            contratId INTEGER NOT NULL,
            numero TEXT,
            dateEmission DATE DEFAULT (date('now')),
            dateEcheance DATE,
            montant REAL DEFAULT 0,
            montantTTC REAL DEFAULT 0,
            montantPaye REAL DEFAULT 0,
            statut TEXT DEFAULT 'emis',
            is_synced INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id),
            FOREIGN KEY (contratId) REFERENCES Contrat(id) ON DELETE CASCADE
        )
    `).run();

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

    // 5. MODULE RESSOURCES HUMAINES
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Employe (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            entrepriseId INTEGER NOT NULL,
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

    // 6. MODULE MATÉRIELS
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

    // 7. MODULE STOCKS
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

    // 8. MODULE FINANCE & ALERTES
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

    // 9. TABLE DE SYNCHRONISATION
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

    // Migrations de colonnes
    const allTables = [
        'Entreprise', 'Role', 'Utilisateur', 'Preference',
        'Chantier', 'Phase', 'Incident', 'AffectationRessource',
        'Employe', 'Equipe', 'MembreEquipe', 'AffectationChantier', 'Pointage', 'HeureSupplementaire',
        'Materiel', 'AffectationMateriel', 'Maintenance', 'AlerteMateriel',
        'Article', 'Fournisseur', 'MouvementStock',
        'Client', 'Devis', 'LigneDevis', 'Contrat', 'Facture', 'Paiement',
        'Depense', 'RapportFinancier', 'Alerte'
    ];

    allTables.forEach(tableName => {
        ensureColumn(tableName, 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        ensureColumn(tableName, 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        ensureColumn(tableName, 'is_synced', 'INTEGER DEFAULT 0');
        ensureColumn(tableName, 'is_deleted', 'INTEGER DEFAULT 0');
    });

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
    ensureColumn('Entreprise', 'tvaDefaut', "TEXT DEFAULT '20'");
    ensureColumn('Entreprise', 'delaiPaiementDefaut', "TEXT DEFAULT '30 jours'");
    ensureColumn('Entreprise', 'validiteDevis', 'INTEGER DEFAULT 30');
    ensureColumn('Entreprise', 'mentionsLegales', 'TEXT');

    ensureColumn('Chantier', 'budgetPrevisionnel', 'REAL DEFAULT 0');
    ensureColumn('Chantier', 'codePostal', 'TEXT');
    ensureColumn('Chantier', 'ville', 'TEXT');

    ensureColumn('Phase', 'budget', 'REAL DEFAULT 0');

    ensureColumn('Article', 'designation', 'TEXT');
    ensureColumn('Article', 'reference', 'TEXT');
    ensureColumn('Article', 'stockActuel', 'REAL DEFAULT 0');
    ensureColumn('Article', 'prixUnitaire', 'REAL DEFAULT 0');
    ensureColumn('Article', 'description', 'TEXT');

    ensureColumn('Fournisseur', 'codePostal', 'TEXT');
    ensureColumn('Fournisseur', 'ville', 'TEXT');
    ensureColumn('Fournisseur', 'siret', 'TEXT');
    ensureColumn('Fournisseur', 'conditionsPaiement', 'TEXT');
    ensureColumn('Fournisseur', 'notes', 'TEXT');

    ensureColumn('Client', 'codePostal', 'TEXT');
    ensureColumn('Client', 'ville', 'TEXT');
    ensureColumn('Client', 'siret', 'TEXT');
    ensureColumn('Client', 'notes', 'TEXT');

    ensureColumn('Materiel', 'designation', 'TEXT');
    ensureColumn('Materiel', 'marque', 'TEXT');
    ensureColumn('Materiel', 'modele', 'TEXT');
    ensureColumn('Materiel', 'description', 'TEXT');

    ensureColumn('Devis', 'numero', 'TEXT');
    ensureColumn('Contrat', 'entrepriseId', 'INTEGER');
    ensureColumn('Facture', 'numero', 'TEXT');
    ensureColumn('Facture', 'entrepriseId', 'INTEGER');
    ensureColumn('Facture', 'montantTTC', 'REAL DEFAULT 0');
    ensureColumn('Facture', 'montantPaye', 'REAL DEFAULT 0');

    ensureColumn('Employe', 'photo', 'TEXT');
    ensureColumn('Employe', 'email', 'TEXT');
    ensureColumn('Employe', 'adresse', 'TEXT');

    // Triggers SQLite
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

    db.prepare(`UPDATE Chantier SET budgetPrevisionnel = COALESCE(budgetPrevisionnel, budgetPrevu, 0) WHERE COALESCE(budgetPrevisionnel, 0) = 0`).run();
    db.prepare(`UPDATE Article SET stockActuel = COALESCE(stockActuel, quantiteStock, 0) WHERE COALESCE(stockActuel, 0) = 0`).run();
    db.prepare(`UPDATE Facture SET montantTTC = COALESCE(montantTTC, montant, 0) WHERE COALESCE(montantTTC, 0) = 0`).run();
    db.prepare(`UPDATE Facture SET montantPaye = COALESCE(montantPaye, 0)`).run();
    db.prepare(`UPDATE Devis SET numero = 'DEV-' || id WHERE numero IS NULL OR numero = ''`).run();
    db.prepare(`UPDATE Facture SET numero = 'FAC-' || id WHERE numero IS NULL OR numero = ''`).run();
    db.prepare(`UPDATE Contrat SET entrepriseId = (SELECT entrepriseId FROM Devis WHERE Devis.id = Contrat.devisId) WHERE entrepriseId IS NULL AND devisId IS NOT NULL`).run();

    // Initial Seed Data si la BDD est vide
    const entCount = db.prepare('SELECT COUNT(*) as count FROM Entreprise').get().count;
    if (entCount === 0) {
        const crypto = require('crypto');
        const adminHash = crypto.createHash('sha256').update('admin123').digest('hex');
        db.prepare(`INSERT OR IGNORE INTO Entreprise (id, server_id, nom, devise, is_synced) VALUES (1, 1, 'TIA Construction', 'MGA', 1)`).run();
        db.prepare(`INSERT OR IGNORE INTO Role (id, nom, code) VALUES (1, 'Administrateur', 'ADMIN')`).run();
        db.prepare(`INSERT OR IGNORE INTO Utilisateur (id, server_id, nom, prenom, email, motDePasseHash, roleId, entrepriseId, is_synced) VALUES (1, 1, 'Admin', 'TIA', 'admin@tiabuild.com', ?, 1, 1, 1)`).run(adminHash);
    }

    console.log("Base de données initialisée avec succès !");
}

module.exports = { initDatabase };