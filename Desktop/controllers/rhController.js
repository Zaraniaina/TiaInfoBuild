/**
 * Contrôleur Main Process - Module Ressources Humaines
 */
class RhController {
  constructor(repos) {
    this.repos = repos
  }

  // --- EMPLOYÉS ---
  async getListEmployes(event, { entrepriseId, limit, offset, statut, search }) {
    try {
      const items = this.repos.employes.getListWithStats({ entrepriseId, limit, offset, statut, search })
      const total = this.repos.employes.count({ entrepriseId, where: '', params: [] })
      return { success: true, data: { items, total } }
    } catch (error) {
      console.error('RhController.getListEmployes error:', error)
      return { success: false, error: error.message }
    }
  }

  async getEmployeById(event, id) {
    try {
      const item = this.repos.employes.getWithRelations(id)
      return { success: true, data: item }
    } catch (error) {
      console.error('RhController.getEmployeById error:', error)
      return { success: false, error: error.message }
    }
  }

  async createEmploye(event, data, entrepriseId) {
    try {
      const result = this.repos.employes.createWithValidation(data, entrepriseId)
      return { success: true, data: result }
    } catch (error) {
      console.error('RhController.createEmploye error:', error)
      return { success: false, error: error.message }
    }
  }

  async updateEmploye(event, id, data) {
    try {
      const result = this.repos.employes.update(id, data)
      return { success: true, data: result }
    } catch (error) {
      console.error('RhController.updateEmploye error:', error)
      return { success: false, error: error.message }
    }
  }

  async deleteEmploye(event, id) {
    try {
      const result = this.repos.employes.softDelete(id)
      return { success: true, data: result }
    } catch (error) {
      console.error('RhController.deleteEmploye error:', error)
      return { success: false, error: error.message }
    }
  }

  async getPresentsToday(event, entrepriseId) {
    try {
      const items = this.repos.employes.getPresentsToday(entrepriseId)
      return { success: true, data: items }
    } catch (error) {
      console.error('RhController.getPresentsToday error:', error)
      return { success: false, error: error.message }
    }
  }

  async pointer(event, data) {
    try {
      const result = this.repos.employes.pointer(data)
      return { success: true, data: result }
    } catch (error) {
      console.error('RhController.pointer error:', error)
      return { success: false, error: error.message }
    }
  }

  async getStatsEmployes(event, entrepriseId) {
    try {
      const stats = this.repos.employes.getDashboardStats(entrepriseId)
      return { success: true, data: stats }
    } catch (error) {
      console.error('RhController.getStatsEmployes error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- POINTAGES (avec filtres appliqués) ---
  async getListPointages(event, { employeId, chantierId, dateDebut, dateFin, limit = 50, offset = 0 } = {}) {
    try {
      let items
      if (employeId) {
        items = this.repos.pointages.getByEmploye(employeId, { dateDebut, dateFin, limit, offset })
      } else if (chantierId) {
        items = this.repos.pointages.getAll({
          where: 'chantierId = ?',
          params: [chantierId],
          limit,
          offset
        })
      } else {
        items = this.repos.pointages.getAll({ limit, offset })
      }
      return { success: true, data: items }
    } catch (error) {
      console.error('RhController.getListPointages error:', error)
      return { success: false, error: error.message }
    }
  }

  async createPointage(event, data) {
    try {
      const result = this.repos.pointages.create(data)
      return { success: true, data: result }
    } catch (error) {
      console.error('RhController.createPointage error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- HEURES SUP (avec filtres appliqués) ---
  async getListHeuresSup(event, { employeId, chantierId, dateDebut, dateFin, limit = 50, offset = 0 } = {}) {
    try {
      let items
      if (employeId) {
        items = this.repos.heuresSup.getByEmploye(employeId, { dateDebut, dateFin, limit, offset })
      } else if (chantierId) {
        items = this.repos.heuresSup.getByChantier(chantierId)
      } else {
        items = this.repos.heuresSup.getAll({ limit, offset })
      }
      return { success: true, data: items }
    } catch (error) {
      console.error('RhController.getListHeuresSup error:', error)
      return { success: false, error: error.message }
    }
  }

  async createHeureSup(event, data) {
    try {
      const result = this.repos.heuresSup.create(data)
      return { success: true, data: result }
    } catch (error) {
      console.error('RhController.createHeureSup error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- ÉQUIPES ---
   
  async getListEquipes(event, entrepriseId) {
    try {
      // ⚠️ CORRECTION : utiliser getByEntreprise au lieu de getAll
      const items = this.repos.equipes.getByEntreprise(entrepriseId)
      return { success: true, data: items }
    } catch (error) {
      console.error('RhController.getListEquipes error:', error)
      return { success: false, error: error.message }
    }
  }

  async createEquipe(event, data, entrepriseId) {
    try {
      const result = this.repos.equipes.create({ ...data, entrepriseId }, entrepriseId)
      return { success: true, data: result }
    } catch (error) {
      console.error('RhController.createEquipe error:', error)
      return { success: false, error: error.message }
    }
  }
}

module.exports = RhController