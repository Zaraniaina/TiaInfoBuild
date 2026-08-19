// Desktop/models/repositories/IntegrationConfigRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class IntegrationConfigRepository extends BaseRepository {
  constructor() {
    super('IntegrationConfig');
  }

  getListByEntreprise(entrepriseId, { limit = 100, offset = 0 } = {}) {
    return db.prepare(`
      SELECT * FROM IntegrationConfig
      WHERE entrepriseId = ? AND is_deleted = 0
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(entrepriseId, limit, offset);
  }

  setParametres(id, parametres) {
    const payload = typeof parametres === 'string' ? parametres : JSON.stringify(parametres || {});
    return db.prepare(`
      UPDATE IntegrationConfig SET parametres = @parametres, is_synced = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ parametres: payload, id }) && this.getById(id);
  }
}

module.exports = IntegrationConfigRepository;
