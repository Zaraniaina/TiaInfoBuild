// Desktop/controllers/chantierController.js
/**
 * Contrôleur Main Process - Module Chantiers, Phases & Incidents
 */
class ChantierController {
  constructor(repos) {
    this.repos = repos;
  }

  // ============================================================
  // CHANTIERS
  // ============================================================

  async getList(event, params = {}) {
    try {
      const items = this.repos.chantiers.getListWithStats(params);
      const total = this.repos.chantiers.countWithFilters(params);
      return {
        success: true,
        data: { items, total }
      };
    } catch (error) {
      console.error('ChantierController.getList error:', error);
      return { success: false, error: error.message };
    }
  }

  async getById(event, id) {
    try {
      const item = this.repos.chantiers.getWithRelations(id);
      if (!item) {
        return { success: false, error: 'Chantier introuvable' };
      }
      return { success: true, data: item };
    } catch (error) {
      console.error('ChantierController.getById error:', error);
      return { success: false, error: error.message };
    }
  }

  async create(event, data, entrepriseId) {
    try {
      const result = this.repos.chantiers.createWithValidation(data, entrepriseId);
      return { success: true, data: result };
    } catch (error) {
      console.error('ChantierController.create error:', error);
      return { success: false, error: error.message };
    }
  }

  async update(event, id, data) {
    try {
      const result = this.repos.chantiers.update(id, data);
      return { success: true, data: result };
    } catch (error) {
      console.error('ChantierController.update error:', error);
      return { success: false, error: error.message };
    }
  }

  async delete(event, id) {
    try {
      const result = this.repos.chantiers.softDelete(id);
      return { success: true, data: result };
    } catch (error) {
      console.error('ChantierController.delete error:', error);
      return { success: false, error: error.message };
    }
  }

  async getStats(event, entrepriseId) {
    try {
      const stats = this.repos.chantiers.getDashboardStats(entrepriseId);
      return { success: true, data: stats };
    } catch (error) {
      console.error('ChantierController.getStats error:', error);
      return { success: false, error: error.message };
    }
  }

