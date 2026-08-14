// Desktop/controllers/auditController.js
class AuditController {
  constructor(repos) {
    this.repos = repos;
  }

  async getRecent(event, entrepriseId, limit = 50) {
    try {
      const items = this.repos.auditLog.getRecent(entrepriseId, limit);
      return { success: true, data: items };
    } catch (error) {
      console.error('AuditController.getRecent error:', error);
      return { success: false, error: error.message };
    }
  }

  async getByModule(event, entrepriseId, module, limit = 100, offset = 0) {
    try {
      const items = this.repos.auditLog.getByModule(entrepriseId, module, limit, offset);
      return { success: true, data: items };
    } catch (error) {
      console.error('AuditController.getByModule error:', error);
      return { success: false, error: error.message };
    }
  }

  async getByUtilisateur(event, entrepriseId, utilisateurId, limit = 100, offset = 0) {
    try {
      const items = this.repos.auditLog.getByUtilisateur(entrepriseId, utilisateurId, limit, offset);
      return { success: true, data: items };
    } catch (error) {
      console.error('AuditController.getByUtilisateur error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = AuditController;
