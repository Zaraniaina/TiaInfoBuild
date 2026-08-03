const BaseRepository = require('./BaseRepository');
const db = require('../db');

class EmployeRepository extends BaseRepository {
    constructor() {
        super('Employe');
    }

    /**
     * Récupérer un employé avec ses relations
     * @param {number} id - ID local de l'employé
     * @returns {Object|null} - Employé avec relations
     */
    getWithRelations(id) {
        const employe = this.getById(id);
        if (!employe) return null;

        // Équipes
        const equipes = db.prepare(`
            SELECT e.*, me.dateAffectation
            FROM Equipe e
            JOIN MembreEquipe me ON e.id = me.equipeId
            WHERE me.employeId = ? AND e.is_deleted = 0 AND me.is_deleted = 0
        `).all(id);

        // Affectations chantiers
        const affectations = db.prepare(`
            SELECT ac.*, c.nom as chantierNom, c.statut as chantierStatut
            FROM AffectationChantier ac
            JOIN Chantier c ON ac.chantierId = c.id
            WHERE ac.employeId = ? AND ac.is_deleted = 0 AND c.is_deleted = 0
            ORDER BY ac.dateDebut DESC
        `).all(id);

        // Pointages récents (30 derniers jours)
        const pointages = db.prepare(`
            SELECT p.*, c.nom as chantierNom
            FROM Pointage p
            LEFT JOIN Chantier c ON p.chantierId = c.id AND c.is_deleted = 0
            WHERE p.employeId = ? AND p.is_deleted = 0
            AND p.dateJour >= date('now', '-30 days')
            ORDER BY p.dateJour DESC
        `).all(id);

        // Heures sup récentes
        const heuresSup = db.prepare(`
            SELECT hs.*, c.nom as chantierNom
            FROM HeureSupplementaire hs
            LEFT JOIN Chantier c ON hs.chantierId = c.id AND c.is_deleted = 0
            WHERE hs.employeId = ? AND hs.is_deleted = 0
            AND hs.dateJour >= date('now', '-30 days')
            ORDER BY hs.dateJour DESC
        `).all(id);

        return {
            ...employe,
            equipes,
            affectations,
            pointages,
            heuresSup
        };
    }

    /**
     * Récupérer la liste des employés avec infos résumées
     * @param {Object} options - { entrepriseId, limit, offset, statut, search }
     * @returns {Array} - Liste des employés
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
            whereClause += ' AND (nom LIKE ? OR prenom LIKE ? OR matricule LIKE ? OR poste LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam);
        }

        let tenantWhere = this._entrepriseWhere(entrepriseId);
        if (whereClause) {
            tenantWhere += whereClause;
        }

        const sql = `
            SELECT e.*,
                (SELECT COUNT(*) FROM Pointage WHERE employeId = e.id AND is_deleted = 0 AND dateJour >= date('now', '-30 days')) as nbPointagesMois,
                (SELECT COUNT(*) FROM HeureSupplementaire WHERE employeId = e.id AND is_deleted = 0 AND dateJour >= date('now', '-30 days')) as nbHeuresSupMois
            FROM Employe e
            ${tenantWhere}
            ORDER BY e.nom, e.prenom
            LIMIT ? OFFSET ?
        `;

        const stmt = db.prepare(sql);
        return stmt.all(...params, limit, offset);
    }

    /**
     * Obtenir les employés présents aujourd'hui (pour pointage)
     * @param {number} entrepriseId - ID entreprise
     * @returns {Array} - Employés avec statut pointage du jour
     */
    getPresentsToday(entrepriseId) {
        const today = new Date().toISOString().split('T')[0];

        const sql = `
            SELECT e.*, 
                p.heureArrivee, p.heureDepart, p.statut as pointageStatut,
                c.nom as chantierNom
            FROM Employe e
            LEFT JOIN Pointage p ON e.id = p.employeId AND p.dateJour = ? AND p.is_deleted = 0
            LEFT JOIN Chantier c ON p.chantierId = c.id AND c.is_deleted = 0
            ${this._entrepriseWhere(entrepriseId)}
            AND e.statut = 'actif'
            ORDER BY e.nom, e.prenom
        `;

        const stmt = db.prepare(sql);
        return stmt.all(today);
    }

