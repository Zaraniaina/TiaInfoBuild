// Desktop/controllers/catalogueController.js
const db = require('../models/db')

class CatalogueController {
  constructor(repos) {
    this.repos = repos
  }

  async list(event, { entrepriseId, categorie }) {
    try {
      let items
      if (categorie) {
        items = this.repos.catalogueDevis.getByCategorie(categorie)
      } else {
        items = this.repos.catalogueDevis.getAll({ entrepriseId })
      }
      return { success: true, data: items }
    } catch (error) {
      console.error('CatalogueController.list error:', error)
      return { success: false, error: error.message }
    }
  }

  async get(event, id) {
    try {
      const item = this.repos.catalogueDevis.getById(id)
      return { success: true, data: item }
    } catch (error) {
      console.error('CatalogueController.get error:', error)
      return { success: false, error: error.message }
    }
  }

  async create(event, data, entrepriseId) {
    try {
      const result = this.repos.catalogueDevis.create({ ...data, entrepriseId }, entrepriseId)
      return { success: true, data: result }
    } catch (error) {
      console.error('CatalogueController.create error:', error)
      return { success: false, error: error.message }
    }
  }

  async update(event, id, data) {
    try {
      const result = this.repos.catalogueDevis.update(id, data)
      return { success: true, data: result }
    } catch (error) {
      console.error('CatalogueController.update error:', error)
      return { success: false, error: error.message }
    }
  }

  async delete(event, id) {
    try {
      const result = this.repos.catalogueDevis.softDelete(id)
      return { success: true, data: result }
    } catch (error) {
      console.error('CatalogueController.delete error:', error)
      return { success: false, error: error.message }
    }
  }

  async getCategories(event, entrepriseId) {
    try {
      const items = this.repos.catalogueDevis.getAllCategories(entrepriseId)
      return { success: true, data: items }
    } catch (error) {
      console.error('CatalogueController.getCategories error:', error)
      return { success: false, error: error.message }
    }
  }
}

module.exports = CatalogueController
