// Desktop/models/repositories/SystemConfigRepository.js
const db = require('../db');

class SystemConfigRepository {
  get(cle) {
    const row = db.prepare(`SELECT * FROM SystemConfig WHERE cle = ?`).get(cle);
    return row ? row.valeur : null;
  }

  getInt(cle, defaut = 0) {
    const v = this.get(cle);
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? defaut : n;
  }

  set(cle, valeur, description = null) {
    const payload = typeof valeur === 'string' ? valeur : JSON.stringify(valeur);
    db.prepare(`
      INSERT INTO SystemConfig (cle, valeur, description, updated_at)
      VALUES (@cle, @valeur, @description, CURRENT_TIMESTAMP)
      ON CONFLICT(cle) DO UPDATE SET valeur = @valeur, description = @description, updated_at = CURRENT_TIMESTAMP
    `).run({ cle, valeur: payload, description });
    return this.get(cle);
  }

  getAll() {
    return db.prepare(`SELECT cle, valeur, description FROM SystemConfig`).all();
  }
}

module.exports = SystemConfigRepository;
