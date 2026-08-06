/**
 * Contrôleur Main Process - Module Finance, Dépenses, Rapports & Alertes
 */
class FinanceController {
  constructor(repos) {
    this.repos = repos
  }

  // --- DÉPENSES : LISTE GLOBALE ---
  async getListDepenses(event, { entrepriseId, chantierId, categorie, nonValidees, limit = 100, offset = 0 } = {}) {
    try {
      let items
      if (chantierId) {
        items = this.repos.depenses.getByChantier(chantierId)
      } else {
        const where = []
        const params = []
        where.push('chantierId IN (SELECT id FROM Chantier WHERE entrepriseId = ? AND is_deleted = 0)')
        params.push(entrepriseId)
        if (categorie) {
          where.push('categorie = ?')
          params.push(categorie)
        }
        if (nonValidees) {
          where.push('valideePar IS NULL')
        }
        items = this.repos.depenses.getAll({
          where: where.join(' AND '),
          params,
          limit,
          offset
        })
      }
      return { success: true, data: items }
    } catch (error) {
      console.error('FinanceController.getListDepenses error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- DÉPENSES : CRÉATION ---
  async createDepense(event, data) {
    try {
      if (!data || !data.chantierId) {
        return { success: false, error: 'Le chantier est obligatoire.' }
      }
      const montant = parseFloat(data.montant)
      if (!montant || montant <= 0) {
        return { success: false, error: 'Le montant doit être supérieur à 0.' }
      }
      const result = this.repos.depenses.create({
        ...data,
        montant,
        categorie: data.categorie || 'Autre',
        dateDepense: data.dateDepense || new Date().toISOString().split('T')[0],
        valideePar: data.valideePar ?? null
      })
      return { success: true, data: result }
    } catch (error) {
      console.error('FinanceController.createDepense error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- DÉPENSES : MISE À JOUR ---
  async updateDepense(event, id, data) {
    try {
      const result = this.repos.depenses.update(id, data)
      return { success: true, data: result }
    } catch (error) {
      console.error('FinanceController.updateDepense error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- DÉPENSES : SUPPRESSION (soft) ---
  async deleteDepense(event, id) {
    try {
      const result = this.repos.depenses.softDelete(id)
      return { success: true, data: result }
    } catch (error) {
      console.error('FinanceController.deleteDepense error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- DÉPENSES : VALIDATION ---
  async validerDepense(event, id, userId) {
    try {
      if (!userId) {
        return { success: false, error: 'Un utilisateur est requis pour valider une dépense.' }
      }
      const depense = this.repos.depenses.getById(id)
      if (!depense) {
        return { success: false, error: 'Dépense introuvable.' }
      }
      const result = this.repos.depenses.update(id, { valideePar: userId })
      return { success: true, data: result }
    } catch (error) {
      console.error('FinanceController.validerDepense error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- DÉPENSES : LECTURE PAR CHANTIER ---
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

  // --- RAPPORTS FINANCIERS ---
  async genererRapportFinancier(event, chantierId, periode) {
    try {
      const rapport = this.repos.rapportsFinanciers.generer(chantierId, periode)
      return { success: true, data: rapport }
    } catch (error) {
      console.error('FinanceController.genererRapportFinancier error:', error)
      return { success: false, error: error.message }
    }
  }

  async getListRapports(event, entrepriseId) {
    try {
      const items = this.repos.rapportsFinanciers.getByEntreprise(entrepriseId)
      return { success: true, data: items }
    } catch (error) {
      console.error('FinanceController.getListRapports error:', error)
      return { success: false, error: error.message }
    }
  }

  async getRapportById(event, id) {
    try {
      const item = this.repos.rapportsFinanciers.getById(id)
      if (!item) return { success: false, error: 'Rapport introuvable' }
      return { success: true, data: item }
    } catch (error) {
      console.error('FinanceController.getRapportById error:', error)
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