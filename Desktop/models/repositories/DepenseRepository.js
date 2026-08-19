// Desktop/models/repositories/DepenseRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class DepenseRepository extends BaseRepository {
  constructor() {
    super('Depense');
  }

  /**
   * Récupérer les dépenses d'un chantier
   * @param {number} chantierId - ID chantier
   * @returns {Array} - Dépenses
   */
  getByChantier(chantierId) {
    const stmt = db.prepare(`
      SELECT d.*, u.nom as valideeParNom, u.prenom as valideeParPrenom
      FROM Depense d
      LEFT JOIN Utilisateur u ON d.valideePar = u.id AND u.is_deleted = 0
      WHERE d.chantierId = ? AND d.is_deleted = 0
      ORDER BY d.dateDepense DESC
    `);
    return stmt.all(chantierId);
  }

  /**
   * Total des dépenses d'un chantier
   * @param {number} chantierId - ID chantier
   * @returns {number} - Montant total
   */
  getTotalByChantier(chantierId) {
    const stmt = db.prepare(`
      SELECT SUM(montant) as total FROM Depense
      WHERE chantierId = ? AND is_deleted = 0
    `);
    const result = stmt.get(chantierId);
    return result?.total || 0;
  }

  /**
   * Dépenses par catégorie pour un chantier
   * @param {number} chantierId - ID chantier
   * @returns {Array} - Dépenses groupées par catégorie
   */
  getByCategorie(chantierId) {
    const stmt = db.prepare(`
      SELECT categorie, SUM(montant) as total, COUNT(*) as count
      FROM Depense
      WHERE chantierId = ? AND is_deleted = 0
      GROUP BY categorie
      ORDER BY total DESC
    `);
    return stmt.all(chantierId);
  }

  /**
   * Dépenses en attente de validation par le comptable
   * @param {number} entrepriseId - ID entreprise
   * @returns {Array} - Dépenses en attente de validation comptable
   */
  getEnAttenteComptable(entrepriseId) {
    const stmt = db.prepare(`
      SELECT d.*, c.nom as chantierNom, u.nom as valideeParNom, u.prenom as valideeParPrenom
      FROM Depense d
      JOIN Chantier c ON d.chantierId = c.id
      LEFT JOIN Utilisateur u ON d.valideePar = u.id AND u.is_deleted = 0
      WHERE c.entrepriseId = ? AND d.is_deleted = 0 AND c.is_deleted = 0
      AND d.statutValidation = 'en_attente_comptable'
      ORDER BY d.dateDepense DESC
    `);
    return stmt.all(entrepriseId);
  }

  getEnAttenteValidation(entrepriseId) {
    const stmt = db.prepare(`
      SELECT d.*, c.nom as chantierNom, u.nom as valideeParNom, u.prenom as valideeParPrenom
      FROM Depense d
      JOIN Chantier c ON d.chantierId = c.id
      LEFT JOIN Utilisateur u ON d.valideePar = u.id AND u.is_deleted = 0
      WHERE c.entrepriseId = ? AND d.is_deleted = 0 AND c.is_deleted = 0
      AND (d.valideePar IS NULL OR d.valideePar = 0)
      ORDER BY d.dateDepense DESC
    `);
    return stmt.all(entrepriseId);
  }

  /**
   * Historique des validations d'une dépense
   * @param {number} depenseId - ID dépense
   * @returns {Array} - Historique
   */
  getHistoriqueValidations(depenseId) {
    const stmt = db.prepare(`
      SELECT d.statutValidation, d.valideePar, d.updated_at, u.nom, u.prenom
      FROM Depense d
      LEFT JOIN Utilisateur u ON d.valideePar = u.id AND u.is_deleted = 0
      WHERE d.id = ? AND d.is_deleted = 0
      ORDER BY d.updated_at DESC
    `);
    return stmt.all(depenseId);
  }
}

module.exports = DepenseRepository;