/**
 * Contrôleur Main Process - Module de Synchronisation (Offline-First)
 */
class SyncController {
  constructor(repos) {
    this.repos = repos;
  }

  async getConfig(event) {
    try {
      const config = this.repos.sync.getConfig();
      return { success: true, data: config };
    } catch (error) {
      console.error('SyncController.getConfig error:', error);
      return { success: false, error: error.message };
    }
  }

  async setConfig(event, config) {
    try {
      this.repos.sync.setConfig(config);
      return { success: true, data: this.repos.sync.getConfig() };
    } catch (error) {
      console.error('SyncController.setConfig error:', error);
      return { success: false, error: error.message };
    }
  }

  async getHistory(event, limit) {
    try {
      const history = this.repos.sync.getHistory(limit || 50);
      return { success: true, data: history };
    } catch (error) {
      console.error('SyncController.getHistory error:', error);
      return { success: false, error: error.message };
    }
  }

  async getStatus(event) {
    try {
      const status = this.repos.sync.getStatus();
      return { success: true, data: status };
    } catch (error) {
      console.error('SyncController.getStatus error:', error);
      return { success: false, error: error.message };
    }
  }

  async push(event) {
    try {
      const result = await this.repos.sync.push();
      return { success: true, data: result };
    } catch (error) {
      console.error('SyncController.push error:', error);
      return { success: false, error: error.message };
    }
  }

  async pull(event) {
    try {
      const result = await this.repos.sync.pull();
      return { success: true, data: result };
    } catch (error) {
      console.error('SyncController.pull error:', error);
      return { success: false, error: error.message };
    }
  }
  async testConnection(event) {
    try {
      const config = this.repos.sync.getConfig()
      if (!config?.apiUrl) return { success: false, message: 'URL API non configurée' }
      const res = await fetch(`${config.apiUrl.replace(/\/$/, '')}/health`, {
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}
      })
      return { success: res.ok, message: res.ok ? 'Connexion réussie' : `Erreur HTTP ${res.status}` }
    } catch (error) {
      console.error('SyncController.testConnection error:', error)
      return { success: false, message: error.message }
    }
  }

  async syncNow(event) {
    try {
      const pushResult = await this.repos.sync.push()
      const pullResult = await this.repos.sync.pull()
      return { success: true, message: 'Synchronisation terminée', data: { pushResult, pullResult } }
    } catch (error) {
      console.error('SyncController.syncNow error:', error)
      return { success: false, message: error.message }
    }
  }

  async setAutoConfig(event, config) {
    try {
      this.repos.sync.setConfig({ ...this.repos.sync.getConfig(), ...config })
      return { success: true }
    } catch (error) {
      console.error('SyncController.setAutoConfig error:', error)
      return { success: false, error: error.message }
    }
  }
}

module.exports = SyncController;