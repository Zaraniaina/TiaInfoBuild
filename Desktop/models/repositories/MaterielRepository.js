// Desktop/models/repositories/MaterielRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class MaterielRepository extends BaseRepository {
  constructor() {
    super('Materiel');
  }

  /**
   * Récupérer les matériels d'une entreprise
   * @param {number} entrepriseId - ID entreprise
   * @param {Object} options - { limit, offset, statut, search, type }
   * @returns {Array} - Matériels
   */
  getByEntreprise(entrepriseId, options = {}) {
    const { limit = 50, offset = 0, statut, search, type } = options;
    let whereClause = '';
    const params = [];

    if (statut) {
      whereClause += ' AND statut = ?';
      params.push(statut);
    }
    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }
    if (search) {
      whereClause += ' AND (nom LIKE ? OR numeroSerie LIKE ? OR type LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    const sql = `
      SELECT m.*,
        (SELECT COUNT(*) FROM AffectationMateriel am WHERE am.materielId = m.id AND am.is_deleted = 0 AND am.dateFin IS NULL) as enService
      FROM Materiel m
      WHERE m.entrepriseId = ? AND m.is_deleted = 0
      ${whereClause}
      ORDER BY m.nom
      LIMIT ? OFFSET ?
    `;
    const stmt = db.prepare(sql);
    return stmt.all(entrepriseId, ...params, limit, offset);
  }

  /**
   * Récupérer un matériel avec ses affectations et maintenances
   * @param {number} id - ID matériel
   * @returns {Object|null} - Matériel avec relations
   */
  getWithRelations(id) {
    const materiel = this.getById(id);
    if (!materiel) return null;

    // Affectations actuelles
    const affectations = db.prepare(`
      SELECT am.*, c.nom as chantierNom
      FROM AffectationMateriel am
      JOIN Chantier c ON am.chantierId = c.id AND c.is_deleted = 0
      WHERE am.materielId = ? AND am.is_deleted = 0
      ORDER BY am.dateDebut DESC
    `).all(id);

    // Maintenances
    const maintenances = db.prepare(`
      SELECT * FROM Maintenance
      WHERE materielId = ? AND is_deleted = 0
      ORDER BY dateMaintenance DESC
    `).all(id);

    // Alertes
    const alertes = db.prepare(`
      SELECT * FROM AlerteMateriel
      WHERE materielId = ? AND is_deleted = 0
      ORDER BY dateAlerte DESC
    `).all(id);

    return { ...materiel, affectations, maintenances, alertes };
  }

  /**
   * Matériels disponibles (non affectés)
   * @param {number} entrepriseId - ID entreprise
   * @returns {Array} - Matériels disponibles
   */
  getDisponibles(entrepriseId) {
    const stmt = db.prepare(`
      SELECT m.* FROM Materiel m
      WHERE m.entrepriseId = ? AND m.is_deleted = 0 AND m.statut = 'disponible'
      AND NOT EXISTS (
        SELECT 1 FROM AffectationMateriel am
        WHERE am.materielId = m.id AND am.is_deleted = 0 AND am.dateFin IS NULL
      )
      ORDER BY m.nom
    `);
    return stmt.all(entrepriseId);
  }

  /**
   * Matériels nécessitant une maintenance (prochaine échéance dépassée)
   * @param {number} entrepriseId - ID entreprise
   * @returns {Array} - Matériels en retard de maintenance
   */
  getMaintenanceEnRetard(entrepriseId) {
    const today = new Date().toISOString().split('T')[0];
    const stmt = db.prepare(`
      SELECT m.*,
        MAX(mt.prochaineDateEcheance) as prochaineEcheance
      FROM Materiel m
      JOIN Maintenance mt ON m.id = mt.materielId AND mt.is_deleted = 0
      WHERE m.entrepriseId = ? AND m.is_deleted = 0
      AND mt.prochaineDateEcheance < ?
      GROUP BY m.id
      ORDER BY prochaineEcheance
    `);
    return stmt.all(entrepriseId, today);
  }

  /**
   * Statistiques matériels pour dashboard
   * @param {number} entrepriseId - ID entreprise
   * @returns {Object} - KPIs
   */
  getDashboardStats(entrepriseId) {
    const stats = {};

    // Total
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM Materiel
      WHERE entrepriseId = ? AND is_deleted = 0
    `).get(entrepriseId);
    stats.total = total.count;

    // Par statut
    const parStatut = db.prepare(`
      SELECT statut, COUNT(*) as count FROM Materiel
      WHERE entrepriseId = ? AND is_deleted = 0
      GROUP BY statut
    `).all(entrepriseId);
    stats.parStatut = parStatut.reduce((acc, row) => { acc[row.statut] = row.count; return acc; }, {});

    // En service
    const enService = db.prepare(`
      SELECT COUNT(DISTINCT m.id) as count
      FROM Materiel m
      JOIN AffectationMateriel am ON m.id = am.materielId
      WHERE m.entrepriseId = ? AND m.is_deleted = 0 AND am.is_deleted = 0
      AND am.dateFin IS NULL
    `).get(entrepriseId);
    stats.enService = enService.count;

    // Maintenance en retard
    const retard = db.prepare(`
      SELECT COUNT(DISTINCT m.id) as count
      FROM Materiel m
      JOIN Maintenance mt ON m.id = mt.materielId
      WHERE m.entrepriseId = ? AND m.is_deleted = 0 AND mt.is_deleted = 0
      AND mt.prochaineDateEcheance < date('now')
    `).get(entrepriseId);
    stats.maintenanceEnRetard = retard.count;

    // Valeur totale
    const valeur = db.prepare(`
      SELECT SUM(valeurAchat) as total FROM Materiel
      WHERE entrepriseId = ? AND is_deleted = 0
    `).get(entrepriseId);
    stats.valeurTotale = valeur.total || 0;

    return stats;
  }
}

module.exports = MaterielRepository;