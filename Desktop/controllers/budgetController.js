// Desktop/controllers/budgetController.js
const db = require('../models/db')

class BudgetController {
  constructor(repos) {
    this.repos = repos
  }

  async list(event, { entrepriseId, chantierId }) {
    try {
      let items
      if (chantierId) {
        items = this.repos.budgetPrevisionnel.getByChantier(chantierId)
      } else {
        items = this.repos.budgetPrevisionnel.getByEntreprise(entrepriseId)
      }
      return { success: true, data: items }
    } catch (error) {
      console.error('BudgetController.list error:', error)
      return { success: false, error: error.message }
    }
  }

  async get(event, id) {
    try {
      const item = this.repos.budgetPrevisionnel.getById(id)
      return { success: true, data: item }
    } catch (error) {
      console.error('BudgetController.get error:', error)
      return { success: false, error: error.message }
    }
  }

  async create(event, data, entrepriseId) {
    try {
      const result = this.repos.budgetPrevisionnel.create({ ...data, entrepriseId }, entrepriseId)
      return { success: true, data: result }
    } catch (error) {
      console.error('BudgetController.create error:', error)
      return { success: false, error: error.message }
    }
  }

  async update(event, id, data) {
    try {
      const result = this.repos.budgetPrevisionnel.update(id, data)
      return { success: true, data: result }
    } catch (error) {
      console.error('BudgetController.update error:', error)
      return { success: false, error: error.message }
    }
  }

  async delete(event, id) {
    try {
      const result = this.repos.budgetPrevisionnel.softDelete(id)
      return { success: true, data: result }
    } catch (error) {
      console.error('BudgetController.delete error:', error)
      return { success: false, error: error.message }
    }
  }

  async comparer(event, chantierId) {
    try {
      const data = this.repos.budgetPrevisionnel.comparer(chantierId)
      return { success: true, data }
    } catch (error) {
      console.error('BudgetController.comparer error:', error)
      return { success: false, error: error.message }
    }
  }
}

module.exports = BudgetController
