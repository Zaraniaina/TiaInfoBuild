const BaseRepository = require('./BaseRepository');
const db = require('../db');

/**
 * PhaseRepository
 *
 * Handles CRUD for Phase entities and provides helper methods used by
 * ChantierController.  The repository follows the same pattern as the
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
        const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE chantierId = ? AND is_deleted = 0 ORDER BY ordre`);
        return stmt.all(chantierId);
    }

    /**
     * Update the avancement percentage of a phase.
     * @param {number} id
     * @param {number} pct
     * @returns {Object|null}
     */
    updateAvancement(id, pct) {
        const stmt = this.db.prepare(`UPDATE ${this.tableName} SET avancementPct = ?, updated_at = CURRENT_TIMESTAMP WHERE ${this.primaryKey} = ? AND is_deleted = 0`);
        stmt.run(pct, id);
        return this.getById(id);
    }

    /**
     * Reorder phases for a chantier.
     * @param {number} chantierId
     * @param {Array<number>} ids - Ordered list of phase ids
     */
    reorder(chantierId, ids) {
        const stmt = this.db.prepare(`UPDATE ${this.tableName} SET ordre = ?, updated_at = CURRENT_TIMESTAMP WHERE chantierId = ? AND ${this.primaryKey} = ? AND is_deleted = 0`);
        const tx = this.db.transaction(() => {
            ids.forEach((id, index) => {
                stmt.run(index + 1, chantierId, id);
            });
        });
        tx();
    }

    /**
     * Get global avancement for a chantier.
     * @param {number} chantierId
     * @returns {number}
     */
    getAvancementGlobal(chantierId) {
        const stmt = this.db.prepare(`SELECT AVG(avancementPct) as avg FROM ${this.tableName} WHERE chantierId = ? AND is_deleted = 0`);
        const row = stmt.get(chantierId);
        return row?.avg ?? 0;
    }
}

module.exports = PhaseRepository;
