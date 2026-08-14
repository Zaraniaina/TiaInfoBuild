// Desktop/models/repositories/PhotoChantierRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class PhotoChantierRepository extends BaseRepository {
  constructor() {
    super('PhotoChantier');
  }

  getByChantier(chantierId) {
    const stmt = db.prepare(`
      SELECT * FROM PhotoChantier
      WHERE chantierId = ? AND is_deleted = 0
      ORDER BY created_at DESC
    `);
    return stmt.all(chantierId);
  }

  create(data, entrepriseId) {
    const photo = {
      ...data,
      entrepriseId,
      is_synced: 0,
      is_deleted: 0
    };
    return super.create(photo, entrepriseId);
  }

  softDelete(id) {
    const stmt = db.prepare(`
      UPDATE PhotoChantier SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    return stmt.run(id);
  }
}

module.exports = PhotoChantierRepository;