  async recalculerBudget(event, chantierId) {
    try {
      const result = this.repos.chantiers.recalculerBudgetReel(chantierId);
      return { success: true, data: result };
    } catch (error) {
      console.error('ChantierController.recalculerBudget error:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================================
  // PHASES
  // ============================================================

  async getPhasesByChantier(event, chantierId) {
    try {
      const phases = this.repos.phases.getByChantier(chantierId);
      return { success: true, data: phases };
    } catch (error) {
      console.error('ChantierController.getPhasesByChantier error:', error);
      return { success: false, error: error.message };
    }
  }

  async addPhase(event, chantierId, phaseData) {
    try {
      const result = this.repos.chantiers.addPhase(chantierId, phaseData);
      return { success: true, data: result };
    } catch (error) {
      console.error('ChantierController.addPhase error:', error);
      return { success: false, error: error.message };
    }
  }

  async savePhases(event, chantierId, phases) {
    try {
      const result = this.repos.chantiers.savePhases(chantierId, phases);
      return { success: true, data: result };
    } catch (error) {
      console.error('ChantierController.savePhases error:', error);
      return { success: false, error: error.message };
    }
  }

  async createPhase(event, data) {
    try {
      const phase = this.repos.phases.create(data);
      return { success: true, data: phase };
    } catch (error) {
      console.error('ChantierController.createPhase error:', error);
      return { success: false, error: error.message };
    }
  }

  async updatePhase(event, id, data) {
    try {
      const phase = this.repos.phases.update(id, data);
      return { success: true, data: phase };
    } catch (error) {
      console.error('ChantierController.updatePhase error:', error);
      return { success: false, error: error.message };
    }
  }

  async deletePhase(event, id) {
    try {
      const result = this.repos.phases.softDelete(id);
      return { success: true, data: result };
    } catch (error) {
      console.error('ChantierController.deletePhase error:', error);
      return { success: false, error: error.message };
    }
  }

  async updatePhaseAvancement(event, id, pct) {
    try {
      const result = this.repos.phases.updateAvancement(id, pct);
      return { success: true, data: result };
    } catch (error) {
      console.error('ChantierController.updatePhaseAvancement error:', error);
      return { success: false, error: error.message };
    }
  }

  async reorderPhases(event, chantierId, ids) {
    try {
      const result = this.repos.phases.reorder(chantierId, ids);
      return { success: true, data: result };
    } catch (error) {
      console.error('ChantierController.reorderPhases error:', error);
      return { success: false, error: error.message };
    }
  }

  async getAvancementGlobalPhases(event, chantierId) {
    try {
      const result = this.repos.phases.getAvancementGlobal(chantierId);
      return { success: true, data: result };
    } catch (error) {
      console.error('ChantierController.getAvancementGlobalPhases error:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================================
  // INCIDENTS
  // ============================================================

  async getIncidentsByChantier(event, chantierId) {
    try {
      const incidents = this.repos.incidents.getByChantier(chantierId);
      return { success: true, data: incidents };
    } catch (error) {
      console.error('ChantierController.getIncidentsByChantier error:', error);
      return { success: false, error: error.message };
    }
  }

  async addIncident(event, chantierId, incidentData, userId) {
    try {
      const result = this.repos.chantiers.addIncident(chantierId, incidentData, userId);
      return { success: true, data: result };
    } catch (error) {
      console.error('ChantierController.addIncident error:', error);
      return { success: false, error: error.message };
    }
  }

  async createIncident(event, data) {
    try {
      const incident = this.repos.incidents.create(data);
      return { success: true, data: incident };
    } catch (error) {
      console.error('ChantierController.createIncident error:', error);
      return { success: false, error: error.message };
    }
  }

  async updateIncident(event, id, data) {
    try {
      const result = this.repos.incidents.update(id, data);
      return { success: true, data: result };
    } catch (error) {
      console.error('ChantierController.updateIncident error:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteIncident(event, id) {
    try {
      const result = this.repos.incidents.softDelete(id);
      return { success: true, data: result };
    } catch (error) {
      console.error('ChantierController.deleteIncident error:', error);
      return { success: false, error: error.message };
    }
  }

  async changerStatutIncident(event, id, statut) {
    try {
      const result = this.repos.incidents.changerStatut(id, statut);
      return { success: true, data: result };
    } catch (error) {
      console.error('ChantierController.changerStatutIncident error:', error);
      return { success: false, error: error.message };
    }
  }

  async getIncidentsOuvertsByEntreprise(event, entrepriseId) {
    try {
      const incidents = this.repos.incidents.getOuvertsByEntreprise(entrepriseId);
      return { success: true, data: incidents };
    } catch (error) {
      console.error('ChantierController.getIncidentsOuvertsByEntreprise error:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================================
  // AFFECTATIONS RESSOURCES
  // ============================================================

  async getAffectationsByChantier(event, chantierId) {
    try {
      const affectations = this.repos.affectations.getByChantier(chantierId);
      return { success: true, data: affectations };
    } catch (error) {
      console.error('ChantierController.getAffectationsByChantier error:', error);
      return { success: false, error: error.message };
    }
  }

  async createAffectation(event, data) {
    try {
      const result = this.repos.affectations.create(data);
      return { success: true, data: result };
    } catch (error) {
      console.error('ChantierController.createAffectation error:', error);
      return { success: false, error: error.message };
    }
  }

  async updateAffectation(event, id, data) {
    try {
      const result = this.repos.affectations.update(id, data);
      return { success: true, data: result };
    } catch (error) {
      console.error('ChantierController.updateAffectation error:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteAffectation(event, id) {
    try {
      const result = this.repos.affectations.softDelete(id);
      return { success: true, data: result };
    } catch (error) {
      console.error('ChantierController.deleteAffectation error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = ChantierController;