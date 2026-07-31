const BaseRepository = require('./BaseRepository');
const db = require('../db');

class PointageRepository extends BaseRepository {
    constructor() {
        super('Pointage');
    }

    /**
     * Récupérer les pointages d'un employé
     * @param {number} employeId - ID employé
     * @param {Object} options - { dateDebut, dateFin, limit, offset }
     * @returns {Array} - Pointages
     */
    getByEmploye(employeId, options = {}) {
        const { dateDebut, dateFin, limit = 50, offset = 0 } = options;

        let whereClause = 'WHERE employeId = ? AND is_deleted = 0';
        const params = [employeId];

        if (dateDebut) {
            whereClause += ' AND dateJour >= ?';
            params.push(dateDebut);
        }
        if (dateFin) {
            whereClause += ' AND dateJour <= ?';
            params.push(dateFin);
        }

        const sql = `
            SELECT p.*, c.nom as chantierNom
            FROM Pointage p
            LEFT JOIN Chantier c ON p.chantierId = c.id AND c.is_deleted = 0
            ${whereClause}
            ORDER BY p.dateJour DESC, p.heureArrivee DESC
            LIMIT ? OFFSET ?
        `;

        const stmt = db.prepare(sql);
        return stmt.all(...params, limit, offset);
    }

    /**
     * Récupérer les pointages d'un chantier
     * @param {number} chantierId - ID chantier
     * @param {string} dateJour - Date (YYYY-MM-DD)
     * @returns {Array} - Pointages du jour
     */
    getByChantierAndDate(chantierId, dateJour) {
        const stmt = db.prepare(`
            SELECT p.*, e.nom as employeNom, e.prenom as employePrenom, e.matricule
            FROM Pointage p
            JOIN Employe e ON p.employeId = e.id AND e.is_deleted = 0
            WHERE p.chantierId = ? AND p.dateJour = ? AND p.is_deleted = 0
            ORDER BY e.nom, e.prenom
        `);
        return stmt.all(chantierId, dateJour);
    }

    /**
     * Pointer (arrivée ou mettre à jour le pointage du jour)
     * @param {Object} data - { employeId, chantierId, dateJour, heureArrivee, heureDepart, statut }
     * @returns {Object} - Pointage créé/mis à jour
     */
    pointer(data) {
        const { employeId, chantierId, dateJour, heureArrivee, heureDepart, statut } = data;

        const existing = db.prepare(`
            SELECT * FROM Pointage 
            WHERE employeId = ? AND dateJour = ? AND is_deleted = 0
        `).get(employeId, dateJour);

        if (existing) {
            // Mise à jour
            const updateFields = [];
            const updateValues = [];

            if (chantierId !== undefined) { updateFields.push('chantierId = ?'); updateValues.push(chantierId); }
            if (heureArrivee !== undefined) { updateFields.push('heureArrivee = ?'); updateValues.push(heureArrivee); }
            if (heureDepart !== undefined) { updateFields.push('heureDepart = ?'); updateValues.push(heureDepart); }
            if (statut !== undefined) { updateFields.push('statut = ?'); updateValues.push(statut); }

            updateFields.push('is_synced = 0', 'updated_at = CURRENT_TIMESTAMP');
            updateValues.push(existing.id);

            db.prepare(`UPDATE Pointage SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues);
            return this.getById(existing.id);
        } else {
            // Création
            return this.create({
                employeId,
                chantierId,
                dateJour: dateJour || new Date().toISOString().split('T')[0],
                heureArrivee,
                heureDepart,
                statut: statut || 'present'
            });
        }
    }

    /**
     * Statistiques de présence pour un employé sur une période
     * @param {number} employeId - ID employé
     * @param {string} dateDebut - Date début
     * @param {string} dateFin - Date fin
     * @returns {Object} - Stats
     */
    getStatsEmploye(employeId, dateDebut, dateFin) {
        const stmt = db.prepare(`
            SELECT 
                COUNT(*) as totalJours,
                SUM(CASE WHEN statut = 'present' THEN 1 ELSE 0 END) as presents,
                SUM(CASE WHEN statut = 'absent' THEN 1 ELSE 0 END) as absents,
                SUM(CASE WHEN statut = 'retard' THEN 1 ELSE 0 END) as retards,
                SUM(CASE WHEN statut = 'conge' THEN 1 ELSE 0 END) as conges
            FROM Pointage
            WHERE employeId = ? AND is_deleted = 0
            AND dateJour BETWEEN ? AND ?
        `);
        return stmt.get(employeId, dateDebut, dateFin) || { totalJours: 0, presents: 0, absents: 0, retards: 0, conges: 0 };
    }
}

module.exports = PointageRepository;