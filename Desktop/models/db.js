const Database = require('better-sqlite3');
const path = require('path');

// La base de données est stockée dans le dossier racine du projet Electron
const dbPath = path.join(__dirname, '..', 'tia_info_build.sqlite');

// Mode verbose uniquement en développement (évite de polluer les logs en production)
const verbose = process.env.NODE_ENV === 'development' ? console.log : null;

const db = new Database(dbPath, { verbose });

// Performances : activer WAL pour des écritures concurrentes non bloquantes
db.pragma('journal_mode = WAL');

module.exports = db;
