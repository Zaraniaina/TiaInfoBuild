// Desktop/controllers/commercialController.js
/**
 * Contrôleur Main Process - Module Commercial (Clients, Adresses, Devis, Contrats, Factures, Paiements)
 */
class CommercialController {
  constructor(repos) {
    this.repos = repos
  }

  // --- CLIENTS ---
  async getListClients(event, { entrepriseId, limit, offset, search, type, tri }) {
    try {
      let items, total
      if (search || type || tri) {
        if (typeof this.repos.clients.searchWithFilters === 'function') {
          items = this.repos.clients.searchWithFilters(entrepriseId, { search, type, tri, limit, offset })
          total = this.repos.clients.countWithFilters(entrepriseId, { search, type })
        } else {
          items = this.repos.clients.getAll({ entrepriseId, limit, offset })
          total = this.repos.clients.count({ entrepriseId })
        }
      } else {
        items = this.repos.clients.getAll({ entrepriseId, limit, offset })
        total = this.repos.clients.count({ entrepriseId })
      }
      return { success: true, data: { items: items || [], total: total || 0 } }
    } catch (error) {
      console.error('CommercialController.getListClients error:', error)
      return { success: false, error: error.message }
    }
  }

  async getClientById(event, id) {
    try {
      let item
      try {
        item = typeof this.repos.clients.getWithRelations === 'function'
          ? this.repos.clients.getWithRelations(id)
          : this.repos.clients.getById(id)
      } catch (err) {
        console.warn('Fallback getById for client:', err.message)
        item = this.repos.clients.getById(id)
      }
      if (item && this.repos.clientAdresses && (!item.adresses || item.adresses.length === 0)) {
        item.adresses = this.repos.clientAdresses.getByClientId(id) || []
      }
      return { success: true, data: item }
    } catch (error) {
      console.error('CommercialController.getClientById error:', error)
      return { success: false, error: error.message }
    }
  }

  async createClient(event, data, entrepriseId) {
    try {
      const { adresses, ...clientData } = data
      const result = this.repos.clients.create({ ...clientData, entrepriseId }, entrepriseId)
      const clientId = result?.id || result
      if (adresses && adresses.length > 0 && this.repos.clientAdresses) {
        for (const adr of adresses) {
          this.repos.clientAdresses.createForClient(adr, clientId)
        }
      }
      return { success: true, data: result }
    } catch (error) {
      console.error('CommercialController.createClient error:', error)
      return { success: false, error: error.message }
    }
  }

  async updateClient(event, id, data) {
    try {
      const { adresses, ...clientData } = data
      const result = this.repos.clients.update(id, clientData)
      if (adresses && adresses.length > 0 && this.repos.clientAdresses) {
        for (const adr of adresses) {
          if (adr.id) {
            this.repos.clientAdresses.updateAdresse(adr.id, adr)
          } else {
            this.repos.clientAdresses.createForClient(adr, id)
          }
        }
      }
      return { success: true, data: result }
    } catch (error) {
      console.error('CommercialController.updateClient error:', error)
      return { success: false, error: error.message }
    }
  }

  async deleteClient(event, id) {
    try {
      const result = this.repos.clients.softDelete ? this.repos.clients.softDelete(id) : this.repos.clients.delete(id)
      return { success: true, data: result }
    } catch (error) {
      console.error('CommercialController.deleteClient error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- ADRESSES CLIENTS ---
  async getClientAdresses(event, clientId) {
    try {
      const items = this.repos.clientAdresses?.getByClientId(clientId) || []
      return { success: true, data: items }
    } catch (error) {
      console.error('CommercialController.getClientAdresses error:', error)
      return { success: false, error: error.message }
    }
  }

  async createClientAdresse(event, clientId, data) {
    try {
      const result = this.repos.clientAdresses.createForClient(data, clientId)
      return { success: true, data: result }
    } catch (error) {
      console.error('CommercialController.createClientAdresse error:', error)
      return { success: false, error: error.message }
    }
  }

  async updateClientAdresse(event, id, data) {
    try {
      const result = this.repos.clientAdresses.updateAdresse(id, data)
      return { success: true, data: result }
    } catch (error) {
      console.error('CommercialController.updateClientAdresse error:', error)
      return { success: false, error: error.message }
    }
  }

  async deleteClientAdresse(event, id) {
    try {
      const result = this.repos.clientAdresses.softDelete ? this.repos.clientAdresses.softDelete(id) : this.repos.clientAdresses.delete(id)
      return { success: true, data: result }
    } catch (error) {
      console.error('CommercialController.deleteClientAdresse error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- DEVIS ---
  async getListDevis(event, { entrepriseId, limit, offset, statut, search }) {
    try {
      const where = [];
      const params = [];
      if (statut) {
        where.push('statut = ?');
        params.push(statut);
      }
      if (search) {
        where.push('(numero LIKE ? OR reference LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }

      const items = this.repos.devis.getAll({
        entrepriseId, limit, offset,
        where: where.join(' AND '), params
      })
      const total = this.repos.devis.count({
        entrepriseId,
        where: where.join(' AND '), params
      })
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
      let result;
      if (Array.isArray(data.lignes)) {
        result = this.repos.devis.updateWithLignes(id, data);
      } else {
        result = this.repos.devis.update(id, data);
      }
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
  async getListContrats(event, { entrepriseId, limit, offset, statut, type }) {
    try {
      const where = [];
      const params = [];
      if (statut) {
        where.push('statut = ?');
        params.push(statut);
      }
      if (type) {
        where.push('typeContrat = ?');
        params.push(type);
      }

      const items = this.repos.contrats.getAll({
        entrepriseId, limit, offset,
        where: where.join(' AND '), params
      })
      const total = this.repos.contrats.count({
        entrepriseId,
        where: where.join(' AND '), params
      })
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
  async getListFactures(event, { entrepriseId, limit, offset, statut, search }) {
    try {
      const where = [];
      const params = [];
      if (statut) {
        where.push('statut = ?');
        params.push(statut);
      }
      if (search) {
        where.push('numero LIKE ?');
        params.push(`%${search}%`);
      }

      const items = this.repos.factures.getAll({
        entrepriseId, limit, offset,
        where: where.join(' AND '), params
      })
      const total = this.repos.factures.count({
        entrepriseId,
        where: where.join(' AND '), params
      })
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