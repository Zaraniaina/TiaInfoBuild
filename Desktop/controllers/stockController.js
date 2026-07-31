/**
 * Contrôleur Main Process - Module Stocks (Articles, Fournisseurs, Mouvements)
 */
class StockController {
  constructor(repos) {
    this.repos = repos
  }

  // --- ARTICLES ---
  async getListArticles(event, { entrepriseId, limit, offset, search, categorie }) {
    try {
      let items
      if (search) {
        items = this.repos.articles.search(search, ['nom', 'categorie', 'unite'], { entrepriseId, limit, offset })
      } else {
        items = this.repos.articles.getAll({ entrepriseId, limit, offset })
      }
      const total = this.repos.articles.count({ entrepriseId })
      return { success: true, data: { items, total } }
    } catch (error) {
      console.error('StockController.getListArticles error:', error)
      return { success: false, error: error.message }
    }
  }

  async getArticleById(event, id) {
    try {
      const item = this.repos.articles.getById(id)
      return { success: true, data: item }
    } catch (error) {
      console.error('StockController.getArticleById error:', error)
      return { success: false, error: error.message }
    }
  }

  async createArticle(event, data, entrepriseId) {
    try {
      const result = this.repos.articles.create({ ...data, entrepriseId }, entrepriseId)
      return { success: true, data: result }
    } catch (error) {
      console.error('StockController.createArticle error:', error)
      return { success: false, error: error.message }
    }
  }

  async updateArticle(event, id, data) {
    try {
      const result = this.repos.articles.update(id, data)
      return { success: true, data: result }
    } catch (error) {
      console.error('StockController.updateArticle error:', error)
      return { success: false, error: error.message }
    }
  }

  async deleteArticle(event, id) {
    try {
      const result = this.repos.articles.softDelete(id)
      return { success: true, data: result }
    } catch (error) {
      console.error('StockController.deleteArticle error:', error)
      return { success: false, error: error.message }
    }
  }

  async getArticlesEnAlerte(event, entrepriseId) {
    try {
      const items = this.repos.articles.getEnAlerte(entrepriseId)
      return { success: true, data: items }
    } catch (error) {
      console.error('StockController.getArticlesEnAlerte error:', error)
      return { success: false, error: error.message }
    }
  }

  async updateStockArticle(event, articleId, quantite, typeMouvement, options) {
    try {
      const result = this.repos.articles.updateStock(articleId, quantite, typeMouvement, options)
      return { success: true, data: result }
    } catch (error) {
      console.error('StockController.updateStockArticle error:', error)
      return { success: false, error: error.message }
    }
  }

  async getStatsArticles(event, entrepriseId) {
    try {
      const stats = this.repos.articles.getDashboardStats(entrepriseId)
      return { success: true, data: stats }
    } catch (error) {
      console.error('StockController.getStatsArticles error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- FOURNISSEURS ---
  async getListFournisseurs(event, { entrepriseId, limit, offset, search }) {
    try {
      let items
      if (search) {
        items = this.repos.fournisseurs.search(search, ['nom', 'contact', 'email'], { entrepriseId, limit, offset })
      } else {
        items = this.repos.fournisseurs.getAll({ entrepriseId, limit, offset })
      }
      const total = this.repos.fournisseurs.count({ entrepriseId })
      return { success: true, data: { items, total } }
    } catch (error) {
      console.error('StockController.getListFournisseurs error:', error)
      return { success: false, error: error.message }
    }
  }

  async createFournisseur(event, data, entrepriseId) {
    try {
      const result = this.repos.fournisseurs.create({ ...data, entrepriseId }, entrepriseId)
      return { success: true, data: result }
    } catch (error) {
      console.error('StockController.createFournisseur error:', error)
      return { success: false, error: error.message }
    }
  }

  async updateFournisseur(event, id, data) {
    try {
      const result = this.repos.fournisseurs.update(id, data)
      return { success: true, data: result }
    } catch (error) {
      console.error('StockController.updateFournisseur error:', error)
      return { success: false, error: error.message }
    }
  }

  async deleteFournisseur(event, id) {
    try {
      const result = this.repos.fournisseurs.softDelete(id)
      return { success: true, data: result }
    } catch (error) {
      console.error('StockController.deleteFournisseur error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- MOUVEMENTS ---
  async getMouvementsByArticle(event, articleId) {
    try {
      const items = this.repos.mouvements.getByArticle(articleId)
      return { success: true, data: items }
    } catch (error) {
      console.error('StockController.getMouvementsByArticle error:', error)
      return { success: false, error: error.message }
    }
  }

  async getMouvementsByChantier(event, chantierId) {
    try {
      const items = this.repos.mouvements.getByChantier(chantierId)
      return { success: true, data: items }
    } catch (error) {
      console.error('StockController.getMouvementsByChantier error:', error)
      return { success: false, error: error.message }
    }
  }

  async getMouvementsByPeriode(event, entrepriseId, dateDebut, dateFin) {
    try {
      const items = this.repos.mouvements.getByPeriode(entrepriseId, dateDebut, dateFin)
      return { success: true, data: items }
    } catch (error) {
      console.error('StockController.getMouvementsByPeriode error:', error)
      return { success: false, error: error.message }
    }
  }

  async getMouvementsStats(event, entrepriseId, dateDebut, dateFin) {
    try {
      const stats = this.repos.mouvements.getStatsPeriode(entrepriseId, dateDebut, dateFin)
      return { success: true, data: stats }
    } catch (error) {
      console.error('StockController.getMouvementsStats error:', error)
      return { success: false, error: error.message }
    }
  }
}

module.exports = StockController
