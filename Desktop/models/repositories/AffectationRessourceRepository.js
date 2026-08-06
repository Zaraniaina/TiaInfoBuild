const BaseRepository = require('./BaseRepository');
const db = require('../db');

/**
 * AffectationRessourceRepository
 * Affectation d'un Employé ou d'un Matériel sur un chantier
 * (alimente l'onglet "Ressources" du détail chantier)
 */
class AffectationRessourceRepository extends BaseRepository {
  constructor() {
    super('AffectationRessource');
  }

  /**
   * Affectations d'un chantier avec les noms des ressources
   * @param {number} chantierId
   * @returns {Array}
   */
  getByChantier(chantierId) {
    const stmt = db.prepare(`
      SELECT ar.*,
             e.nom as employeNom, e.prenom as employePrenom,
             m.nom as materielNom, m.type as materielType
      FROM AffectationRessource ar
      LEFT JOIN Employe e ON ar.typeRessource = 'Employe' AND ar.ressourceId = e.id AND e.is_deleted = 0
      LEFT JOIN Materiel m ON ar.typeRessource = 'Materiel' AND ar.ressourceId = m.id AND m.is_deleted = 0
      WHERE ar.chantierId = ? AND ar.is_deleted = 0
      ORDER BY ar.dateDebut DESC
    `);
    return stmt.all(chantierId);
  }

  /**
   * Affecter une ressource à un chantier
   * @param {Object} data - { chantierId, typeRessource: 'Employe'|'Materiel', ressourceId, dateDebut, dateFin, role }
   * @returns {Object} - Affectation créée
   */
  affecter(data) {
    if (!data || !data.chantierId) throw new Error('Le chantier est obligatoire.');
    if (!['Employe', 'Materiel'].includes(data.typeRessource)) {
      throw new Error('typeRessource doit être "Employe" ou "Materiel".');
    }
    if (!data.ressourceId) throw new Error('La ressource est obligatoire.');

    // Empêcher les doublons actifs
    const existing = db.prepare(`
      SELECT id FROM AffectationRessource
      WHERE chantierId = ? AND typeRessource = ? AND ressourceId = ?
        AND dateFin IS NULL AND is_deleted = 0
    `).get(data.chantierId, data.typeRessource, data.ressourceId);
    if (existing) throw new Error('Cette ressource est déjà affectée à ce chantier.');

    return this.create({
      ...data,
      dateDebut: data.dateDebut || new Date().toISOString().split('T')[0],
      is_synced: 0
    });
  }

  /**
   * Retirer une ressource (clôture l'affectation avec dateFin)
   * @param {number} id - ID affectation
   * @returns {Object|null}
   */
  retirer(id) {
    const affectation = this.getById(id);
    if (!affectation) throw new Error('Affectation introuvable.');
    return this.update(id, { dateFin: new Date().toISOString().split('T')[0] });
  }
}

module.exports = AffectationRessourceRepository;