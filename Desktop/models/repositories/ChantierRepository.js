const BaseRepository = require('./BaseRepository');
const db = require('../db');

class ChantierRepository extends BaseRepository {
    constructor() {
        super('Chantier');
    }

    getWithRelations(id) {
        const chantier = this.getById(id);
        if (!chantier) return null;

        const phases = db.prepare(`
            SELECT * FROM Phase 
            WHERE chantierId = ? AND is_deleted = 0 
            ORDER BY ordre
        `).all(id);

        const incidents = db.prepare(`
            SELECT i.*, u.nom as declareParNom, u.prenom as declareParPrenom
            FROM Incident i
            LEFT JOIN Utilisateur u ON i.declarePar = u.id
            WHERE i.chantierId = ? AND i.is_deleted = 0
            ORDER BY i.dateIncident DESC
        `).all(id);

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

        let client = null;
        if (chantier.clientId) {
            client = db.prepare('SELECT * FROM Client WHERE id = ? AND is_deleted = 0').get(chantier.clientId);
        }

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
     * Récupérer la liste des chantiers (Préfixe d'alias 'c' pour éviter l'ambiguïté)
     */
    getListWithStats(options = {}) {
        const { entrepriseId, limit = 50, offset = 0, statut, search } = options;

        let whereClause = '';
        const params = [];

        if (statut) {
            whereClause += ' AND c.statut = ?';
            params.push(statut);
        }

        if (search) {
            whereClause += ' AND (c.nom LIKE ? OR c.adresse LIKE ? OR c.description LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        let tenantWhere = this._entrepriseWhere(entrepriseId, 'c');
        if (whereClause) {
            tenantWhere += whereClause;
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
            ${tenantWhere}
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const stmt = db.prepare(sql);
        return stmt.all(...params, limit, offset);
    }

    /**
     * Compter les chantiers (Préfixe d'alias 'Chantier' pour éviter l'ambiguïté)
     */
    countWithFilters(options = {}) {
        const { entrepriseId, statut, search } = options;

        let whereClause = '';
        const params = [];

        if (statut) {
            whereClause += ' AND Chantier.statut = ?';
            params.push(statut);
        }

        if (search) {
            whereClause += ' AND (Chantier.nom LIKE ? OR Chantier.adresse LIKE ? OR Chantier.description LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        let tenantWhere = this._entrepriseWhere(entrepriseId, 'Chantier');
        if (whereClause) {
            tenantWhere += whereClause;
        }

        const sql = `
            SELECT COUNT(*) as total 
            FROM Chantier 
            ${tenantWhere}
        `;

        const stmt = db.prepare(sql);
        const result = stmt.get(...params);
        return result?.total || 0;
    }

    getDashboardStats(entrepriseId) {
        const stats = {};

        const parStatut = db.prepare(`
            SELECT statut, COUNT(*) as count 
            FROM Chantier 
            WHERE entrepriseId = ? AND is_deleted = 0
            GROUP BY statut
        `).all(entrepriseId);
        stats.parStatut = parStatut.reduce((acc, row) => { acc[row.statut] = row.count; return acc; }, {});

        const budgets = db.prepare(`
            SELECT 
                SUM(budgetPrevu) as budgetPrevuTotal,
                SUM(budgetReel) as budgetReelTotal
            FROM Chantier 
            WHERE entrepriseId = ? AND is_deleted = 0
        `).get(entrepriseId);
        stats.budgetPrevuTotal = budgets.budgetPrevuTotal || 0;
        stats.budgetReelTotal = budgets.budgetReelTotal || 0;

        const actifs = db.prepare(`
            SELECT COUNT(*) as count 
            FROM Chantier 
            WHERE entrepriseId = ? AND is_deleted = 0 AND statut IN ('actif', 'en_pause', 'en_cours')
        `).get(entrepriseId);
        stats.chantiersActifs = actifs.count;

        const phasesRetard = db.prepare(`
            SELECT COUNT(*) as count 
            FROM Phase p
            JOIN Chantier c ON p.chantierId = c.id
            WHERE c.entrepriseId = ? AND p.is_deleted = 0 AND c.is_deleted = 0
            AND p.dateFin < date('now') AND p.avancementPct < 100
        `).get(entrepriseId);
        stats.phasesEnRetard = phasesRetard.count;

        const incidentsOuverts = db.prepare(`
            SELECT COUNT(*) as count 
            FROM Incident i
            JOIN Chantier c ON i.chantierId = c.id
            WHERE c.entrepriseId = ? AND i.is_deleted = 0 AND c.is_deleted = 0
            AND i.statut IN ('signale', 'en_cours', 'ouvert')
        `).get(entrepriseId);
        stats.incidentsOuverts = incidentsOuverts.count;

        return stats;
    }

    createWithValidation(data, entrepriseId) {
        if (!data.nom || !data.nom.trim()) {
            throw new Error('Le nom du chantier est obligatoire');
        }

        const existing = db.prepare(`
            SELECT id FROM Chantier 
            WHERE entrepriseId = ? AND nom = ? AND is_deleted = 0
        `).get(entrepriseId, data.nom.trim());

        if (existing) {
            throw new Error('Un chantier avec ce nom existe déjà pour cette entreprise');
        }

        const budgetPrevisionnel = parseFloat(data.budgetPrevisionnel ?? data.budgetPrevu ?? 0) || 0;
        const chantierData = {
            ...data,
            nom: data.nom.trim(),
            entrepriseId,
            budgetPrevu: budgetPrevisionnel,
            budgetPrevisionnel,
            budgetReel: parseFloat(data.budgetReel) || 0,
            statut: data.statut || 'planification'
        };

        return this.create(chantierData, entrepriseId);
    }

    recalculerBudgetReel(chantierId) {
        const depenses = db.prepare(`
            SELECT SUM(montant) as total 
            FROM Depense 
            WHERE chantierId = ? AND is_deleted = 0
        `).get(chantierId);

        const budgetReel = depenses.total || 0;
        return this.update(chantierId, { budgetReel });
    }

    addPhase(chantierId, phaseData) {
        const phaseRepo = require('./PhaseRepository');
        const phaseRepoInstance = new phaseRepo();

        const lastPhase = db.prepare(`
            SELECT MAX(ordre) as maxOrdre FROM Phase WHERE chantierId = ? AND is_deleted = 0
        `).get(chantierId);

        const ordre = (lastPhase?.maxOrdre || 0) + 1;

        return phaseRepoInstance.create({
            ...phaseData,
            chantierId,
            ordre,
            avancementPct: phaseData.avancementPct || 0,
            budget: phaseData.budget || 0,
            statut: phaseData.statut || 'non_commencee'
        });
    }

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