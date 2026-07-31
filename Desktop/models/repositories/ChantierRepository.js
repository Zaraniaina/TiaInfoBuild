const BaseRepository = require('./BaseRepository');
const db = require('../db');

class ChantierRepository extends BaseRepository {
    constructor() {
        super('Chantier');
    }

    /**
     * Récupérer un chantier avec ses relations (phases, incidents, etc.)
     * @param {number} id - ID local du chantier
     * @returns {Object|null} - Chantier avec relations
     */
    getWithRelations(id) {
        const chantier = this.getById(id);
        if (!chantier) return null;

        // Phases
        const phases = db.prepare(`
            SELECT * FROM Phase 
            WHERE chantierId = ? AND is_deleted = 0 
            ORDER BY ordre
        `).all(id);

        // Incidents
        const incidents = db.prepare(`
            SELECT i.*, u.nom as declareParNom, u.prenom as declareParPrenom
            FROM Incident i
            LEFT JOIN Utilisateur u ON i.declarePar = u.id
            WHERE i.chantierId = ? AND i.is_deleted = 0
            ORDER BY i.dateIncident DESC
        `).all(id);

        // Affectations ressources (employés + matériels)
        const affectations = db.prepare(`
            SELECT ar.*, 
                e.nom as employeNom, e.prenom as employePrenom,
                m.nom as materielNom, m.type as materielType
            FROM AffectationRessource ar
            LEFT JOIN Employe e ON ar.typeRessource = 'Employe' AND ar.ressourceId = e.id
            LEFT JOIN Materiel m ON ar.typeRessource = 'Materiel' AND ar.ressourceId = m.id
            WHERE ar.chantierId = ? AND ar.is_deleted = 0
            ORDER BY ar.dateDebut
        `).all(id);

        // Client
        let client = null;
        if (chantier.clientId) {
            client = db.prepare('SELECT * FROM Client WHERE id = ? AND is_deleted = 0').get(chantier.clientId);
        }

        // Chef de chantier
        let chefChantier = null;
        if (chantier.chefChantierId) {
            chefChantier = db.prepare('SELECT id, nom, prenom, email FROM Utilisateur WHERE id = ? AND is_deleted = 0').get(chantier.chefChantierId);
        }

        return {
            ...chantier,
            phases,
            incidents,
            affectations,
            client,
            chefChantier
        };
    }

