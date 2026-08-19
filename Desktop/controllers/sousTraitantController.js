// Desktop/controllers/sousTraitantController.js
const db = require('../models/db')

class SousTraitantController {
  constructor(repos) {
    this.repos = repos
  }

  async list(event, { entrepriseId, chantierId }) {
    try {
      let items
      if (chantierId) {
        items = this.repos.sousTraitants.getByChantier(chantierId)
      } else {
        items = this.repos.sousTraitants.getAll({ entrepriseId })
      }
      return { success: true, data: items }
    } catch (error) {
      console.error('SousTraitantController.list error:', error)
      return { success: false, error: error.message }
    }
  }

  async get(event, id) {
    try {
      const item = this.repos.sousTraitants.getById(id)
      return { success: true, data: item }
    } catch (error) {
      console.error('SousTraitantController.get error:', error)
      return { success: false, error: error.message }
    }
  }

  async create(event, data, entrepriseId) {
    try {
      const result = this.repos.sousTraitants.create({ ...data, entrepriseId }, entrepriseId)
      return { success: true, data: result }
    } catch (error) {
      console.error('SousTraitantController.create error:', error)
      return { success: false, error: error.message }
    }
  }

  async update(event, id, data) {
    try {
      const result = this.repos.sousTraitants.update(id, data)
      return { success: true, data: result }
    } catch (error) {
      console.error('SousTraitantController.update error:', error)
      return { success: false, error: error.message }
    }
  }

  async delete(event, id) {
    try {
      const result = this.repos.sousTraitants.softDelete(id)
      return { success: true, data: result }
    } catch (error) {
      console.error('SousTraitantController.delete error:', error)
      return { success: false, error: error.message }
    }
  }

  async getAffectations(event, sousTraitantId) {
    try {
      const items = this.repos.sousTraitants.getAffectations(sousTraitantId)
      return { success: true, data: items }
    } catch (error) {
      console.error('SousTraitantController.getAffectations error:', error)
      return { success: false, error: error.message }
    }
  }
}

module.exports = SousTraitantController
