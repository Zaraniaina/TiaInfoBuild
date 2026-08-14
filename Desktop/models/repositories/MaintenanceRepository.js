// Desktop/models/repositories/MaintenanceRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class MaintenanceRepository extends BaseRepository {
  constructor() {
    super('Maintenance');
  }

  /**
   * Récupérer les maintenances d'un matériel
   * @param {number} materielId - ID matériel
   * @returns {Array} - Maintenances
   */
  getByMateriel(materielId) {
    const stmt = db.prepare(`
      SELECT * FROM Maintenance
      WHERE materielId = ? AND is_deleted = 0
      ORDER BY dateMaintenance DESC
    `);
    return stmt.all(materielId);
  }

  /**
   * Maintenances à venir (prochaine échéance)
   * @param {number} entrepriseId - ID entreprise
   * @param {number} jours - Nombre de jours à l'avance
   * @returns {Array} - Maintenances à venir
   */
  getAVenir(entrepriseId, jours = 30) {
    const dateLimite = new Date();
    dateLimite.setDate(dateLimite.getDate() + jours);
    const dateLimiteStr = dateLimite.toISOString().split('T')[0];

    const stmt = db.prepare(`
      SELECT m.*, mat.nom as materielNom, mat.numeroSerie
      FROM Maintenance m
      JOIN Materiel mat ON m.materielId = mat.id AND mat.is_deleted = 0
      WHERE mat.entrepriseId = ? AND m.is_deleted = 0
      AND m.prochaineDateEcheance IS NOT NULL
      AND m.prochaineDateEcheance <= ?
      AND m.prochaineDateEcheance >= date('now', 'localtime')
      ORDER BY m.prochaineDateEcheance
    `);
    return stmt.all(entrepriseId, dateLimiteStr);
  }

  /**
   * Coût total maintenance par matériel
   * @param {number} materielId - ID matériel
   * @returns {number} - Coût total
   */
  getCoutTotalByMateriel(materielId) {
    const stmt = db.prepare(`
      SELECT SUM(cout) as total FROM Maintenance
      WHERE materielId = ? AND is_deleted = 0
    `);
    const result = stmt.get(materielId);
    return result?.total || 0;
  }

  /**
   * Maintenances par type
   * @param {number} entrepriseId - ID entreprise
   * @returns {Array} - Stats par type
   */
  getStatsByType(entrepriseId) {
    const stmt = db.prepare(`
      SELECT m.type, COUNT(*) as count, SUM(m.cout) as totalCout
      FROM Maintenance m
      JOIN Materiel mat ON m.materielId = mat.id
      WHERE mat.entrepriseId = ? AND m.is_deleted = 0 AND mat.is_deleted = 0
      GROUP BY m.type
      ORDER BY count DESC
    `);
    return stmt.all(entrepriseId);
  }
}

module.exports = MaintenanceRepository;