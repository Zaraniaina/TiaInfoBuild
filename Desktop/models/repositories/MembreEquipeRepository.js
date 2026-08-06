// Desktop/models/repositories/MembreEquipeRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class MembreEquipeRepository extends BaseRepository {
  constructor() {
    super('MembreEquipe');
  }

  /**
   * Récupérer les membres d'une équipe
   * @param {number} equipeId - ID équipe
   * @returns {Array} - Membres
   */
  getByEquipe(equipeId) {
    const stmt = db.prepare(`
      SELECT me.*, e.nom, e.prenom, e.poste, e.matricule, e.telephone
      FROM MembreEquipe me
      JOIN Employe e ON me.employeId = e.id AND e.is_deleted = 0
      WHERE me.equipeId = ? AND me.is_deleted = 0
      ORDER BY e.nom, e.prenom
    `);
    return stmt.all(equipeId);
  }

  /**
   * Récupérer les équipes d'un employé
   * @param {number} employeId - ID employé
   * @returns {Array} - Équipes
   */
  getByEmploye(employeId) {
    const stmt = db.prepare(`
      SELECT me.*, e.nom as equipeNom, e.chefEquipeId
      FROM MembreEquipe me
      JOIN Equipe e ON me.equipeId = e.id AND e.is_deleted = 0
      WHERE me.employeId = ? AND me.is_deleted = 0
      ORDER BY e.nom
    `);
    return stmt.all(employeId);
  }

  /**
   * Vérifier si un employé est déjà dans l'équipe
   * @param {number} equipeId - ID équipe
   * @param {number} employeId - ID employé
   * @returns {boolean} - Existe déjà
   */
  exists(equipeId, employeId) {
    const stmt = db.prepare(`
      SELECT 1 FROM MembreEquipe
      WHERE equipeId = ? AND employeId = ? AND is_deleted = 0
    `);
    return !!stmt.get(equipeId, employeId);
  }
}

module.exports = MembreEquipeRepository;