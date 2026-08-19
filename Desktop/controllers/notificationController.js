// Desktop/controllers/notificationController.js
const db = require('../models/db')

class NotificationController {
  constructor(repos) {
    this.repos = repos
  }

  async list(event, { utilisateurId, entrepriseId, lu, limit = 50, offset = 0 }) {
    try {
      let items
      if (utilisateurId) {
        items = this.repos.notifications.getByUtilisateur(utilisateurId, { limit, offset, lu })
      } else if (entrepriseId) {
        items = this.repos.notifications.getByEntreprise(entrepriseId, { limit, offset })
      } else {
        items = []
      }
      return { success: true, data: items }
    } catch (error) {
      console.error('NotificationController.list error:', error)
      return { success: false, error: error.message }
    }
  }

  async get(event, id) {
    try {
      const item = this.repos.notifications.getById(id)
      return { success: true, data: item }
    } catch (error) {
      console.error('NotificationController.get error:', error)
      return { success: false, error: error.message }
    }
  }

  async create(event, data) {
    try {
      const result = this.repos.notifications.create(data)
      return { success: true, data: result }
    } catch (error) {
      console.error('NotificationController.create error:', error)
      return { success: false, error: error.message }
    }
  }

  async update(event, id, data) {
    try {
      const result = this.repos.notifications.update(id, data)
      return { success: true, data: result }
    } catch (error) {
      console.error('NotificationController.update error:', error)
      return { success: false, error: error.message }
    }
  }

  async markAsRead(event, id, utilisateurId) {
    try {
      const result = this.repos.notifications.markAsRead(id, utilisateurId)
      return { success: true, data: result }
    } catch (error) {
      console.error('NotificationController.markAsRead error:', error)
      return { success: false, error: error.message }
    }
  }

  async markAllAsRead(event, utilisateurId, entrepriseId) {
    try {
      const result = this.repos.notifications.markAllAsRead(utilisateurId, entrepriseId)
      return { success: true, data: result }
    } catch (error) {
      console.error('NotificationController.markAllAsRead error:', error)
      return { success: false, error: error.message }
    }
  }

  async delete(event, id) {
    try {
      const result = this.repos.notifications.softDelete(id)
      return { success: true, data: result }
    } catch (error) {
      console.error('NotificationController.delete error:', error)
      return { success: false, error: error.message }
    }
  }

  async getNonLues(event, utilisateurId, entrepriseId, limit = 20) {
    try {
      const items = this.repos.notifications.getNonLues(utilisateurId, entrepriseId, limit)
      return { success: true, data: items }
    } catch (error) {
      console.error('NotificationController.getNonLues error:', error)
      return { success: false, error: error.message }
    }
  }

  async countNonLues(event, utilisateurId, entrepriseId) {
    try {
      const count = this.repos.notifications.countNonLues(utilisateurId, entrepriseId)
      return { success: true, data: count }
    } catch (error) {
      console.error('NotificationController.countNonLues error:', error)
      return { success: false, error: error.message }
    }
  }
}

module.exports = NotificationController
