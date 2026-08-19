// Desktop/models/repositories/SousTraitantRepository.js
const BaseRepository = require('./BaseRepository');

class SousTraitantRepository extends BaseRepository {
  constructor() {
    super('SousTraitant');
  }

  getByChantier(chantierId) {
    const stmt = this.db.prepare(`
      SELECT st.*, ast.dateDebut, ast.dateFin, ast.montant, ast.statut as affectationStatut
      FROM SousTraitant st
      JOIN AffectationSousTraitant ast ON st.id = ast.sousTraitantId
      WHERE ast.chantierId = ? AND st.is_deleted = 0 AND ast.is_deleted = 0
      ORDER BY ast.dateDebut DESC
    `);
    return stmt.all(chantierId);
  }

  getAffectations(sousTraitantId) {
    const stmt = this.db.prepare(`
      SELECT ast.*, c.nom as chantierNom
      FROM AffectationSousTraitant ast
      JOIN Chantier c ON ast.chantierId = c.id
      WHERE ast.sousTraitantId = ? AND ast.is_deleted = 0 AND c.is_deleted = 0
      ORDER BY ast.dateDebut DESC
    `);
    return stmt.all(sousTraitantId);
  }
}

module.exports = SousTraitantRepository;
