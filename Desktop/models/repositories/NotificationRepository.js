// Desktop/models/repositories/NotificationRepository.js
const db = require('../db');

class NotificationRepository {
  constructor() {
    this.db = db;
  }

  create(data) {
    const stmt = this.db.prepare(`
      INSERT INTO Notification (entrepriseId, utilisateurId, titre, message, type, lu)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      data.entrepriseId,
      data.utilisateurId,
      data.titre,
      data.message || '',
      data.type || 'info',
      data.lu || 0
    );
    return this.getById(info.lastInsertRowid);
  }

  getById(id) {
    const stmt = this.db.prepare(`SELECT * FROM Notification WHERE id = ? AND is_deleted = 0`);
    return stmt.get(id) || null;
  }

  getByUtilisateur(utilisateurId, options = {}) {
    const { limit = 50, offset = 0, lu = null } = options;
    let sql = `SELECT * FROM Notification WHERE utilisateurId = ? AND is_deleted = 0`;
    const params = [utilisateurId];
    if (lu !== null) {
      sql += ` AND lu = ?`;
      params.push(lu ? 1 : 0);
    }
    sql += ` ORDER BY dateCreation DESC LIMIT ? OFFSET ?`;
    const stmt = this.db.prepare(sql);
    return stmt.all(...params, limit, offset);
  }

  getByEntreprise(entrepriseId, options = {}) {
    const { limit = 100, offset = 0 } = options;
    const stmt = this.db.prepare(`
      SELECT * FROM Notification
      WHERE entrepriseId = ? AND is_deleted = 0
      ORDER BY dateCreation DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(entrepriseId, limit, offset);
  }

  getNonLues(utilisateurId, entrepriseId, limit = 20) {
    const stmt = this.db.prepare(`
      SELECT * FROM Notification
      WHERE utilisateurId = ? AND entrepriseId = ? AND lu = 0 AND is_deleted = 0
      ORDER BY dateCreation DESC
      LIMIT ?
    `);
    return stmt.all(utilisateurId, entrepriseId, limit);
  }

  countNonLues(utilisateurId, entrepriseId) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as total FROM Notification
      WHERE utilisateurId = ? AND entrepriseId = ? AND lu = 0 AND is_deleted = 0
    `);
    const result = stmt.get(utilisateurId, entrepriseId);
    return result?.total || 0;
  }

  markAsRead(id, utilisateurId) {
    const stmt = this.db.prepare(`
      UPDATE Notification SET lu = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND utilisateurId = ? AND is_deleted = 0
    `);
    const info = stmt.run(id, utilisateurId);
    return info.changes > 0;
  }

  markAllAsRead(utilisateurId, entrepriseId) {
    const stmt = this.db.prepare(`
      UPDATE Notification SET lu = 1, updated_at = CURRENT_TIMESTAMP
      WHERE utilisateurId = ? AND entrepriseId = ? AND lu = 0 AND is_deleted = 0
    `);
    const info = stmt.run(utilisateurId, entrepriseId);
    return info.changes > 0;
  }

  update(id, data) {
    const allowedKeys = Object.keys(data).filter(k => !['id', 'created_at'].includes(k));
    if (!allowedKeys.length) return this.getById(id);
    const setClause = allowedKeys.map(key => `${key} = ?`).join(', ');
    const values = allowedKeys.map(key => data[key]);
    const stmt = this.db.prepare(`UPDATE Notification SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_deleted = 0`);
    stmt.run(...values, id);
    return this.getById(id);
  }

  softDelete(id) {
    const stmt = this.db.prepare(`UPDATE Notification SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
    const info = stmt.run(id);
    return info.changes > 0;
  }

  delete(id) {
    return this.softDelete(id);
  }

  /**
   * Purge automatique des notifications soft-deletees anciennes
   * @param {number} jours - Nombre de jours après lesquels purger (defaut 90)
   * @returns {boolean} - true si des lignes ont été supprimées
   */
  purgeAnciennes(jours = 90) {
    const stmt = this.db.prepare(`
      DELETE FROM Notification
      WHERE is_deleted = 1 AND updated_at < datetime('now', '-' || ? || ' days')
    `);
    const info = stmt.run(jours);
    return info.changes > 0;
  }
}

module.exports = NotificationRepository;
