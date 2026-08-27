const BaseRepository = require('./BaseRepository');
const db = require('../db');

class CustomRoleRepository extends BaseRepository {
  constructor() {
    super('CustomRole');
  }

  getListWithDetails(options = {}) {
    const { entrepriseId, limit = 50, offset = 0 } = options;
    let sql = `
      SELECT cr.*, COUNT(DISTINCT crp.id) as permissionsCount
      FROM CustomRole cr
      LEFT JOIN CustomRolePermission crp ON cr.id = crp.customRoleId AND crp.is_deleted = 0
      WHERE cr.is_deleted = 0
    `;
    const params = [];
    if (entrepriseId) {
      sql += ' AND cr.entrepriseId = ?';
      params.push(entrepriseId);
    }
    sql += ' GROUP BY cr.id ORDER BY cr.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return db.prepare(sql).all(...params);
  }

  getWithPermissions(id) {
    const role = db.prepare(`
      SELECT * FROM CustomRole WHERE id = ? AND is_deleted = 0
    `).get(id);
    if (!role) return null;

    const permissions = db.prepare(`
      SELECT * FROM CustomRolePermission WHERE customRoleId = ? AND is_deleted = 0
    `).all(id);
    return { ...role, permissions };
  }

  getPermissions(customRoleId) {
    return db.prepare(`
      SELECT * FROM CustomRolePermission WHERE customRoleId = ? AND is_deleted = 0
    `).all(customRoleId);
  }

  addPermission(customRoleId, module, action, scope = null) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO CustomRolePermission (customRoleId, module, action, scope, is_synced, is_deleted, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    return stmt.run(customRoleId, module, action, scope);
  }

  removePermission(permissionId) {
    const stmt = db.prepare(`
      UPDATE CustomRolePermission SET is_deleted = 1, is_synced = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    return stmt.run(permissionId);
  }

  createRole(data, entrepriseId) {
    const payload = {
      entrepriseId: parseInt(entrepriseId || data.entrepriseId, 10) || 1,
      nom: data.nom,
      description: data.description || '',
      code: data.code || null,
      isSystem: data.isSystem ? 1 : 0,
      is_synced: 0
    };
    return this.create(payload, payload.entrepriseId);
  }
}

module.exports = CustomRoleRepository;
