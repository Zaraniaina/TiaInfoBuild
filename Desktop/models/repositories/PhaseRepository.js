const BaseRepository = require('./BaseRepository');
const db = require('../db');

class PhaseRepository extends BaseRepository {
    constructor() {
        super('Phase');
    }

    /**
     * Récupérer les phases d'un chantier
     * @param {number} chantierId - ID du chantier
     * @returns {Array} - Liste des phases
     */
    getByChantier(chantierId) {
        const stmt = db.prepare(`
            SELECT * FROM Phase 
            WHERE chantierId = ? AND is_deleted = 0 
            ORDER BY ordre
        `);
        return stmt.all(chantierId);
    }

    /**
     * Mettre à jour l'avancement d'une phase
     * @param {number} id - ID de la phase
     * @param {number} avancementPct - Pourcentage d'avancement (0-100)
     * @returns {Object|null} - Phase mise à jour
     */
    updateAvancement(id, avancementPct) {
        if (avancementPct < 0 || avancementPct > 100) {
            throw new Error('L\'avancement doit être entre 0 et 100');
        }

        const newStatut = avancementPct === 100 ? 'terminee' :
            avancementPct > 0 ? 'en_cours' : 'non_commencee';

        return this.update(id, { avancementPct, statut: newStatut });
    }

    /**
     * Réorganiser l'ordre des phases
     * @param {number} chantierId - ID du chantier
     * @param {Array} phaseIds - Tableau des IDs dans le nouvel ordre
     * @returns {boolean} - Succès
     */
    reorder(chantierId, phaseIds) {
        const transaction = db.transaction((ids) => {
            ids.forEach((id, index) => {
                db.prepare('UPDATE Phase SET ordre = ?, is_synced = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND chantierId = ?')
                    .run(index + 1, id, chantierId);
            });
        });

        transaction(phaseIds);
        return true;
    }

    /**
     * Obtenir le pourcentage d'avancement global d'un chantier
     * @param {number} chantierId - ID du chantier
     * @returns {number} - Pourcentage global
     */
    getAvancementGlobal(chantierId) {
        const phases = this.getByChantier(chantierId);
        if (!phases.length) return 0;

        const total = phases.reduce((sum, p) => sum + (p.avancementPct || 0), 0);
        return Math.round(total / phases.length);
    }
}

module.exports = PhaseRepository;