// Desktop/controllers/utilisateurController.js
/**
 * Contrôleur Main Process - Module Utilisateurs & Paramètres
 */
class UtilisateurController {
  constructor(repos) {
    this.repos = repos;
  }

  async getList(event, params) {
    try {
      const options = typeof params === 'object' && params !== null ? params : { entrepriseId: params };
      const items = this.repos.utilisateurs.getListWithRole(options);
      const total = this.repos.utilisateurs.count(options);
      return { success: true, data: { items, total } };
    } catch (error) {
      console.error('UtilisateurController.getList error:', error);
      return { success: false, error: error.message };
    }
  }

  async getById(event, id) {
    try {
      const item = this.repos.utilisateurs.getWithRelations(id);
      return { success: true, data: item };
    } catch (error) {
      console.error('UtilisateurController.getById error:', error);
      return { success: false, error: error.message };
    }
  }

  async create(event, data, entrepriseId) {
    try {
      const result = this.repos.utilisateurs.createUser(data, entrepriseId);
      return { success: true, data: result };
    } catch (error) {
      console.error('UtilisateurController.create error:', error);
      return { success: false, error: error.message };
    }
  }

  async update(event, id, data) {
    try {
      const result = this.repos.utilisateurs.updateUser(id, data);
      return { success: true, data: result };
    } catch (error) {
      console.error('UtilisateurController.update error:', error);
      return { success: false, error: error.message };
    }
  }

  async delete(event, id) {
    try {
      const result = this.repos.utilisateurs.softDelete(id);
      return { success: true, data: result };
    } catch (error) {
      console.error('UtilisateurController.delete error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = UtilisateurController;