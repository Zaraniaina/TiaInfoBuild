const BaseRepository = require('./BaseRepository');
const db = require('../db');

class ArticleRepository extends BaseRepository {
    constructor() {
        super('Article');
    }

    /**
     * Récupérer les articles avec alerte stock bas
     * @param {number} entrepriseId - ID entreprise
     * @returns {Array} - Articles en alerte
     */
    getEnAlerte(entrepriseId) {
        const stmt = db.prepare(`
            SELECT * FROM Article 
            WHERE entrepriseId = ? AND is_deleted = 0 
            AND quantiteStock <= seuilAlerte AND seuilAlerte > 0
            ORDER BY (quantiteStock / NULLIF(seuilAlerte, 0)) ASC
        `);
        return stmt.all(entrepriseId);
    }

    /**
     * Mettre à jour le stock d'un article (entrée/sortie)
     * @param {number} articleId - ID article
     * @param {number} quantite - Quantité à ajouter (positif) ou retirer (négatif)
     * @param {string} typeMouvement - 'entree' ou 'sortie'
     * @param {Object} options - { chantierId, fournisseurId, motif }
     * @returns {Object} - Article mis à jour + mouvement créé
     */
    updateStock(articleId, quantite, typeMouvement, options = {}) {
        const { chantierId, fournisseurId, motif } = options;

        if (typeMouvement !== 'entree' && typeMouvement !== 'sortie') {
            throw new Error('typeMouvement doit être "entree" ou "sortie"');
        }

        return db.transaction(() => {
            // Récupérer l'article
            const article = this.getById(articleId);
            if (!article) throw new Error('Article non trouvé');

            // Calculer nouveau stock
            const nouveauStock = typeMouvement === 'entree'
                ? article.quantiteStock + quantite
                : article.quantiteStock - quantite;

            if (nouveauStock < 0) {
                throw new Error('Stock insuffisant pour cette sortie');
            }

            // Mettre à jour l'article
            this.update(articleId, { quantiteStock: nouveauStock });

            // Créer le mouvement
            const mouvementRepo = require('./MouvementStockRepository');
            const mouvement = new mouvementRepo().create({
                articleId,
                chantierId,
                fournisseurId,
                typeMouvement,
                quantite,
                motif: motif || `${typeMouvement === 'entree' ? 'Entrée' : 'Sortie'} de stock`,
                dateMouvement: new Date().toISOString().split('T')[0]
            });

            return { article: this.getById(articleId), mouvement };
        });
    }

    /**
     * Obtenir les statistiques stocks pour dashboard
     * @param {number} entrepriseId - ID entreprise
     * @returns {Object} - KPIs stocks
     */
    getDashboardStats(entrepriseId) {
        const stats = {};

        // Total articles
        const total = db.prepare(`
            SELECT COUNT(*) as count FROM Article 
            WHERE entrepriseId = ? AND is_deleted = 0
        `).get(entrepriseId);
        stats.totalArticles = total.count;

        // Articles en alerte
        const alertes = db.prepare(`
            SELECT COUNT(*) as count FROM Article 
            WHERE entrepriseId = ? AND is_deleted = 0 
            AND quantiteStock <= seuilAlerte AND seuilAlerte > 0
        `).get(entrepriseId);
        stats.enAlerte = alertes.count;

        // Valeur totale du stock
        const valeur = db.prepare(`
            SELECT SUM(quantiteStock * COALESCE(prixUnitaire, 0)) as total
            FROM Article 
            WHERE entrepriseId = ? AND is_deleted = 0
        `).get(entrepriseId);
        stats.valeurStock = valeur.total || 0;

        // Mouvements ce mois
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
        stats.mouvementsMois = {
            entrees: mouvements.entrees || 0,
            sorties: mouvements.sorties || 0
        };

        return stats;
    }
}

module.exports = ArticleRepository;