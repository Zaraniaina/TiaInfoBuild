// Desktop/models/repositories/HeureSupplementaireRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class HeureSupplementaireRepository extends BaseRepository {
  constructor() {
    super('HeureSupplementaire');
  }

  /**
   * Récupérer les heures sup d'un employé
   * @param {number} employeId - ID employé
   * @param {Object} options - { dateDebut, dateFin, limit, offset }
   * @returns {Array} - Heures sup
   */
  getByEmploye(employeId, options = {}) {
    const { dateDebut, dateFin, limit = 50, offset = 0 } = options;
    let whereClause = 'WHERE hs.employeId = ? AND hs.is_deleted = 0';
    const params = [employeId];
    if (dateDebut) {
      whereClause += ' AND hs.dateJour >= ?';
      params.push(dateDebut);
    }
    if (dateFin) {
      whereClause += ' AND hs.dateJour <= ?';
      params.push(dateFin);
    }
    const sql = `
      SELECT hs.*, c.nom as chantierNom
      FROM HeureSupplementaire hs
      LEFT JOIN Chantier c ON hs.chantierId = c.id AND c.is_deleted = 0
      ${whereClause}
      ORDER BY hs.dateJour DESC
      LIMIT ? OFFSET ?
    `;
    const stmt = db.prepare(sql);
    return stmt.all(...params, limit, offset);
  }

  /**
   * Récupérer les heures sup d'un chantier
   * @param {number} chantierId - ID chantier
   * @returns {Array} - Heures sup
   */
  getByChantier(chantierId) {
    const stmt = db.prepare(`
      SELECT hs.*, e.nom as employeNom, e.prenom as employePrenom
      FROM HeureSupplementaire hs
      JOIN Employe e ON hs.employeId = e.id AND e.is_deleted = 0
      WHERE hs.chantierId = ? AND hs.is_deleted = 0
      ORDER BY hs.dateJour DESC
    `);
    return stmt.all(chantierId);
  }

  /**
   * Total heures sup par employé sur une période
   * @param {number} employeId - ID employé
   * @param {string} dateDebut - Date début
   * @param {string} dateFin - Date fin
   * @returns {number} - Total heures
   */
  getTotalByEmploye(employeId, dateDebut, dateFin) {
    const stmt = db.prepare(`
      SELECT SUM(nombreHeures) as total
      FROM HeureSupplementaire
      WHERE employeId = ? AND is_deleted = 0
      AND dateJour BETWEEN ? AND ?
    `);
    const result = stmt.get(employeId, dateDebut, dateFin);
    return result?.total || 0;
  }

  /**
   * Coût total des heures sup pour un chantier
   * @param {number} chantierId - ID chantier
   * @returns {number} - Coût total
   */
  getCoutByChantier(chantierId) {
    const stmt = db.prepare(`
      SELECT SUM(hs.nombreHeures * hs.tauxMajoration * e.salaireBase / 173.33) as total
      FROM HeureSupplementaire hs
      JOIN Employe e ON hs.employeId = e.id AND e.is_deleted = 0
      WHERE hs.chantierId = ? AND hs.is_deleted = 0
    `);
    const result = stmt.get(chantierId);
    return result?.total || 0;
  }
}

module.exports = HeureSupplementaireRepository;