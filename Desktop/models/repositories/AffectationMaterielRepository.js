const BaseRepository = require('./BaseRepository');
const db = require('../db');

/**
 * AffectationMaterielRepository
 * Affectation d'un matériel sur un chantier (vue Matériels)
 * Met à jour automatiquement le statut du matériel.
 */
class AffectationMaterielRepository extends BaseRepository {
  constructor() {
    super('AffectationMateriel');
  }

  /**
   * Affectations d'un matériel
   * @param {number} materielId
   * @returns {Array}
   */
  getByMateriel(materielId) {
    const stmt = db.prepare(`
      SELECT am.*, c.nom as chantierNom
      FROM AffectationMateriel am
      JOIN Chantier c ON am.chantierId = c.id AND c.is_deleted = 0
      WHERE am.materielId = ? AND am.is_deleted = 0
      ORDER BY am.dateDebut DESC
    `);
    return stmt.all(materielId);
  }

  /**
   * Affectations actives d'un chantier
   * @param {number} chantierId
   * @returns {Array}
   */
  getByChantier(chantierId) {
    const stmt = db.prepare(`
      SELECT am.*, m.nom as materielNom, m.type as materielType
      FROM AffectationMateriel am
      JOIN Materiel m ON am.materielId = m.id AND m.is_deleted = 0
      WHERE am.chantierId = ? AND am.is_deleted = 0 AND am.dateFin IS NULL
      ORDER BY am.dateDebut DESC
    `);
    return stmt.all(chantierId);
  }

  /**
   * Affecter un matériel à un chantier
   * @param {Object} data - { materielId, chantierId, dateDebut, dateFin }
   * @returns {Object}
   */
  affecter(data) {
    if (!data || !data.materielId || !data.chantierId) {
      throw new Error('Le matériel et le chantier sont obligatoires.');
    }

    const existing = db.prepare(`
      SELECT id FROM AffectationMateriel
      WHERE materielId = ? AND dateFin IS NULL AND is_deleted = 0
    `).get(data.materielId);
    if (existing) throw new Error('Ce matériel est déjà affecté à un chantier.');

    const affectation = this.create({
      ...data,
      dateDebut: data.dateDebut || new Date().toISOString().split('T')[0],
      is_synced: 0
    });

    // Le matériel passe "en service"
    db.prepare(`
      UPDATE Materiel SET statut = 'en_service', is_synced = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(data.materielId);

    return affectation;
  }

  /**
   * Retirer un matériel du chantier (dateFin + statut redevient disponible)
   * @param {number} id - ID affectation
   * @returns {Object|null}
   */
  retirer(id) {
    const affectation = this.getById(id);
    if (!affectation) throw new Error('Affectation introuvable.');

    const updated = this.update(id, { dateFin: new Date().toISOString().split('T')[0] });

    // Si plus aucune affectation active → redevient disponible
    const active = db.prepare(`
      SELECT COUNT(*) as c FROM AffectationMateriel
      WHERE materielId = ? AND dateFin IS NULL AND is_deleted = 0
    `).get(affectation.materielId);

    if ((active?.c || 0) === 0) {
      db.prepare(`
        UPDATE Materiel SET statut = 'disponible', is_synced = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(affectation.materielId);
    }

    return updated;
  }
}

module.exports = AffectationMaterielRepository;