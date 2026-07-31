const BaseRepository = require('./BaseRepository');
const db = require('../db');

class ContratRepository extends BaseRepository {
    constructor() {
        super('Contrat');
    }

    /**
     * Récupérer un contrat avec son devis et chantier
     * @param {number} id - ID contrat
     * @returns {Object|null} - Contrat avec relations
     */
    getWithRelations(id) {
        const contrat = this.getById(id);
        if (!contrat) return null;

        const devis = contrat.devisId
            ? db.prepare('SELECT * FROM Devis WHERE id = ? AND is_deleted = 0').get(contrat.devisId)
            : null;

        const chantier = contrat.chantierId
            ? db.prepare('SELECT * FROM Chantier WHERE id = ? AND is_deleted = 0').get(contrat.chantierId)
            : null;

        const factures = db.prepare(`
            SELECT * FROM Facture WHERE contratId = ? AND is_deleted = 0
            ORDER BY dateEmission DESC
        `).all(id);

        return { ...contrat, devis, chantier, factures };
    }
}

module.exports = ContratRepository;