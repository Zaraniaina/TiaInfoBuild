const { ipcMain } = require('electron')

class AlerteController {
  constructor(repos) {
    this.repos = repos
  }

  // Liste complète avec filtre par entrepriseId
  getList(event, params = {}) {
    try {
      const { entrepriseId, limit = 200 } = params;
      const result = this.repos.alertes.getAll({
        entrepriseId,
        limit,
        orderBy: "dateAlerte DESC, id DESC"
      });
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Alertes non lues
  getNonLues(event, entrepriseId, limit = 20, roleDestinataire = null) {
    try {
      const result = this.repos.alertes.getNonLues(entrepriseId, limit, roleDestinataire)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Compter alertes non lues
  countNonLues(event, entrepriseId) {
    try {
      const count = this.repos.alertes.countNonLues(entrepriseId)
      return { success: true, data: count }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Marquer 1 alerte comme lue
  markAsRead(event, id) {
    try {
      this.repos.alertes.marquerLue(id)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Alias pour la compatibilité avec l'ancien nom de canal
  marquerLue(event, id) {
    return this.markAsRead(event, id)
  }

  // Marquer toutes comme lues
  markAllAsRead(event, entrepriseId) {
    try {
      this.repos.alertes.marquerToutesLues(entrepriseId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Créer une alerte
  creer(event, data) {
    try {
      const result = this.repos.alertes.creer(data)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Supprimer (soft delete)
  deleteAlerte(event, id) {
    try {
      this.repos.alertes.softDelete(id)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}

module.exports = AlerteController
