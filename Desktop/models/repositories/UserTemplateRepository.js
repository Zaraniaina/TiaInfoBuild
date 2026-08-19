const BaseRepository = require('./BaseRepository');
const db = require('../db');

class UserTemplateRepository extends BaseRepository {
  constructor() {
    super('UserTemplate');
  }

  getListWithRole(options = {}) {
    const { entrepriseId, limit = 50, offset = 0 } = options;
    let sql = `
      SELECT ut.*, r.nom as roleNom, r.code as roleCode
      FROM UserTemplate ut
      LEFT JOIN Role r ON ut.roleId = r.id AND r.is_deleted = 0
      WHERE ut.is_deleted = 0
    `;
    const params = [];
    if (entrepriseId) {
      sql += ' AND ut.entrepriseId = ?';
      params.push(entrepriseId);
    }
    sql += ' ORDER BY ut.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return db.prepare(sql).all(...params);
  }

  getWithRole(id) {
    const stmt = db.prepare(`
      SELECT ut.*, r.nom as roleNom, r.code as roleCode
      FROM UserTemplate ut
      LEFT JOIN Role r ON ut.roleId = r.id AND r.is_deleted = 0
      WHERE ut.id = ? AND ut.is_deleted = 0
    `);
    return stmt.get(id) || null;
  }

  createTemplate(data, entrepriseId) {
    const payload = {
      entrepriseId: parseInt(entrepriseId || data.entrepriseId, 10) || 1,
      nom: data.nom,
      description: data.description || '',
      roleId: data.roleId ? parseInt(data.roleId, 10) : null,
      donnees: data.donnees ? JSON.stringify(data.donnees) : null,
      is_synced: 0
    };
    return this.create(payload, payload.entrepriseId);
  }

  updateTemplate(id, data) {
    const payload = { ...data };
    if (payload.roleId !== undefined) {
      payload.roleId = parseInt(payload.roleId, 10) || payload.roleId;
    }
    if (payload.donnees && typeof payload.donnees === 'object') {
      payload.donnees = JSON.stringify(payload.donnees);
    }
    return this.update(id, payload);
  }
}

module.exports = UserTemplateRepository;
