/**
 * Contrôleur Main Process - Module Commercial (Clients, Devis, Contrats, Factures, Paiements)
 */
class CommercialController {
  constructor(repos) {
    this.repos = repos
  }

  // --- CLIENTS ---
  async getListClients(event, { entrepriseId, limit, offset, search }) {
    try {
      let items
      if (search) {
        items = this.repos.clients.search(entrepriseId, search)
      } else {
        items = this.repos.clients.getAll({ entrepriseId, limit, offset })
      }
      const total = this.repos.clients.count({ entrepriseId })
      return { success: true, data: { items, total } }
    } catch (error) {
      console.error('CommercialController.getListClients error:', error)
      return { success: false, error: error.message }
    }
  }

  async getClientById(event, id) {
    try {
      const item = this.repos.clients.getWithRelations(id)
      return { success: true, data: item }
    } catch (error) {
      console.error('CommercialController.getClientById error:', error)
      return { success: false, error: error.message }
    }
  }

  async createClient(event, data, entrepriseId) {
    try {
      const result = this.repos.clients.create({ ...data, entrepriseId }, entrepriseId)
      return { success: true, data: result }
    } catch (error) {
      console.error('CommercialController.createClient error:', error)
      return { success: false, error: error.message }
    }
  }

  async updateClient(event, id, data) {
    try {
      const result = this.repos.clients.update(id, data)
      return { success: true, data: result }
    } catch (error) {
      console.error('CommercialController.updateClient error:', error)
      return { success: false, error: error.message }
    }
  }

  async deleteClient(event, id) {
    try {
      const result = this.repos.clients.softDelete(id)
      return { success: true, data: result }
    } catch (error) {
      console.error('CommercialController.deleteClient error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- DEVIS ---
  async getListDevis(event, { entrepriseId, limit, offset, statut, search }) {
    try {
      const items = this.repos.devis.getAll({ entrepriseId, limit, offset })
      const total = this.repos.devis.count({ entrepriseId })
      return { success: true, data: { items, total } }
    } catch (error) {
      console.error('CommercialController.getListDevis error:', error)
      return { success: false, error: error.message }
    }
  }

  async getDevisById(event, id) {
    try {
      const item = this.repos.devis.getWithLignes(id)
      return { success: true, data: item }
    } catch (error) {
      console.error('CommercialController.getDevisById error:', error)
      return { success: false, error: error.message }
    }
  }

  async createDevis(event, data, entrepriseId) {
    try {
      const result = this.repos.devis.createWithLignes(data, entrepriseId)
      return { success: true, data: result }
    } catch (error) {
      console.error('CommercialController.createDevis error:', error)
      return { success: false, error: error.message }
    }
  }

  async updateDevis(event, id, data) {
    try {
      const result = this.repos.devis.update(id, data)
      return { success: true, data: result }
    } catch (error) {
      console.error('CommercialController.updateDevis error:', error)
      return { success: false, error: error.message }
    }
  }

  async transformerDevisEnContrat(event, devisId, contratData) {
    try {
      const result = this.repos.devis.transformerEnContrat(devisId, contratData)
      return { success: true, data: result }
    } catch (error) {
      console.error('CommercialController.transformerDevisEnContrat error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- CONTRATS ---
  async getListContrats(event, { entrepriseId, limit, offset }) {
    try {
      const items = this.repos.contrats.getAll({ entrepriseId, limit, offset })
      const total = this.repos.contrats.count({ entrepriseId })
      return { success: true, data: { items, total } }
    } catch (error) {
      console.error('CommercialController.getListContrats error:', error)
      return { success: false, error: error.message }
    }
  }

  async getContratById(event, id) {
    try {
      const item = this.repos.contrats.getWithRelations(id)
      return { success: true, data: item }
    } catch (error) {
      console.error('CommercialController.getContratById error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- FACTURES ---
  async getListFactures(event, { entrepriseId, limit, offset, statut }) {
    try {
      const items = this.repos.factures.getAll({ entrepriseId, limit, offset })
      const total = this.repos.factures.count({ entrepriseId })
      return { success: true, data: { items, total } }
    } catch (error) {
      console.error('CommercialController.getListFactures error:', error)
      return { success: false, error: error.message }
    }
  }

  async getFactureById(event, id) {
    try {
      const item = this.repos.factures.getWithPaiements(id)
      return { success: true, data: item }
    } catch (error) {
      console.error('CommercialController.getFactureById error:', error)
      return { success: false, error: error.message }
    }
  }

  async createFacture(event, data, entrepriseId) {
    try {
      // Les factures héritent de BaseRepository donc ont accès à .create()
      const result = this.repos.factures.create({ ...data, entrepriseId }, entrepriseId)
      return { success: true, data: result }
    } catch (error) {
      console.error('CommercialController.createFacture error:', error)
      return { success: false, error: error.message }
    }
  }

  async updateFacture(event, id, data) {
    try {
      const result = this.repos.factures.update(id, data)
      return { success: true, data: result }
    } catch (error) {
      console.error('CommercialController.updateFacture error:', error)
      return { success: false, error: error.message }
    }
  }

  async deleteFacture(event, id) {
    try {
      const result = this.repos.factures.softDelete(id)
      return { success: true, data: result }
    } catch (error) {
      console.error('CommercialController.deleteFacture error:', error)
      return { success: false, error: error.message }
    }
  }

  async getFacturesEnRetard(event, entrepriseId) {
    try {
      const items = this.repos.factures.getEnRetard(entrepriseId)
      return { success: true, data: items }
    } catch (error) {
      console.error('CommercialController.getFacturesEnRetard error:', error)
      return { success: false, error: error.message }
    }
  }

  async ajouterPaiementFacture(event, factureId, paiementData) {
    try {
      const result = this.repos.factures.ajouterPaiement(factureId, paiementData)
      return { success: true, data: result }
    } catch (error) {
      console.error('CommercialController.ajouterPaiementFacture error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- PAIEMENTS ---
  async getPaiementsByFacture(event, factureId) {
    try {
      const items = this.repos.paiements.getByFacture(factureId)
      return { success: true, data: items }
    } catch (error) {
      console.error('CommercialController.getPaiementsByFacture error:', error)
      return { success: false, error: error.message }
    }
  }
}

module.exports = CommercialController
