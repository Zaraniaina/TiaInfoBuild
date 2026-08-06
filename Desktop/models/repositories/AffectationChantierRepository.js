const BaseRepository = require('./BaseRepository');
const db = require('../db');

/**
 * AffectationChantierRepository
 * Affectation d'un employé sur un chantier (vue Employés)
 */
class AffectationChantierRepository extends BaseRepository {
  constructor() {
    super('AffectationChantier');
  }

  /**
   * Affectations d'un employé
   * @param {number} employeId
   * @returns {Array}
   */
  getByEmploye(employeId) {
    const stmt = db.prepare(`
      SELECT ac.*, c.nom as chantierNom, c.statut as chantierStatut
      FROM AffectationChantier ac
      JOIN Chantier c ON ac.chantierId = c.id AND c.is_deleted = 0
      WHERE ac.employeId = ? AND ac.is_deleted = 0
      ORDER BY ac.dateDebut DESC
    `);
    return stmt.all(employeId);
  }

  /**
   * Employés affectés à un chantier
   * @param {number} chantierId
   * @returns {Array}
   */
  getByChantier(chantierId) {
    const stmt = db.prepare(`
      SELECT ac.*, e.nom as employeNom, e.prenom as employePrenom, e.poste, e.matricule
      FROM AffectationChantier ac
      JOIN Employe e ON ac.employeId = e.id AND e.is_deleted = 0
      WHERE ac.chantierId = ? AND ac.is_deleted = 0 AND ac.dateFin IS NULL
      ORDER BY e.nom, e.prenom
    `);
    return stmt.all(chantierId);
  }

  /**
   * Affecter un employé à un chantier
   * @param {Object} data - { employeId, chantierId, dateDebut, dateFin, role }
   * @returns {Object}
   */
  affecter(data) {
    if (!data || !data.employeId || !data.chantierId) {
      throw new Error('L\'employé et le chantier sont obligatoires.');
    }

    const existing = db.prepare(`
      SELECT id FROM AffectationChantier
      WHERE employeId = ? AND chantierId = ? AND dateFin IS NULL AND is_deleted = 0
    `).get(data.employeId, data.chantierId);
    if (existing) throw new Error('Cet employé est déjà affecté à ce chantier.');

    return this.create({
      ...data,
      dateDebut: data.dateDebut || new Date().toISOString().split('T')[0],
      is_synced: 0
    });
  }

  /**
   * Clôturer l'affectation d'un employé
   * @param {number} id - ID affectation
   * @returns {Object|null}
   */
  retirer(id) {
    const affectation = this.getById(id);
    if (!affectation) throw new Error('Affectation introuvable.');
    return this.update(id, { dateFin: new Date().toISOString().split('T')[0] });
  }
}

module.exports = AffectationChantierRepository;