    /**
     * Pointer un employé (arrivée/départ)
     * @param {Object} data - { employeId, chantierId, heureArrivee, heureDepart, statut }
     * @returns {Object} - Pointage créé/mis à jour
     */
    pointer(data) {
        const { employeId, chantierId, heureArrivee, heureDepart, statut } = data;
        const today = new Date().toISOString().split('T')[0];

        // Vérifier si pointage existe déjà aujourd'hui
        const existing = db.prepare(`
            SELECT * FROM Pointage 
            WHERE employeId = ? AND dateJour = ? AND is_deleted = 0
        `).get(employeId, today);

        if (existing) {
            // Mise à jour
            return db.prepare(`
                UPDATE Pointage 
                SET chantierId = ?, heureArrivee = COALESCE(?, heureArrivee), 
                    heureDepart = COALESCE(?, heureDepart), statut = COALESCE(?, statut),
                    is_synced = 0, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(chantierId, heureArrivee, heureDepart, statut, existing.id) &&
                db.prepare('SELECT * FROM Pointage WHERE id = ?').get(existing.id);
        } else {
            // Création
            const pointageRepo = require('./PointageRepository');
            return new pointageRepo().create({
                employeId,
                chantierId,
                dateJour: today,
                heureArrivee,
                heureDepart,
                statut: statut || 'present'
            });
        }
    }

    /**
     * Obtenir les statistiques RH pour le dashboard
     * @param {number} entrepriseId - ID entreprise
     * @returns {Object} - KPIs RH
     */
    getDashboardStats(entrepriseId) {
        const stats = {};

        // Effectif total
        const total = db.prepare(`
            SELECT COUNT(*) as count FROM Employe 
            WHERE entrepriseId = ? AND is_deleted = 0
        `).get(entrepriseId);
        stats.effectifTotal = total.count;

        // Par statut
        const parStatut = db.prepare(`
            SELECT statut, COUNT(*) as count FROM Employe 
            WHERE entrepriseId = ? AND is_deleted = 0
            GROUP BY statut
        `).all(entrepriseId);
        stats.parStatut = parStatut.reduce((acc, row) => { acc[row.statut] = row.count; return acc; }, {});

        // Présents aujourd'hui
        const today = new Date().toISOString().split('T')[0];
        const presents = db.prepare(`
            SELECT COUNT(DISTINCT e.id) as count
            FROM Employe e
            JOIN Pointage p ON e.id = p.employeId
            WHERE e.entrepriseId = ? AND e.is_deleted = 0 AND p.is_deleted = 0
            AND p.dateJour = ? AND p.statut IN ('present', 'retard')
        `).get(entrepriseId, today);
        stats.presentsAujourdhui = presents.count;

        // Heures sup ce mois
        const debutMois = new Date();
        debutMois.setDate(1);
        const debutMoisStr = debutMois.toISOString().split('T')[0];

        const hs = db.prepare(`
            SELECT SUM(nombreHeures) as total
            FROM HeureSupplementaire hs
            JOIN Employe e ON hs.employeId = e.id
            WHERE e.entrepriseId = ? AND hs.is_deleted = 0 AND e.is_deleted = 0
            AND hs.dateJour >= ?
        `).get(entrepriseId, debutMoisStr);
        stats.heuresSupMois = hs.total || 0;

        // Employés en alerte (pas de pointage depuis 3 jours)
        const enAlerte = db.prepare(`
            SELECT COUNT(*) as count
            FROM Employe e
            WHERE e.entrepriseId = ? AND e.is_deleted = 0 AND e.statut = 'actif'
            AND NOT EXISTS (
                SELECT 1 FROM Pointage p 
                WHERE p.employeId = e.id AND p.is_deleted = 0
                AND p.dateJour >= date('now', '-3 days')
            )
        `).get(entrepriseId);
        stats.employesEnAlerte = enAlerte.count;

        return stats;
    }

    /**
     * Créer un employé avec validation
     * @param {Object} data - Données de l'employé
     * @param {number} entrepriseId - ID entreprise
     * @returns {Object} - Employé créé
     */
    createWithValidation(data, entrepriseId) {
        if (!data.nom || !data.nom.trim()) {
            throw new Error('Le nom est obligatoire');
        }
        if (!data.prenom || !data.prenom.trim()) {
            throw new Error('Le prénom est obligatoire');
        }

        // Vérifier matricule unique si fourni
        if (data.matricule) {
            const existing = db.prepare(`
                SELECT id FROM Employe 
                WHERE entrepriseId = ? AND matricule = ? AND is_deleted = 0
            `).get(entrepriseId, data.matricule);
            if (existing) {
                throw new Error('Ce matricule existe déjà');
            }
        }

        const employeData = {
            ...data,
            nom: data.nom.trim(),
            prenom: data.prenom.trim(),
            entrepriseId,
            statut: data.statut || 'actif',
            salaireBase: data.salaireBase || 0
        };

        return this.create(employeData, entrepriseId);
    }
}

module.exports = EmployeRepository;