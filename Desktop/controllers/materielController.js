// Desktop/controllers/materielController.js
/**
 * Contrôleur Main Process - Module Matériels & Maintenance
 */
class MaterielController {
  constructor(repos) {
    this.repos = repos
  }

  // ── MATÉRIELS ──────────────────────────────────────────────
  async getListMateriels(event, { entrepriseId, limit = 50, offset = 0, statut, search } = {}) {
    try {
      const items = this.repos.materiels.getByEntreprise(entrepriseId, { limit, offset, statut, search })
      const total = this.repos.materiels.count({ entrepriseId })
      return { success: true, data: { items, total } }
    } catch (error) {
      console.error('MaterielController.getListMateriels error:', error)
      return { success: false, error: error.message }
    }
  }

  async getMaterielById(event, id) {
    try {
      const item = this.repos.materiels.getWithRelations(id)
      if (!item) return { success: false, error: 'Matériel non trouvé' }
      return { success: true, data: item }
    } catch (error) {
      console.error('MaterielController.getMaterielById error:', error)
      return { success: false, error: error.message }
    }
  }

  async createMateriel(event, data, entrepriseId) {
    try {
      if (!data.nom && !data.designation) {
        return { success: false, error: 'La désignation du matériel est obligatoire.' }
      }
      const payload = {
        ...data,
        nom: data.designation || data.nom,
        entrepriseId: entrepriseId || data.entrepriseId,
        statut: data.statut || 'disponible',
        is_synced: 0
      }
      const result = this.repos.materiels.create(payload)
      return { success: true, data: result }
    } catch (error) {
      console.error('MaterielController.createMateriel error:', error)
      return { success: false, error: error.message }
    }
  }

  async updateMateriel(event, id, data) {
    try {
      const result = this.repos.materiels.update(id, { ...data, is_synced: 0 })
      return { success: true, data: result }
    } catch (error) {
      console.error('MaterielController.updateMateriel error:', error)
      return { success: false, error: error.message }
    }
  }

  async deleteMateriel(event, id) {
    try {
      const result = this.repos.materiels.softDelete(id)
      return { success: true, data: result }
    } catch (error) {
      console.error('MaterielController.deleteMateriel error:', error)
      return { success: false, error: error.message }
    }
  }

  async getStatsMateriels(event, entrepriseId) {
    try {
      const stats = this.repos.materiels.getDashboardStats(entrepriseId)
      return { success: true, data: stats }
    } catch (error) {
      console.error('MaterielController.getStatsMateriels error:', error)
      return { success: false, error: error.message }
    }
  }

  async getDisponibles(event, entrepriseId) {
    try {
      const items = this.repos.materiels.getDisponibles(entrepriseId)
      return { success: true, data: items }
    } catch (error) {
      console.error('MaterielController.getDisponibles error:', error)
      return { success: false, error: error.message }
    }
  }

  async getMaintenanceEnRetard(event, entrepriseId) {
    try {
      const items = this.repos.materiels.getMaintenanceEnRetard(entrepriseId)
      return { success: true, data: items }
    } catch (error) {
      console.error('MaterielController.getMaintenanceEnRetard error:', error)
      return { success: false, error: error.message }
    }
  }

  // ── MAINTENANCES ───────────────────────────────────────────
  async getListMaintenances(event, { materielId, limit = 50, offset = 0 } = {}) {
    try {
      const items = this.repos.maintenances.getAll({ materielId, limit, offset })
      const total = this.repos.maintenances.count({ materielId })
      return { success: true, data: { items, total } }
    } catch (error) {
      console.error('MaterielController.getListMaintenances error:', error)
      return { success: false, error: error.message }
    }
  }

  async createMaintenance(event, data) {
    try {
      if (!data.materielId) {
        return { success: false, error: "L'identifiant du matériel est obligatoire." }
      }
      const result = this.repos.maintenances.create({ ...data, is_synced: 0 })
      return { success: true, data: result }
    } catch (error) {
      console.error('MaterielController.createMaintenance error:', error)
      return { success: false, error: error.message }
    }
  }

  async updateMaintenance(event, id, data) {
    try {
      const result = this.repos.maintenances.update(id, { ...data, is_synced: 0 })
      return { success: true, data: result }
    } catch (error) {
      console.error('MaterielController.updateMaintenance error:', error)
      return { success: false, error: error.message }
    }
  }
}

module.exports = MaterielController