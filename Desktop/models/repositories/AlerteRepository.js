// Desktop/models/repositories/AlerteRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class AlerteRepository extends BaseRepository {
  constructor() {
    super('Alerte');
  }

  /**
   * Récupérer les alertes non lues d'une entreprise
   * @param {number} entrepriseId - ID entreprise
   * @param {number} limit - Limite
   * @returns {Array} - Alertes non lues
   */
  getNonLues(entrepriseId, limit = 20, roleDestinataire = null) {
    let sql = `
      SELECT * FROM Alerte
      WHERE entrepriseId = ? AND is_deleted = 0 AND statut = 'non_lue'
    `;
    const params = [entrepriseId];
    if (roleDestinataire) {
      sql += ` AND (roleDestinataire IS NULL OR roleDestinataire = ?)`;
      params.push(roleDestinataire);
    }
    sql += `
      ORDER BY
        CASE niveauGravite
          WHEN 'critique' THEN 1
          WHEN 'elevee' THEN 2
          WHEN 'moyenne' THEN 3
          ELSE 4
        END,
        dateAlerte DESC
      LIMIT ?
    `;
    params.push(limit);
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Marquer une alerte comme lue
   * @param {number} id - ID alerte
   * @returns {Object|null} - Alerte mise à jour
   */
  marquerLue(id) {
    return this.update(id, { statut: 'lue' });
  }

  /**
   * Marquer toutes les alertes comme lues
   * @param {number} entrepriseId - ID entreprise
   * @returns {number} - Nombre mises à jour
   */
  marquerToutesLues(entrepriseId) {
    const stmt = db.prepare(`
      UPDATE Alerte SET statut = 'lue', is_synced = 0, updated_at = CURRENT_TIMESTAMP
      WHERE entrepriseId = ? AND is_deleted = 0 AND statut = 'non_lue'
    `);
    const info = stmt.run(entrepriseId);
    return info.changes;
  }

  /**
   * Créer une alerte système (budget, stock, retard, etc.)
   * @param {Object} data - { entrepriseId, typeEntite, entiteId, message, niveauGravite }
   * @returns {Object} - Alerte créée
   */
  creer(data) {
    return this.create({
      ...data,
      dateAlerte: new Date().toISOString(),
      statut: 'non_lue',
      niveauGravite: data.niveauGravite || 'info'
    });
  }

  /**
   * Obtenir le nombre d'alertes non lues
   * @param {number} entrepriseId - ID entreprise
   * @returns {number} - Compteur
   */
  countNonLues(entrepriseId) {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM Alerte
      WHERE entrepriseId = ? AND is_deleted = 0 AND statut = 'non_lue'
    `);
    const result = stmt.get(entrepriseId);
    return result?.count || 0;
  }
}

module.exports = AlerteRepository;