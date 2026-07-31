const apiClient = require('./apiClient')

/**
 * Service de Synchronisation Offline-First (Local <-> Serveur Django)
 */
class SyncService {
  constructor(syncRepository) {
    this.syncRepo = syncRepository
    this.isSyncing = false
    this.lastSyncTime = null
  }

  setSyncRepository(syncRepository) {
    this.syncRepo = syncRepository
  }

  /**
   * Effectuer un push complet des modifications locales non synchronisées (is_synced = 0)
   */
  async push() {
    if (this.isSyncing) {
      return { success: false, message: 'Synchronisation déjà en cours' }
    }

    this.isSyncing = true
    try {
      if (this.syncRepo) {
        const result = await this.syncRepo.push()
        this.lastSyncTime = new Date().toISOString()
        return { success: true, data: result, lastSync: this.lastSyncTime }
      }
      return { success: true, message: 'Sync Repo local simulé' }
    } catch (error) {
      console.error('SyncService.push error:', error)
      return { success: false, error: error.message }
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Récupérer les modifications distantes depuis le serveur Django (pull)
   */
  async pull() {
    if (this.isSyncing) {
      return { success: false, message: 'Synchronisation déjà en cours' }
    }

    this.isSyncing = true
    try {
      if (this.syncRepo) {
        const result = await this.syncRepo.pull()
        this.lastSyncTime = new Date().toISOString()
        return { success: true, data: result, lastSync: this.lastSyncTime }
      }
      return { success: true, message: 'Sync Repo pull local simulé' }
    } catch (error) {
      console.error('SyncService.pull error:', error)
      return { success: false, error: error.message }
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Obtenir le statut courant de la synchronisation (nombre d'éléments en attente, etc.)
   */
  async getStatus() {
    try {
      if (this.syncRepo) {
        const status = this.syncRepo.getStatus()
        return {
          success: true,
          data: {
            ...status,
            isSyncing: this.isSyncing,
            lastSyncTime: this.lastSyncTime
          }
        }
      }
      return {
        success: true,
        data: {
          pendingCount: 0,
          isSyncing: this.isSyncing,
          lastSyncTime: this.lastSyncTime
        }
      }
    } catch (error) {
      console.error('SyncService.getStatus error:', error)
      return { success: false, error: error.message }
    }
  }
}

module.exports = SyncService
