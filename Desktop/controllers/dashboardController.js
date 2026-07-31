/**
 * Contrôleur Main Process - Dashboard Global KPIs & Stats
 */
class DashboardController {
  constructor(repos) {
    this.repos = repos
  }

  /**
   * Statistiques globales (KPIs) pour le tableau de bord
   */
  async getDashboardStats(event, entrepriseId) {
    try {
      const stats = this.repos.dashboard.getStats(entrepriseId)
      return { success: true, data: stats }
    } catch (error) {
      console.error('DashboardController.getDashboardStats error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Évolution du CA sur 12 mois (pour graphique)
   */
  async getCAEvolution(event, entrepriseId) {
    try {
      const data = this.repos.dashboard.getCAEvolution(entrepriseId)
      return { success: true, data: data || [] }
    } catch (error) {
      console.error('DashboardController.getCAEvolution error:', error)
      return { success: false, error: error.message, data: [] }
    }
  }

  /**
   * Top 5 chantiers par budget prévisionnel
   */
  async getTopChantiersBudget(event, entrepriseId) {
    try {
      const data = this.repos.dashboard.getTopChantiersBudget(entrepriseId)
      return { success: true, data: data || [] }
    } catch (error) {
      console.error('DashboardController.getTopChantiersBudget error:', error)
      return { success: false, error: error.message, data: [] }
    }
  }

  /**
   * Activité récente (feed dashboard)
   */
  async getActiviteRecente(event, entrepriseId, limit = 10) {
    try {
      const data = this.repos.dashboard.getActiviteRecente(entrepriseId, limit)
      return { success: true, data: data || [] }
    } catch (error) {
      console.error('DashboardController.getActiviteRecente error:', error)
      return { success: false, error: error.message, data: [] }
    }
  }
}

module.exports = DashboardController
