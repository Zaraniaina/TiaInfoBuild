const BaseRepository = require('./BaseRepository');
const db = require('../db');

class IncidentRepository extends BaseRepository {
    constructor() {
        super('Incident');
    }

    /**
     * Récupérer les incidents d'un chantier
     * @param {number} chantierId - ID du chantier
     * @returns {Array} - Liste des incidents
     */
    getByChantier(chantierId) {
        const stmt = db.prepare(`
            SELECT i.*, u.nom as declareParNom, u.prenom as declareParPrenom
            FROM Incident i
            LEFT JOIN Utilisateur u ON i.declarePar = u.id AND u.is_deleted = 0
            WHERE i.chantierId = ? AND i.is_deleted = 0
            ORDER BY i.dateIncident DESC
        `);
        return stmt.all(chantierId);
    }

    /**
     * Changer le statut d'un incident
     * @param {number} id - ID de l'incident
     * @param {string} statut - Nouveau statut
     * @returns {Object|null} - Incident mis à jour
     */
    changerStatut(id, statut) {
        const statutsValides = ['signale', 'en_cours', 'resolu', 'clos'];
        if (!statutsValides.includes(statut)) {
            throw new Error(`Statut invalide. Valeurs acceptées: ${statutsValides.join(', ')}`);
        }
        return this.update(id, { statut });
    }

    /**
     * Obtenir les incidents non résolus par entreprise
     * @param {number} entrepriseId - ID entreprise
     * @returns {Array} - Incidents ouverts
     */
    getOuvertsByEntreprise(entrepriseId) {
        const stmt = db.prepare(`
            SELECT i.*, c.nom as chantierNom
            FROM Incident i
            JOIN Chantier c ON i.chantierId = c.id
            WHERE c.entrepriseId = ? AND i.is_deleted = 0 AND c.is_deleted = 0
            AND i.statut IN ('signale', 'en_cours')
            ORDER BY 
                CASE i.gravite 
                    WHEN 'critique' THEN 1 
                    WHEN 'elevee' THEN 2 
                    WHEN 'moyenne' THEN 3 
                    WHEN 'faible' THEN 4 
                END,
                i.dateIncident DESC
        `);
        return stmt.all(entrepriseId);
    }
}

module.exports = IncidentRepository;