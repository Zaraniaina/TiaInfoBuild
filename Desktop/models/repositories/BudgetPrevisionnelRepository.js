// Desktop/models/repositories/BudgetPrevisionnelRepository.js
const BaseRepository = require('./BaseRepository');

class BudgetPrevisionnelRepository extends BaseRepository {
  constructor() {
    super('BudgetPrevisionnel');
  }

  getByChantier(chantierId) {
    const stmt = this.db.prepare(`
      SELECT * FROM BudgetPrevisionnel
      WHERE chantierId = ? AND is_deleted = 0
      ORDER BY periode DESC
    `);
    return stmt.all(chantierId);
  }

  getByEntreprise(entrepriseId) {
    const stmt = this.db.prepare(`
      SELECT b.*, c.nom as chantierNom
      FROM BudgetPrevisionnel b
      JOIN Chantier c ON b.chantierId = c.id
      WHERE b.entrepriseId = ? AND b.is_deleted = 0 AND c.is_deleted = 0
      ORDER BY b.periode DESC
    `);
    return stmt.all(entrepriseId);
  }

  comparer(chantierId, periodeDebut = null, periodeFin = null) {
    let sql = `
      SELECT periode, montantPrevu, montantRealise,
             ROUND(COALESCE(montantRealise,0) - COALESCE(montantPrevu,0), 2) as ecart,
             CASE WHEN COALESCE(montantPrevu,0) > 0
                  THEN ROUND((COALESCE(montantRealise,0) - COALESCE(montantPrevu,0)) / COALESCE(montantPrevu,0) * 100, 2)
                  ELSE 0 END as tauxEcart
      FROM BudgetPrevisionnel
      WHERE chantierId = ? AND is_deleted = 0
    `;
    const params = [chantierId];
    if (periodeDebut) {
      sql += ` AND periode >= ?`;
      params.push(periodeDebut);
    }
    if (periodeFin) {
      sql += ` AND periode <= ?`;
      params.push(periodeFin);
    }
    sql += ` ORDER BY periode DESC`;
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }
}

module.exports = BudgetPrevisionnelRepository;
