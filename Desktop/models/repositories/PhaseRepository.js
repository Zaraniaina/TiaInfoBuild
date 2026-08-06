const BaseRepository = require('./BaseRepository');
const db = require('../db');

/**
 * PhaseRepository
 *
 * Handles CRUD for Phase entities and provides helper methods used by
 * ChantierController. The repository follows the same pattern as the
 * other repositories in the project.
 */
class PhaseRepository extends BaseRepository {
  constructor() {
    super('Phase');
  }

  /**
   * Get all phases for a given chantier.
   * @param {number} chantierId
   * @returns {Array}
   */
  getByChantier(chantierId) {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName} WHERE chantierId = ? AND is_deleted = 0 ORDER BY ordre`
    );
    return stmt.all(chantierId);
  }

  /**
   * Update the avancement percentage of a phase.
   * - Clamp entre 0 et 100
   * - Met à jour le statut automatiquement
   * - Marque l'enregistrement comme non synchronisé (is_synced = 0)
   * @param {number} id
   * @param {number} pct
   * @returns {Object|null}
   */
  updateAvancement(id, pct) {
    const safePct = Math.max(0, Math.min(100, parseInt(pct, 10) || 0));
    const stmt = this.db.prepare(`
      UPDATE ${this.tableName}
      SET avancementPct = ?,
          statut = CASE
            WHEN ? >= 100 THEN 'terminee'
            WHEN ? > 0 THEN 'en_cours'
            ELSE statut
          END,
          is_synced = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE ${this.primaryKey} = ? AND is_deleted = 0
    `);
    stmt.run(safePct, safePct, safePct, id);
    return this.getById(id);
  }

  /**
   * Reorder phases for a chantier.
   * Marque chaque phase modifiée comme non synchronisée.
   * @param {number} chantierId
   * @param {Array<number>} ids - Ordered list of phase ids
   * @returns {Array} - Phases réordonnées
   */
  reorder(chantierId, ids) {
    if (!Array.isArray(ids) || ids.length === 0) return this.getByChantier(chantierId);
    const stmt = this.db.prepare(
      `UPDATE ${this.tableName}
       SET ordre = ?, is_synced = 0, updated_at = CURRENT_TIMESTAMP
       WHERE chantierId = ? AND ${this.primaryKey} = ? AND is_deleted = 0`
    );
    const tx = this.db.transaction(() => {
      ids.forEach((id, index) => {
        stmt.run(index + 1, chantierId, id);
      });
    });
    tx();
    return this.getByChantier(chantierId);
  }

  /**
   * Get global avancement for a chantier.
   * @param {number} chantierId
   * @returns {number}
   */
  getAvancementGlobal(chantierId) {
    const stmt = this.db.prepare(
      `SELECT AVG(avancementPct) as avg FROM ${this.tableName} WHERE chantierId = ? AND is_deleted = 0`
    );
    const row = stmt.get(chantierId);
    return row?.avg ?? 0;
  }
}

module.exports = PhaseRepository;