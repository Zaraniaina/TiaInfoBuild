const BaseRepository = require('./BaseRepository');
const db = require('../db');

class SystemMetricRepository extends BaseRepository {
  constructor() {
    super('SystemMetric');
  }

  getLatest(type) {
    return db.prepare(`
      SELECT * FROM SystemMetric WHERE type = ? AND is_deleted = 0 ORDER BY dateMesure DESC LIMIT 1
    `).get(type);
  }

  getByType(type, limit = 100) {
    return db.prepare(`
      SELECT * FROM SystemMetric WHERE type = ? AND is_deleted = 0 ORDER BY dateMesure DESC LIMIT ?
    `).all(type, limit);
  }

  recordMetric(type, valeur = null, donnees = null) {
    const payload = {
      type,
      valeur: valeur !== null ? parseFloat(valeur) : null,
      donnees: donnees ? JSON.stringify(donnees) : null,
      is_synced: 0
    };
    return this.create(payload);
  }

  getHealthSummary(entrepriseId) {
    const connectedUsers = db.prepare(`
      SELECT COUNT(DISTINCT utilisateurId) as count FROM LoginHistory
      WHERE dateConnexion >= datetime('now', '-1 hour') AND is_deleted = 0
    `).get();

    const recentErrors = db.prepare(`
      SELECT COUNT(*) as count FROM AuditLog
      WHERE (action LIKE '%error%' OR action LIKE '%erreur%' OR action LIKE '%fail%')
      AND dateAction >= datetime('now', '-24 hours') AND is_deleted = 0
    `).get();

    return {
      connectedUsers: connectedUsers?.count || 0,
      recentErrors: recentErrors?.count || 0
    };
  }

  cleanupOld(olderThanDays = 90) {
    const stmt = db.prepare(`
      DELETE FROM SystemMetric WHERE is_deleted = 1 AND updated_at < datetime('now', '-' || ? || ' days')
    `);
    return stmt.run(olderThanDays);
  }
}

module.exports = SystemMetricRepository;
