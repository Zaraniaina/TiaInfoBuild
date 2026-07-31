const BaseRepository = require('./BaseRepository');
const db = require('../db');

class ClientRepository extends BaseRepository {
    constructor() {
        super('Client');
    }

    /**
     * Récupérer un client avec ses chantiers et devis
     * @param {number} id - ID client
     * @returns {Object|null} - Client avec relations
     */
    getWithRelations(id) {
        const client = this.getById(id);
        if (!client) return null;

        // Chantiers
        const chantiers = db.prepare(`
            SELECT id, nom, statut, budgetPrevu, budgetReel
            FROM Chantier 
            WHERE clientId = ? AND is_deleted = 0
            ORDER BY created_at DESC
        `).all(id);

        // Devis
        const devis = db.prepare(`
            SELECT id, dateCreation, dateValidite, montantTotal, statut
            FROM Devis 
            WHERE clientId = ? AND is_deleted = 0
            ORDER BY dateCreation DESC
        `).all(id);

        return { ...client, chantiers, devis };
    }

    /**
     * Rechercher des clients par nom/email/téléphone
     * @param {number} entrepriseId - ID entreprise
     * @param {string} searchTerm - Terme de recherche
     * @returns {Array} - Clients correspondants
     */
    search(entrepriseId, searchTerm) {
        if (!searchTerm) return this.getAll({ entrepriseId });

        return this.getAll({
            entrepriseId,
            where: '(nom LIKE ? OR email LIKE ? OR telephone LIKE ? OR adresse LIKE ?)',
            params: Array(4).fill(`%${searchTerm}%`)
        });
    }
}

module.exports = ClientRepository;