// Desktop/controllers/dashboardController.js
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

  /**
   * Factures en retard pour le dashboard financier
   */
  async getFacturesRetard(event, entrepriseId) {
    try {
      const data = this.repos.dashboard.getFacturesRetard(entrepriseId)
      return { success: true, data: data || [] }
    } catch (error) {
      console.error('DashboardController.getFacturesRetard error:', error)
      return { success: false, error: error.message, data: [] }
    }
  }
  /**
   * Statistiques spécifiques RH
   */
  async getRHStats(event, entrepriseId) {
    try {
      const data = this.repos.dashboard.getRHStats(entrepriseId)
      return { success: true, data: data || {} }
    } catch (error) {
      console.error('DashboardController.getRHStats error:', error)
      return { success: false, error: error.message, data: {} }
    }
  }

  /**
   * Statistiques spécifiques Commercial
   */
  async getCommercialStats(event, entrepriseId) {
    try {
      const data = this.repos.dashboard.getCommercialStats(entrepriseId)
      return { success: true, data: data || {} }
    } catch (error) {
      console.error('DashboardController.getCommercialStats error:', error)
      return { success: false, error: error.message, data: {} }
    }
  }

  /**
   * Statistiques spécifiques Logistique
   */
  async getLogistiqueStats(event, entrepriseId) {
    try {
      const data = this.repos.dashboard.getLogistiqueStats(entrepriseId)
      return { success: true, data: data || {} }
    } catch (error) {
      console.error('DashboardController.getLogistiqueStats error:', error)
      return { success: false, error: error.message, data: {} }
    }
  }

  async getTopClients(event, entrepriseId) {
    try {
      const data = this.repos.dashboard.getTopClients(entrepriseId, 5)
      return { success: true, data: data || [] }
    } catch (error) {
      console.error('DashboardController.getTopClients error:', error)
      return { success: false, error: error.message, data: [] }
    }
  }

  async getCAByMois(event, entrepriseId) {
    try {
      const data = this.repos.dashboard.getCAByMois(entrepriseId)
      return { success: true, data: data || [] }
    } catch (error) {
      console.error('DashboardController.getCAByMois error:', error)
      return { success: false, error: error.message, data: [] }
    }
  }

  async getFinancesSante(event, entrepriseId) {
    try {
      const financeCtrl = require('./financeController')
      const ctrl = new financeCtrl({ dashboard: this.repos.dashboard, factures: this.repos.factures, depenses: this.repos.depenses, alertes: this.repos.alertes })
      return ctrl.getFinancesSante(event, entrepriseId)
    } catch (error) {
      console.error('DashboardController.getFinancesSante error:', error)
      return { success: false, error: error.message }
    }
  }

  async getTrésorerie(event, entrepriseId) {
    try {
      const financeCtrl = require('./financeController')
      const ctrl = new financeCtrl({ dashboard: this.repos.dashboard, factures: this.repos.factures, depenses: this.repos.depenses, alertes: this.repos.alertes })
      return ctrl.getTrésorerie(event, entrepriseId)
    } catch (error) {
      console.error('DashboardController.getTrésorerie error:', error)
      return { success: false, error: error.message }
    }
  }
}

module.exports = DashboardController