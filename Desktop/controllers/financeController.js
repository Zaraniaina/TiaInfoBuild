/**
 * Contrôleur Main Process - Module Finance & Alertes
 */
class FinanceController {
  constructor(repos) {
    this.repos = repos
  }

  // --- DÉPENSES ---
  async getDepensesByChantier(event, chantierId) {
    try {
      const items = this.repos.depenses.getByChantier(chantierId)
      return { success: true, data: items }
    } catch (error) {
      console.error('FinanceController.getDepensesByChantier error:', error)
      return { success: false, error: error.message }
    }
  }

  async getTotalDepensesByChantier(event, chantierId) {
    try {
      const total = this.repos.depenses.getTotalByChantier(chantierId)
      return { success: true, data: total }
    } catch (error) {
      console.error('FinanceController.getTotalDepensesByChantier error:', error)
      return { success: false, error: error.message }
    }
  }

  async getDepensesByCategorie(event, chantierId) {
    try {
      const items = this.repos.depenses.getByCategorie(chantierId)
      return { success: true, data: items }
    } catch (error) {
      console.error('FinanceController.getDepensesByCategorie error:', error)
      return { success: false, error: error.message }
    }
  }

  async getDepensesEnAttenteValidation(event, entrepriseId) {
    try {
      const items = this.repos.depenses.getEnAttenteValidation(entrepriseId)
      return { success: true, data: items }
    } catch (error) {
      console.error('FinanceController.getDepensesEnAttenteValidation error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- ALERTES ---
  async getAlertesNonLues(event, entrepriseId, limit) {
    try {
      const items = this.repos.alertes.getNonLues(entrepriseId, limit)
      return { success: true, data: items }
    } catch (error) {
      console.error('FinanceController.getAlertesNonLues error:', error)
      return { success: false, error: error.message }
    }
  }

  async marquerAlerteLue(event, id) {
    try {
      const result = this.repos.alertes.marquerLue(id)
      return { success: true, data: result }
    } catch (error) {
      console.error('FinanceController.marquerAlerteLue error:', error)
      return { success: false, error: error.message }
    }
  }

  async marquerToutesAlertesLues(event, entrepriseId) {
    try {
      const result = this.repos.alertes.marquerToutesLues(entrepriseId)
      return { success: true, data: result }
    } catch (error) {
      console.error('FinanceController.marquerToutesAlertesLues error:', error)
      return { success: false, error: error.message }
    }
  }

  async creerAlerte(event, data) {
    try {
      const result = this.repos.alertes.creer(data)
      return { success: true, data: result }
    } catch (error) {
      console.error('FinanceController.creerAlerte error:', error)
      return { success: false, error: error.message }
    }
  }

  async countAlertesNonLues(event, entrepriseId) {
    try {
      const count = this.repos.alertes.countNonLues(entrepriseId)
      return { success: true, data: count }
    } catch (error) {
      console.error('FinanceController.countAlertesNonLues error:', error)
      return { success: false, error: error.message }
    }
  }
}

module.exports = FinanceController
