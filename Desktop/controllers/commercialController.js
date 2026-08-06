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
      if (!data || !data.nom || !data.nom.trim()) {
        return { success: false, error: 'Le nom du client est obligatoire.' }
      }
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

  // --- DEVIS (filtres appliqués) ---
  async getListDevis(event, { entrepriseId, limit = 50, offset = 0, statut, search }) {
    try {
      const where = []
      const params = []
      if (statut) {
        where.push('statut = ?')
        params.push(statut)
      }
      if (search) {
        where.push('numero LIKE ?')
        params.push(`%${search}%`)
      }
      const items = this.repos.devis.getAll({
        entrepriseId,
        limit,
        offset,
        where: where.length ? where.join(' AND ') : '',
        params
      })
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

  // --- DEVIS : CHANGEMENT DE STATUT (workflow acceptation) ---
  async changerStatutDevis(event, id, statut) {
    try {
      const statutsValides = ['brouillon', 'envoye', 'accepte', 'refuse', 'expire']
      if (!statutsValides.includes(statut)) {
        return { success: false, error: `Statut invalide. Valeurs acceptées : ${statutsValides.join(', ')}` }
      }
      const devis = this.repos.devis.getById(id)
      if (!devis) {
        return { success: false, error: 'Devis introuvable.' }
      }
      const result = this.repos.devis.update(id, { statut })
      return { success: true, data: result }
    } catch (error) {
      console.error('CommercialController.changerStatutDevis error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- DEVIS : REMPLACEMENT DES LIGNES (+ recalcul du total) ---
  async remplacerLignesDevis(event, devisId, lignes) {
    try {
      const devis = this.repos.devis.getById(devisId)
      if (!devis) {
        return { success: false, error: 'Devis introuvable.' }
      }
      if (!Array.isArray(lignes)) {
        return { success: false, error: 'Les lignes doivent être un tableau.' }
      }
      const nouvellesLignes = this.repos.lignesDevis.remplacerLignes(devisId, lignes)
      const montantTotal = nouvellesLignes.reduce(
        (sum, l) => sum + (l.quantite || 0) * (l.prixUnitaire || 0), 0
      )
      this.repos.devis.update(devisId, { montantTotal })
      return { success: true, data: this.repos.devis.getWithLignes(devisId) }
    } catch (error) {
      console.error('CommercialController.remplacerLignesDevis error:', error)
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

  // --- FACTURES (filtre statut appliqué) ---
  async getListFactures(event, { entrepriseId, limit = 50, offset = 0, statut }) {
    try {
      const where = []
      const params = []
      if (statut) {
        where.push('statut = ?')
        params.push(statut)
      }
      const items = this.repos.factures.getAll({
        entrepriseId,
        limit,
        offset,
        where: where.length ? where.join(' AND ') : '',
        params
      })
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
      if (!data || !data.contratId) {
        return { success: false, error: 'Une facture doit être rattachée à un contrat.' }
      }
      const montant = parseFloat(data.montant)
      if (!montant || montant <= 0) {
        return { success: false, error: 'Le montant doit être supérieur à 0.' }
      }
      const result = this.repos.factures.create({ ...data, montant, entrepriseId }, entrepriseId)
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