const db = require('./db');

function initDatabase() {
    // Activer les clés étrangères
    db.pragma('foreign_keys = ON');

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
            is_deleted INTEGER DEFAULT 0
        )
    `).run();

    // Table Chantier
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Chantier (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            entrepriseId INTEGER,
            clientId INTEGER,
            chefChantierId INTEGER,
            nom TEXT NOT NULL,
            adresse TEXT,
            dateDebut DATE,
            dateFinPrevue DATE,
            dateFinReelle DATE,
            budgetPrevu REAL,
            budgetReel REAL,
            statut TEXT,
            description TEXT,
            is_synced INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0
        )
    `).run();

    // Table Employe
    db.prepare(`
        CREATE TABLE IF NOT EXISTS Employe (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER UNIQUE,
            entrepriseId INTEGER,
            matricule TEXT,
            nom TEXT NOT NULL,
            prenom TEXT,
            poste TEXT,
            dateEmbauche DATE,
            salaireBase REAL,
            telephone TEXT,
            statut TEXT,
            is_synced INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0
        )
    `).run();

    console.log("Base de données initialisée avec succès !");
}

module.exports = { initDatabase };
