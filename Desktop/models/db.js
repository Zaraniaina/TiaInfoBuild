// Desktop/models/db.js
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.TIA_TEST_DB
  ? process.env.TIA_TEST_DB
  : path.join(__dirname, '..', 'tia_info_build.sqlite');

const verbose = process.env.NODE_ENV === 'development' ? console.log : null;

const db = new Database(dbPath, { verbose });

db.pragma('journal_mode = WAL');

module.exports = db;