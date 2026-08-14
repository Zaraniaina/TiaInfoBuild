// Desktop/models/repositories/AuditLogRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class AuditLogRepository extends BaseRepository {
  constructor() {
    super('AuditLog');
  }

  log(data) {
    try {
      const payload = typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload || {});
      const result = db.prepare(`
        INSERT INTO AuditLog (
          entrepriseId, utilisateurId, action, module, entityId, payload
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        data.entrepriseId || null,
        data.utilisateurId || null,
        data.action || 'unknown',
        data.module || 'unknown',
        data.entityId || null,
        payload
      );
      return result;
    } catch (err) {
      console.error('AuditLogRepository.log error:', err.message);
      return null;
    }
  }

  getByModule(entrepriseId, module, limit = 100, offset = 0) {
    const stmt = db.prepare(`
      SELECT al.*, u.nom, u.prenom, u.email
      FROM AuditLog al
      LEFT JOIN Utilisateur u ON al.utilisateurId = u.id
      WHERE al.entrepriseId = ? AND al.module = ? AND al.is_deleted = 0
      ORDER BY al.dateAction DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(entrepriseId, module, limit, offset);
  }

  getByUtilisateur(entrepriseId, utilisateurId, limit = 100, offset = 0) {
    const stmt = db.prepare(`
      SELECT * FROM AuditLog
      WHERE entrepriseId = ? AND utilisateurId = ? AND is_deleted = 0
      ORDER BY dateAction DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(entrepriseId, utilisateurId, limit, offset);
  }

  getRecent(entrepriseId, limit = 50) {
    const stmt = db.prepare(`
      SELECT al.*, u.nom, u.prenom, u.email
      FROM AuditLog al
      LEFT JOIN Utilisateur u ON al.utilisateurId = u.id
      WHERE al.entrepriseId = ? AND al.is_deleted = 0
      ORDER BY al.dateAction DESC
      LIMIT ?
    `);
    return stmt.all(entrepriseId, limit);
  }
}

module.exports = AuditLogRepository;
