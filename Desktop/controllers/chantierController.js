/**
 * Contrôleur Main Process - Module Chantiers, Phases, Incidents & Affectations
 */
class ChantierController {
  constructor(repos) {
    this.repos = repos
  }

  // --- CHANTIERS ---
  async getList(event, { entrepriseId, limit, offset, statut, search }) {
    try {
      const items = this.repos.chantiers.getListWithStats({ entrepriseId, limit, offset, statut, search })
      const total = this.repos.chantiers.countWithFilters({ entrepriseId, statut, search })
      return { success: true, data: { items, total } }
    } catch (error) {
      console.error('ChantierController.getList error:', error)
      return { success: false, error: error.message }
    }
  }

  async getById(event, id) {
    try {
      const item = this.repos.chantiers.getWithRelations(id)
      return { success: true, data: item }
    } catch (error) {
      console.error('ChantierController.getById error:', error)
      return { success: false, error: error.message }
    }
  }

  async create(event, data, entrepriseId) {
    try {
      const result = this.repos.chantiers.createWithValidation(data, entrepriseId)
      return { success: true, data: result }
    } catch (error) {
      console.error('ChantierController.create error:', error)
      return { success: false, error: error.message }
    }
  }

  async update(event, id, data) {
    try {
      const result = this.repos.chantiers.update(id, data)
      return { success: true, data: result }
    } catch (error) {
      console.error('ChantierController.update error:', error)
      return { success: false, error: error.message }
    }
  }

  async delete(event, id) {
    try {
      const result = this.repos.chantiers.softDelete(id)
      return { success: true, data: result }
    } catch (error) {
      console.error('ChantierController.delete error:', error)
      return { success: false, error: error.message }
    }
  }

  async getStats(event, entrepriseId) {
    try {
      const stats = this.repos.chantiers.getDashboardStats(entrepriseId)
      return { success: true, data: stats }
    } catch (error) {
      console.error('ChantierController.getStats error:', error)
      return { success: false, error: error.message }
    }
  }

  async addPhase(event, chantierId, phaseData) {
    try {
      const result = this.repos.chantiers.addPhase(chantierId, phaseData)
      return { success: true, data: result }
    } catch (error) {
      console.error('ChantierController.addPhase error:', error)
      return { success: false, error: error.message }
    }
  }

  async addIncident(event, chantierId, incidentData, userId) {
    try {
      const result = this.repos.chantiers.addIncident(chantierId, incidentData, userId)
      return { success: true, data: result }
    } catch (error) {
      console.error('ChantierController.addIncident error:', error)
      return { success: false, error: error.message }
    }
  }

  async recalculerBudget(event, chantierId) {
    try {
      const result = this.repos.chantiers.recalculerBudgetReel(chantierId)
      return { success: true, data: result }
    } catch (error) {
      console.error('ChantierController.recalculerBudget error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- AFFECTATIONS DE RESSOURCES (Employé | Materiel) ---
  async affecterRessource(event, data) {
    try {
      const result = this.repos.affectationsRessource.affecter(data)
      return { success: true, data: result }
    } catch (error) {
      console.error('ChantierController.affecterRessource error:', error)
      return { success: false, error: error.message }
    }
  }

  async retirerRessource(event, id) {
    try {
      const result = this.repos.affectationsRessource.retirer(id)
      return { success: true, data: result }
    } catch (error) {
      console.error('ChantierController.retirerRessource error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- PHASES ---
  async getPhasesByChantier(event, chantierId) {
    try {
      const phases = this.repos.phases.getByChantier(chantierId)
      return { success: true, data: phases }
    } catch (error) {
      console.error('ChantierController.getPhasesByChantier error:', error)
      return { success: false, error: error.message }
    }
  }

  async updatePhaseAvancement(event, id, avancementPct) {
    try {
      const result = this.repos.phases.updateAvancement(id, avancementPct)
      return { success: true, data: result }
    } catch (error) {
      console.error('ChantierController.updatePhaseAvancement error:', error)
      return { success: false, error: error.message }
    }
  }

  async reorderPhases(event, chantierId, phaseIds) {
    try {
      const result = this.repos.phases.reorder(chantierId, phaseIds)
      return { success: true, data: result }
    } catch (error) {
      console.error('ChantierController.reorderPhases error:', error)
      return { success: false, error: error.message }
    }
  }

  async getAvancementGlobalPhases(event, chantierId) {
    try {
      const result = this.repos.phases.getAvancementGlobal(chantierId)
      return { success: true, data: result }
    } catch (error) {
      console.error('ChantierController.getAvancementGlobalPhases error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- INCIDENTS ---
  async getIncidentsByChantier(event, chantierId) {
    try {
      const incidents = this.repos.incidents.getByChantier(chantierId)
      return { success: true, data: incidents }
    } catch (error) {
      console.error('ChantierController.getIncidentsByChantier error:', error)
      return { success: false, error: error.message }
    }
  }

  async changerStatutIncident(event, id, statut) {
    try {
      const result = this.repos.incidents.changerStatut(id, statut)
      return { success: true, data: result }
    } catch (error) {
      console.error('ChantierController.changerStatutIncident error:', error)
      return { success: false, error: error.message }
    }
  }

  async getIncidentsOuvertsByEntreprise(event, entrepriseId) {
    try {
      const incidents = this.repos.incidents.getOuvertsByEntreprise(entrepriseId)
      return { success: true, data: incidents }
    } catch (error) {
      console.error('ChantierController.getIncidentsOuvertsByEntreprise error:', error)
      return { success: false, error: error.message }
    }
  }
}

module.exports = ChantierController