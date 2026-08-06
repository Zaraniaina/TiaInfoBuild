const Database = require('better-sqlite3');
const path = require('path');

// En production/dév : BDD racine du projet.
// En test (Jest) : BDD temporaire dans /tmp définie par le setup Jest.
const dbPath = process.env.TIA_TEST_DB_PATH 
    || path.join(__dirname, '..', 'tia_info_build.sqlite');

// Mode verbose uniquement en développement
const verbose = process.env.NODE_ENV === 'development' ? console.log : null;

const db = new Database(dbPath, { verbose });

// Performances : activer WAL pour des écritures concurrentes non bloquantes
db.pragma('journal_mode = WAL');

module.exports = db;