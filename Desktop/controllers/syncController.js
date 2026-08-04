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
}

module.exports = SyncController;