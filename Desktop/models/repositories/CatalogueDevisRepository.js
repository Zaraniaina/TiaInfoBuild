// Desktop/models/repositories/CatalogueDevisRepository.js
const BaseRepository = require('./BaseRepository');

class CatalogueDevisRepository extends BaseRepository {
  constructor() {
    super('CatalogueDevis');
  }

  getByCategorie(categorie) {
    const stmt = this.db.prepare(`
      SELECT * FROM CatalogueDevis
      WHERE categorie = ? AND is_deleted = 0 AND statut = 'actif'
      ORDER BY nom ASC
    `);
    return stmt.all(categorie);
  }

  getAllCategories(entrepriseId) {
    const stmt = this.db.prepare(`
      SELECT DISTINCT categorie FROM CatalogueDevis
      WHERE entrepriseId = ? AND is_deleted = 0 AND categorie IS NOT NULL AND categorie != ''
      ORDER BY categorie ASC
    `);
    return stmt.all(entrepriseId);
  }
}

module.exports = CatalogueDevisRepository;
