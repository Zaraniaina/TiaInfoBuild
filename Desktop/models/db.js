const Database = require('better-sqlite3');
const path = require('path');

// La base de données sera stockée dans le dossier racine du projet Electron
const dbPath = path.join(__dirname, '..', 'tia_info_build.sqlite');
const db = new Database(dbPath, { verbose: console.log });

module.exports = db;
