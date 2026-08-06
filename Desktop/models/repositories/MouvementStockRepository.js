const BaseRepository = require('./BaseRepository');
const db = require('../db');

class MouvementStockRepository extends BaseRepository {
  constructor() {
    super('MouvementStock');
  }

  /**
   * Récupérer l'historique des mouvements d'un article
   * @param {number} articleId - ID article
   * @returns {Array} - Mouvements avec infos liées
   */
  getByArticle(articleId) {
    const stmt = db.prepare(`
      SELECT ms.*,
             f.nom as fournisseurNom,
             c.nom as chantierNom
      FROM MouvementStock ms
      LEFT JOIN Fournisseur f ON ms.fournisseurId = f.id AND f.is_deleted = 0
      LEFT JOIN Chantier c ON ms.chantierId = c.id AND c.is_deleted = 0
      WHERE ms.articleId = ? AND ms.is_deleted = 0
      ORDER BY ms.dateMouvement DESC, ms.id DESC
    `);
    return stmt.all(articleId);
  }

  /**
   * Récupérer les mouvements d'un chantier (consommation)
   * @param {number} chantierId - ID chantier
   * @returns {Array} - Mouvements sortants du chantier
   */
  getByChantier(chantierId) {
    const stmt = db.prepare(`
      SELECT ms.*, a.nom as articleNom, a.unite
      FROM MouvementStock ms
      JOIN Article a ON ms.articleId = a.id AND a.is_deleted = 0
      WHERE ms.chantierId = ? AND ms.is_deleted = 0 AND ms.typeMouvement = 'sortie'
      ORDER BY ms.dateMouvement DESC
    `);
    return stmt.all(chantierId);
  }

  /**
   * Récupérer les mouvements d'une entreprise sur une période
   * @param {number} entrepriseId - ID entreprise
   * @param {string} dateDebut - Date début (YYYY-MM-DD)
   * @param {string} dateFin - Date fin (YYYY-MM-DD)
   * @returns {Array} - Mouvements avec infos liées
   */
  getByPeriode(entrepriseId, dateDebut, dateFin) {
    const stmt = db.prepare(`
      SELECT ms.*,
             a.nom AS articleNom, a.unite,
             f.nom AS fournisseurNom,
             c.nom AS chantierNom
      FROM MouvementStock ms
      JOIN Article a ON ms.articleId = a.id AND a.is_deleted = 0
      LEFT JOIN Fournisseur f ON ms.fournisseurId = f.id AND f.is_deleted = 0
      LEFT JOIN Chantier c ON ms.chantierId = c.id AND c.is_deleted = 0
      WHERE a.entrepriseId = ? AND ms.is_deleted = 0
        AND ms.dateMouvement BETWEEN ? AND ?
      ORDER BY ms.dateMouvement DESC, ms.id DESC
    `);
    return stmt.all(entrepriseId, dateDebut, dateFin);
  }

  /**
   * Statistiques mouvements par période
   * @param {number} entrepriseId - ID entreprise
   * @param {string} dateDebut - Date début (YYYY-MM-DD)
   * @param {string} dateFin - Date fin (YYYY-MM-DD)
   * @returns {Object} - Stats entrées/sorties
   */
  getStatsPeriode(entrepriseId, dateDebut, dateFin) {
    const stmt = db.prepare(`
      SELECT
        SUM(CASE WHEN ms.typeMouvement = 'entree' THEN ms.quantite ELSE 0 END) as totalEntrees,
        SUM(CASE WHEN ms.typeMouvement = 'sortie' THEN ms.quantite ELSE 0 END) as totalSorties,
        COUNT(*) as nbMouvements
      FROM MouvementStock ms
      JOIN Article a ON ms.articleId = a.id
      WHERE a.entrepriseId = ? AND ms.is_deleted = 0 AND a.is_deleted = 0
      AND ms.dateMouvement BETWEEN ? AND ?
    `);
    return stmt.get(entrepriseId, dateDebut, dateFin) 
      || { totalEntrees: 0, totalSorties: 0, nbMouvements: 0 };
  }
}

module.exports = MouvementStockRepository;