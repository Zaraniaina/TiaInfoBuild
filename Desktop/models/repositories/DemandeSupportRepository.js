// Desktop/models/repositories/DemandeSupportRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class DemandeSupportRepository extends BaseRepository {
  constructor() {
    super('DemandeSupport');
  }

  getListByEntreprise(entrepriseId, { statut, limit = 100, offset = 0 } = {}) {
    let where = 'ds.entrepriseId = ? AND ds.is_deleted = 0';
    const params = [entrepriseId];
    if (statut) {
      where += ' AND ds.statut = ?';
      params.push(statut);
    }
    const sql = `
      SELECT ds.*, u.nom, u.prenom, u.email
      FROM DemandeSupport ds
      LEFT JOIN Utilisateur u ON ds.utilisateurId = u.id
      WHERE ${where}
      ORDER BY ds.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return db.prepare(sql).all(...params, limit, offset);
  }

  getByUtilisateur(utilisateurId, { limit = 100, offset = 0 } = {}) {
    return db.prepare(`
      SELECT * FROM DemandeSupport
      WHERE utilisateurId = ? AND is_deleted = 0
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(utilisateurId, limit, offset);
  }

  getWithRelations(id) {
    return db.prepare(`
      SELECT ds.*, u.nom, u.prenom, u.email, r.nom as roleNom, r.code as roleCode
      FROM DemandeSupport ds
      LEFT JOIN Utilisateur u ON ds.utilisateurId = u.id
      LEFT JOIN Role r ON u.roleId = r.id AND r.is_deleted = 0
      WHERE ds.id = ? AND ds.is_deleted = 0
    `).get(id) || null;
  }

  repondre(id, reponse, statut = 'resolue') {
    return db.prepare(`
      UPDATE DemandeSupport
      SET reponse = @reponse, statut = @statut, dateTraitement = CURRENT_TIMESTAMP,
          is_synced = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ reponse, statut, id }) && this.getById(id);
  }
}

module.exports = DemandeSupportRepository;
