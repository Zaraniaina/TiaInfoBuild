const BaseRepository = require('./BaseRepository');
const db = require('../db');

class EquipeRepository extends BaseRepository {
    constructor() {
        super('Equipe');
    }

    /**
     * Récupérer les équipes d'une entreprise avec leur chef
     * @param {number} entrepriseId - ID entreprise
     * @returns {Array} - Équipes
     */
    getByEntreprise(entrepriseId) {
        const stmt = db.prepare(`
            SELECT e.*, 
                chef.nom as chefNom, chef.prenom as chefPrenom,
                (SELECT COUNT(*) FROM MembreEquipe me WHERE me.equipeId = e.id AND me.is_deleted = 0) as nbMembres
            FROM Equipe e
            LEFT JOIN Employe chef ON e.chefEquipeId = chef.id AND chef.is_deleted = 0
            WHERE e.entrepriseId = ? AND e.is_deleted = 0
            ORDER BY e.nom
        `);
        return stmt.all(entrepriseId);
    }

    /**
     * Récupérer une équipe avec ses membres
     * @param {number} id - ID équipe
     * @returns {Object|null} - Équipe avec membres
     */
    getWithMembres(id) {
        const equipe = this.getById(id);
        if (!equipe) return null;

        const membres = db.prepare(`
            SELECT me.*, e.nom, e.prenom, e.poste, e.matricule
            FROM MembreEquipe me
            JOIN Employe e ON me.employeId = e.id AND e.is_deleted = 0
            WHERE me.equipeId = ? AND me.is_deleted = 0
            ORDER BY e.nom, e.prenom
        `).all(id);

        return { ...equipe, membres };
    }

    /**
     * Ajouter un membre à l'équipe
     * @param {number} equipeId - ID équipe
     * @param {number} employeId - ID employé
     * @returns {Object} - Membre créé
     */
    ajouterMembre(equipeId, employeId) {
        const MembreEquipeRepository = require('./MembreEquipeRepository');
        return new MembreEquipeRepository().create({ equipeId, employeId });
    }

    /**
     * Retirer un membre de l'équipe
     * @param {number} equipeId - ID équipe
     * @param {number} employeId - ID employé
     * @returns {boolean} - Succès
     */
    retirerMembre(equipeId, employeId) {
        const MembreEquipeRepository = require('./MembreEquipeRepository');
        const membre = db.prepare(`
            SELECT id FROM MembreEquipe 
            WHERE equipeId = ? AND employeId = ? AND is_deleted = 0
        `).get(equipeId, employeId);

        if (membre) {
            return new MembreEquipeRepository().softDelete(membre.id);
        }
        return false;
    }
}

module.exports = EquipeRepository;