    /**
     * Récupérer la liste des chantiers avec infos résumées (pour liste)
     * @param {Object} options - { entrepriseId, limit, offset, statut, search }
     * @returns {Array} - Liste des chantiers avec comptages
     */
    getListWithStats(options = {}) {
        const { entrepriseId, limit = 50, offset = 0, statut, search } = options;

        let whereClause = '';
        const params = [];

        if (statut) {
            whereClause += ' AND statut = ?';
            params.push(statut);
        }

        if (search) {
            whereClause += ' AND (nom LIKE ? OR adresse LIKE ? OR description LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        const sql = `
            SELECT c.*, 
                cl.nom as clientNom,
                u.nom as chefNom, u.prenom as chefPrenom,
                (SELECT COUNT(*) FROM Phase WHERE chantierId = c.id AND is_deleted = 0) as nbPhases,
                (SELECT COUNT(*) FROM Incident WHERE chantierId = c.id AND is_deleted = 0) as nbIncidents,
                (SELECT COUNT(*) FROM AffectationRessource WHERE chantierId = c.id AND is_deleted = 0) as nbRessources
            FROM Chantier c
            LEFT JOIN Client cl ON c.clientId = cl.id AND cl.is_deleted = 0
            LEFT JOIN Utilisateur u ON c.chefChantierId = u.id AND u.is_deleted = 0
            ${this._entrepriseWhere(entrepriseId).replace('WHERE', '')}
            ${whereClause}
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const stmt = db.prepare(sql);
        return stmt.all(...params, limit, offset);
    }

    /**
     * Compter les chantiers avec filtres
     * @param {Object} options - { entrepriseId, statut, search }
     * @returns {number} - Total
     */
    countWithFilters(options = {}) {
        const { entrepriseId, statut, search } = options;

        let whereClause = '';
        const params = [];

        if (statut) {
            whereClause += ' AND statut = ?';
            params.push(statut);
        }

        if (search) {
            whereClause += ' AND (nom LIKE ? OR adresse LIKE ? OR description LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        const sql = `
            SELECT COUNT(*) as total 
            FROM Chantier 
            ${this._entrepriseWhere(entrepriseId).replace('WHERE', '')}
            ${whereClause}
        `;

        const stmt = db.prepare(sql);
        const result = stmt.get(...params);
        return result?.total || 0;
    }

    /**
     * Obtenir les statistiques globales pour le dashboard
     * @param {number} entrepriseId - ID entreprise
     * @returns {Object} - KPIs
     */
    getDashboardStats(entrepriseId) {
        const stats = {};

        // Chantiers par statut
        const parStatut = db.prepare(`
            SELECT statut, COUNT(*) as count 
            FROM Chantier 
            WHERE entrepriseId = ? AND is_deleted = 0
            GROUP BY statut
        `).all(entrepriseId);
        stats.parStatut = parStatut.reduce((acc, row) => { acc[row.statut] = row.count; return acc; }, {});

        // Budget total prévu vs réel
        const budgets = db.prepare(`
            SELECT 
                SUM(budgetPrevu) as budgetPrevuTotal,
                SUM(budgetReel) as budgetReelTotal
            FROM Chantier 
            WHERE entrepriseId = ? AND is_deleted = 0
        `).get(entrepriseId);
        stats.budgetPrevuTotal = budgets.budgetPrevuTotal || 0;
        stats.budgetReelTotal = budgets.budgetReelTotal || 0;

        // Chantiers actifs (actif + en_pause)
        const actifs = db.prepare(`
            SELECT COUNT(*) as count 
            FROM Chantier 
            WHERE entrepriseId = ? AND is_deleted = 0 AND statut IN ('actif', 'en_pause')
        `).get(entrepriseId);
        stats.chantiersActifs = actifs.count;

        // Phases en retard (dateFin < aujourd'hui et avancement < 100)
        const phasesRetard = db.prepare(`
            SELECT COUNT(*) as count 
            FROM Phase p
            JOIN Chantier c ON p.chantierId = c.id
            WHERE c.entrepriseId = ? AND p.is_deleted = 0 AND c.is_deleted = 0
            AND p.dateFin < date('now') AND p.avancementPct < 100
        `).get(entrepriseId);
        stats.phasesEnRetard = phasesRetard.count;

        // Incidents non résolus
        const incidentsOuverts = db.prepare(`
            SELECT COUNT(*) as count 
            FROM Incident i
            JOIN Chantier c ON i.chantierId = c.id
            WHERE c.entrepriseId = ? AND i.is_deleted = 0 AND c.is_deleted = 0
            AND i.statut IN ('signale', 'en_cours')
        `).get(entrepriseId);
        stats.incidentsOuverts = incidentsOuverts.count;

        return stats;
    }

    /**
     * Créer un chantier avec validation
     * @param {Object} data - Données du chantier
     * @param {number} entrepriseId - ID entreprise
     * @returns {Object} - Chantier créé
     */
    createWithValidation(data, entrepriseId) {
        // Valider les champs obligatoires
        if (!data.nom || !data.nom.trim()) {
            throw new Error('Le nom du chantier est obligatoire');
        }

        // Vérifier unicité nom par entreprise
        const existing = db.prepare(`
            SELECT id FROM Chantier 
            WHERE entrepriseId = ? AND nom = ? AND is_deleted = 0
        `).get(entrepriseId, data.nom.trim());

        if (existing) {
            throw new Error('Un chantier avec ce nom existe déjà pour cette entreprise');
        }

        const chantierData = {
            ...data,
            nom: data.nom.trim(),
            entrepriseId,
            budgetPrevu: data.budgetPrevu || 0,
            budgetReel: 0,
            statut: data.statut || 'planification'
        };

        return this.create(chantierData, entrepriseId);
    }

    /**
     * Mettre à jour le budget réel (calculé depuis les dépenses + affectations)
     * @param {number} chantierId - ID chantier
     * @returns {Object} - Chantier mis à jour
     */
    recalculerBudgetReel(chantierId) {
        // Sommes des dépenses validées
        const depenses = db.prepare(`
            SELECT SUM(montant) as total 
            FROM Depense 
            WHERE chantierId = ? AND is_deleted = 0
        `).get(chantierId);

        // Coût des affectations main d'œuvre (via pointages)
        // Coût des affectations matériel (via locations/maintenance)
        // Pour simplifier : on utilise juste les dépenses pour l'instant

        const budgetReel = depenses.total || 0;

        return this.update(chantierId, { budgetReel });
    }

    /**
     * Ajouter une phase à un chantier
     * @param {number} chantierId - ID chantier
     * @param {Object} phaseData - Données de la phase
     * @returns {Object} - Phase créée
     */
    addPhase(chantierId, phaseData) {
        const phaseRepo = require('./PhaseRepository');
        const phaseRepoInstance = new phaseRepo();

        // Déterminer l'ordre suivant
        const lastPhase = db.prepare(`
            SELECT MAX(ordre) as maxOrdre FROM Phase WHERE chantierId = ? AND is_deleted = 0
        `).get(chantierId);

        const ordre = (lastPhase?.maxOrdre || 0) + 1;

        return phaseRepoInstance.create({
            ...phaseData,
            chantierId,
            ordre,
            avancementPct: phaseData.avancementPct || 0,
            statut: phaseData.statut || 'non_commencee'
        });
    }

    /**
     * Ajouter un incident à un chantier
     * @param {number} chantierId - ID chantier
     * @param {Object} incidentData - Données de l'incident
     * @param {number} userId - ID utilisateur déclarant
     * @returns {Object} - Incident créé
     */
    addIncident(chantierId, incidentData, userId) {
        const incidentRepo = require('./IncidentRepository');
        const incidentRepoInstance = new incidentRepo();

        return incidentRepoInstance.create({
            ...incidentData,
            chantierId,
            declarePar: userId,
            dateIncident: incidentData.dateIncident || new Date().toISOString().split('T')[0],
            gravite: incidentData.gravite || 'moyenne',
            statut: 'signale'
        });
    }
}

module.exports = ChantierRepository;