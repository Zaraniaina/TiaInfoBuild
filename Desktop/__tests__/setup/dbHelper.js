/**
 * Helper de base de données pour les tests.
 * - initTestDb() : ouvre la BDD temporaire et crée le schéma complet
 * - resetData()  : vide toutes les tables et ré-insère le seed minimal
 * - closeDb()    : ferme la BDD et supprime les fichiers temporaires
 */
const fs = require('fs');
const crypto = require('crypto');

const ALL_TABLES = [
  'SyncQueue', 'RapportFinancier', 'Alerte', 'Depense',
  'Paiement', 'Facture', 'Contrat', 'LigneDevis', 'Devis', 'Client',
  'MouvementStock', 'Fournisseur', 'Article',
  'AlerteMateriel', 'Maintenance', 'AffectationMateriel', 'Materiel',
  'HeureSupplementaire', 'Pointage', 'AffectationChantier',
  'MembreEquipe', 'Equipe', 'Employe',
  'AffectationRessource', 'Incident', 'Phase', 'Chantier',
  'Preference', 'Utilisateur', 'Role', 'Entreprise'
];

let db = null;

function initTestDb() {
  db = require('../../models/db');
  const { initDatabase } = require('../../models/init');
  initDatabase();
  return db;
}

function getDb() {
  return db;
}

function resetData() {
  db.exec('PRAGMA foreign_keys = OFF');
  ALL_TABLES.forEach(t => db.prepare(`DELETE FROM ${t}`).run());
  db.exec('PRAGMA foreign_keys = ON');

  // Seed minimal identique à init.js
  const adminHash = crypto.createHash('sha256').update('admin123').digest('hex');
  db.prepare(`INSERT INTO Entreprise (id, server_id, nom, devise, is_synced)
              VALUES (1, 1, 'TIA Construction', '€', 1)`).run();
  db.prepare(`INSERT INTO Role (id, nom, code) VALUES (1, 'Administrateur', 'ADMIN')`).run();
  db.prepare(`INSERT INTO Utilisateur (id, nom, prenom, email, motDePasseHash, roleId, entrepriseId, is_synced)
              VALUES (1, 'Admin', 'TIA', 'admin@tiabuild.com', ?, 1, 1, 1)`).run(adminHash);
}

function closeDb() {
  if (db) {
    try { db.close(); } catch (e) { /* ignoré */ }
    db = null;
  }
  const dbPath = process.env.TIA_TEST_DB_PATH;
  if (dbPath) {
    [dbPath, dbPath + '-wal', dbPath + '-shm'].forEach(f => {
      try { fs.unlinkSync(f); } catch (e) { /* ignoré */ }
    });
  }
}

module.exports = { initTestDb, getDb, resetData, closeDb, ALL_TABLES };