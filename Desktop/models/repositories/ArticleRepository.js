const BaseRepository = require('./BaseRepository');
const db = require('../db');

class ArticleRepository extends BaseRepository {
  constructor() {
    super('Article');
  }

  getEnAlerte(entrepriseId) {
    const stmt = db.prepare(`
      SELECT * FROM Article
      WHERE entrepriseId = ? AND is_deleted = 0
      AND quantiteStock <= seuilAlerte AND seuilAlerte > 0
      ORDER BY (quantiteStock / NULLIF(seuilAlerte, 0)) ASC
    `);
    return stmt.all(entrepriseId);
  }

  updateStock(articleId, quantite, typeMouvement, options = {}) {
    const { chantierId, fournisseurId, motif } = options;

    if (typeMouvement !== 'entree' && typeMouvement !== 'sortie') {
      throw new Error('typeMouvement doit être "entree" ou "sortie"');
    }

    const qte = Math.abs(parseFloat(quantite) || 0);
    if (qte <= 0) throw new Error('La quantité doit être supérieure à 0');

    // ⚠️ CORRECTION CRITIQUE : db.transaction renvoie une fonction, il faut l'exécuter avec ()
    return db.transaction(() => {
      const article = this.getById(articleId);
      if (!article) throw new Error('Article non trouvé');

      const stockActuelArticle = article.quantiteStock ?? article.stockActuel ?? 0;
      const nouveauStock = typeMouvement === 'entree'
        ? stockActuelArticle + qte
        : stockActuelArticle - qte;

      if (nouveauStock < 0) {
        throw new Error('Stock insuffisant pour cette sortie');
      }

      // Met à jour les deux colonnes pour la cohérence du dashboard
      this.update(articleId, { 
        quantiteStock: nouveauStock,
        stockActuel: nouveauStock 
      });

      const MouvementStockRepository = require('./MouvementStockRepository');
      const mouvementRepo = new MouvementStockRepository();
      const mouvement = mouvementRepo.create({
        articleId,
        chantierId,
        fournisseurId,
        typeMouvement,
        quantite: qte,
        motif: motif || `${typeMouvement === 'entree' ? 'Entrée' : 'Sortie'} de stock`,
        dateMouvement: new Date().toISOString().split('T')[0]
      });

      if (article.seuilAlerte > 0 && nouveauStock <= article.seuilAlerte) {
        try {
          const AlerteRepository = require('./AlerteRepository');
          new AlerteRepository().creer({
            entrepriseId: article.entrepriseId,
            typeEntite: 'Article',
            entiteId: articleId,
            message: `Stock bas : ${article.nom} — ${nouveauStock} ${article.unite || ''} restant(s)`,
            niveauGravite: nouveauStock <= 0 ? 'critique' : 'moyenne'
          });
        } catch (e) { /* ignoré */ }
      }

      return { article: this.getById(articleId), mouvement };
    })(); // <--- LE () ICI EST OBLIGATOIRE
  }

  getDashboardStats(entrepriseId) {
    const stats = {};
    const total = db.prepare(`SELECT COUNT(*) as count FROM Article WHERE entrepriseId = ? AND is_deleted = 0`).get(entrepriseId);
    stats.totalArticles = total.count;

    const alertes = db.prepare(`SELECT COUNT(*) as count FROM Article WHERE entrepriseId = ? AND is_deleted = 0 AND quantiteStock <= seuilAlerte AND seuilAlerte > 0`).get(entrepriseId);
    stats.enAlerte = alertes.count;

    const valeur = db.prepare(`SELECT SUM(quantiteStock * COALESCE(prixUnitaire, 0)) as total FROM Article WHERE entrepriseId = ? AND is_deleted = 0`).get(entrepriseId);
    stats.valeurStock = valeur.total || 0;

    const debutMois = new Date();
    debutMois.setDate(1);
    const debutMoisStr = debutMois.toISOString().split('T')[0];

    const mouvements = db.prepare(`
      SELECT
        SUM(CASE WHEN ms.typeMouvement = 'entree' THEN ms.quantite ELSE 0 END) as entrees,
        SUM(CASE WHEN ms.typeMouvement = 'sortie' THEN ms.quantite ELSE 0 END) as sorties
      FROM MouvementStock ms
      JOIN Article a ON ms.articleId = a.id
      WHERE a.entrepriseId = ? AND ms.is_deleted = 0 AND a.is_deleted = 0
      AND ms.dateMouvement >= ?
    `).get(entrepriseId, debutMoisStr);

    stats.mouvementsMois = { entrees: mouvements.entrees || 0, sorties: mouvements.sorties || 0 };
    return stats;
  }
}

module.exports = ArticleRepository;