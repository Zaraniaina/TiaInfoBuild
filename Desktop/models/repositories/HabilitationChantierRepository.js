const BaseRepository = require('./BaseRepository');
const db = require('../db');

class HabilitationChantierRepository extends BaseRepository {
  constructor() {
    super('HabilitationChantier');
  }

  getByUtilisateur(utilisateurId) {
    return db.prepare(`
      SELECT hc.*, c.nom as chantierNom, c.numero as chantierNumero
      FROM HabilitationChantier hc
      JOIN Chantier c ON hc.chantierId = c.id AND c.is_deleted = 0
      WHERE hc.utilisateurId = ? AND hc.is_deleted = 0
      ORDER BY hc.created_at DESC
    `).all(utilisateurId);
  }

  getByChantier(chantierId) {
    return db.prepare(`
      SELECT hc.*, u.nom as utilisateurNom, u.prenom as utilisateurPrenom, u.email as utilisateurEmail
      FROM HabilitationChantier hc
      JOIN Utilisateur u ON hc.utilisateurId = u.id AND u.is_deleted = 0
      WHERE hc.chantierId = ? AND hc.is_deleted = 0
      ORDER BY hc.created_at DESC
    `).all(chantierId);
  }

  getByUtilisateurAndChantier(utilisateurId, chantierId) {
    return db.prepare(`
      SELECT * FROM HabilitationChantier
      WHERE utilisateurId = ? AND chantierId = ? AND is_deleted = 0
    `).all(utilisateurId, chantierId);
  }

  createHabilitation(data) {
    const payload = {
      utilisateurId: parseInt(data.utilisateurId, 10),
      chantierId: parseInt(data.chantierId, 10),
      module: data.module || 'general',
      permissions: data.permissions ? JSON.stringify(data.permissions) : null,
      dateDebut: data.dateDebut || null,
      dateFin: data.dateFin || null,
      is_synced: 0
    };
    return this.create(payload);
  }

  updateHabilitation(id, data) {
    const payload = { ...data };
    if (payload.permissions && typeof payload.permissions === 'object') {
      payload.permissions = JSON.stringify(payload.permissions);
    }
    if (payload.utilisateurId !== undefined) {
      payload.utilisateurId = parseInt(payload.utilisateurId, 10);
    }
    if (payload.chantierId !== undefined) {
      payload.chantierId = parseInt(payload.chantierId, 10);
    }
    return this.update(id, payload);
  }
}

module.exports = HabilitationChantierRepository;
