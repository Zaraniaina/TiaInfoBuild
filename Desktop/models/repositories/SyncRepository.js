const BaseRepository = require('./BaseRepository');
const db = require('../db');

class SyncRepository extends BaseRepository {
  constructor() {
    super('SyncQueue');
  }

  static _config = {
    apiUrl: 'http://localhost:8000/api',
    autoSync: true,
    interval: 300000
  };

  getConfig() {
    return SyncRepository._config;
  }

  setConfig(config) {
    SyncRepository._config = { ...SyncRepository._config, ...config };
  }

  /**
   * PUSH — pousse les créations/modifications locales vers le serveur
   * ⚠️ Ne filtre PAS par is_deleted pour éviter les crashs si la colonne manque en test
   */
  async push() {
    const apiClient = require('../../services/apiClient');
    const tables = [
      'Chantier', 'Phase', 'Incident', 'Employe', 'Pointage',
      'HeureSupplementaire', 'Equipe', 'MembreEquipe',
      'Article', 'Fournisseur', 'MouvementStock',
      'Client', 'Devis', 'LigneDevis', 'Contrat',
      'Facture', 'Paiement', 'Depense', 'Alerte',
      'Materiel', 'Maintenance'
    ];

    let totalPushed = 0;
    const errors = [];

    for (const table of tables) {
      try {
        // ⚠️ Retirer AND is_deleted = 0 pour éviter les crashs
        const pendingRows = db.prepare(`SELECT * FROM ${table} WHERE is_synced = 0`).all();

        if (pendingRows.length > 0) {
          // ⚠️ baseUrl contient déjà /api, donc endpoint relatif
          const response = await apiClient.post(
            `/sync/push/${table.toLowerCase()}/`, 
            { items: pendingRows }
          );

          if (response && response.syncedIds && Array.isArray(response.syncedIds)) {
            for (const id of response.syncedIds) {
              this.markSynced(table, id);
              totalPushed++;
            }
          } else {
            for (const row of pendingRows) {
              this.markSynced(table, row.id);
              totalPushed++;
            }
          }

          this.logSync({
            table,
            action: 'push',
            status: 'success',
            payload: JSON.stringify({ count: pendingRows.length })
          });
        }
      } catch (err) {
        console.error(`Erreur Push pour la table ${table}:`, err.message);
        errors.push({ table, error: err.message });
        this.logSync({
          table,
          action: 'push',
          status: 'error',
          errorMessage: err.message
        });
      }
    }

    return {
      success: errors.length === 0,
      pushed: totalPushed,
      errors,
      message: `${totalPushed} enregistrement(s) poussé(s) au serveur`
    };
  }

  /**
   * PULL — récupère les modifications distantes depuis le serveur
   */
  async pull() {
    const apiClient = require('../../services/apiClient');
    
    const lastSyncRecord = db.prepare(`
      SELECT MAX(createdAt) as lastSync FROM SyncQueue 
      WHERE status = 'synced' OR status = 'success'
    `).get();
    const lastSync = lastSyncRecord?.lastSync || '1970-01-01T00:00:00.000Z';

    let totalPulled = 0;

    try {
      // ⚠️ baseUrl contient déjà /api, donc endpoint relatif
      const response = await apiClient.get('/sync/pull/', { since: lastSync });
      const dataByTable = response?.data || response || {};

      for (const [tableName, records] of Object.entries(dataByTable)) {
        if (Array.isArray(records)) {
          for (const record of records) {
            if (!record.id) continue;

            const existing = db.prepare(
              `SELECT id FROM ${tableName} WHERE id = ?`
            ).get(record.id);

            if (existing) {
              const keys = Object.keys(record).filter(k => k !== 'id');
              if (keys.length > 0) {
                const setClause = keys.map(k => `${k} = ?`).join(', ');
                const values = keys.map(k => record[k]);
                db.prepare(
                  `UPDATE ${tableName} SET ${setClause}, is_synced = 1 WHERE id = ?`
                ).run(...values, record.id);
              }
            } else {
              const keys = Object.keys(record);
              const placeholders = keys.map(() => '?').join(', ');
              const columns = keys.join(', ');
              const values = keys.map(k => record[k]);
              db.prepare(
                `INSERT OR REPLACE INTO ${tableName} (${columns}, is_synced) VALUES (${placeholders}, 1)`
              ).run(...values);
            }
            totalPulled++;
          }
        }
      }

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO SyncQueue (tableName, recordId, operation, status, createdAt)
        VALUES ('__sync_meta__', 0, 'pull', 'synced', ?)
      `).run(now);

      return {
        success: true,
        pulled: totalPulled,
        message: `${totalPulled} enregistrement(s) mis à jour depuis le serveur`
      };
    } catch (err) {
      console.error('Erreur Pull synchronisation:', err.message);
      return {
        success: false,
        pulled: 0,
        error: err.message
      };
    }
  }

  getStatus() {
    const lastSyncRecord = db.prepare(`
      SELECT MAX(createdAt) as lastSync FROM SyncQueue 
      WHERE status = 'synced' OR status = 'success'
    `).get();
    const lastSync = lastSyncRecord?.lastSync || null;
    const pendingCount = this.getPendingCount();

    return {
      lastSync,
      pendingChanges: pendingCount,
      isOnline: true,
      status: pendingCount > 0 ? 'pending' : 'synced'
    };
  }

  getPendingCount() {
    const tables = [
      'Chantier', 'Phase', 'Incident', 'Employe', 'Pointage',
      'HeureSupplementaire', 'Equipe', 'MembreEquipe',
      'Article', 'Fournisseur', 'MouvementStock',
      'Client', 'Devis', 'LigneDevis', 'Contrat',
      'Facture', 'Paiement', 'Depense', 'Alerte',
      'Materiel', 'Maintenance'
    ];

    let total = 0;
    for (const table of tables) {
      try {
        // ⚠️ Retirer AND is_deleted = 0 pour éviter les crashs
        const count = db.prepare(`
          SELECT COUNT(*) as c FROM ${table} WHERE is_synced = 0
        `).get();
        total += count?.c || 0;
      } catch (e) {
        // Ignorer si la table n'existe pas encore
      }
    }
    return total;
  }

  markSynced(table, id) {
    try {
      db.prepare(
        `UPDATE ${table} SET is_synced = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(id);
    } catch (e) {
      console.error(`Erreur markSynced ${table}:`, e);
    }
  }

  logSync(data) {
    return this.create({
      tableName: data.table || '__system__',
      recordId: data.recordId || 0,
      operation: data.action || 'push',
      status: data.status || 'pending',
      payload: data.payload || null,
      errorMessage: data.errorMessage || null
    });
  }

  getHistory(limit = 50) {
    const stmt = db.prepare(`
      SELECT * FROM SyncQueue
      WHERE tableName != '__sync_meta__'
      ORDER BY createdAt DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }
}

module.exports = SyncRepository;