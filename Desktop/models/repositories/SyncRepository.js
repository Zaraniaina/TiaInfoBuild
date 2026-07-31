const BaseRepository = require('./BaseRepository');
const db = require('../db');

class SyncRepository extends BaseRepository {
    constructor() {
        super('SyncLog'); // Table de log de synchronisation
    }

    /**
     * Pousser les changements locaux vers le serveur
     * @returns {Object} - Résultat { success, pushed, pulled, errors }
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
                // Récupérer tous les éléments non synchronisés
                const pendingRows = db.prepare(`SELECT * FROM ${table} WHERE is_synced = 0`).all();
                
                if (pendingRows.length > 0) {
                    // Envoi en batch vers l'API Endpoint du serveur Django
                    const response = await apiClient.post(`/api/sync/push/${table.toLowerCase()}/`, { items: pendingRows });
                    
                    if (response && response.syncedIds && Array.isArray(response.syncedIds)) {
                        for (const id of response.syncedIds) {
                            this.markSynced(table, id);
                            totalPushed++;
                        }
                    } else {
                        // Si le serveur accepte tout le lot par défaut
                        for (const row of pendingRows) {
                            this.markSynced(table, row.id);
                            totalPushed++;
                        }
                    }

                    this.logSync({
                        type: 'push',
                        table,
                        action: 'push_batch',
                        status: 'success',
                        details: { count: pendingRows.length }
                    });
                }
            } catch (err) {
                console.error(`Erreur Push pour la table ${table}:`, err.message);
                errors.push({ table, error: err.message });
                this.logSync({
                    type: 'push',
                    table,
                    action: 'push_batch',
                    status: 'error',
                    details: { error: err.message }
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
     * Récupérer les changements du serveur (Pull)
     * @returns {Object} - Résultat
     */
    async pull() {
        const apiClient = require('../../services/apiClient');
        const lastSync = localStorage?.getItem('tia_last_sync') || '1970-01-01T00:00:00.000Z';
        let totalPulled = 0;

        try {
            const response = await apiClient.get('/api/sync/pull/', { since: lastSync });
            const dataByTable = response?.data || response || {};

            for (const [tableName, records] of Object.entries(dataByTable)) {
                if (Array.isArray(records)) {
                    for (const record of records) {
                        if (!record.id) continue;

                        // Vérifier si l'enregistrement existe déjà localement
                        const existing = db.prepare(`SELECT id FROM ${tableName} WHERE id = ?`).get(record.id);

                        if (existing) {
                            // Mettre à jour l'enregistrement existant
                            const keys = Object.keys(record).filter(k => k !== 'id');
                            if (keys.length > 0) {
                                const setClause = keys.map(k => `${k} = ?`).join(', ');
                                const values = keys.map(k => record[k]);
                                db.prepare(`UPDATE ${tableName} SET ${setClause}, is_synced = 1 WHERE id = ?`).run(...values, record.id);
                            }
                        } else {
                            // Insérer un nouvel enregistrement
                            const keys = Object.keys(record);
                            const placeholders = keys.map(() => '?').join(', ');
                            const columns = keys.join(', ');
                            const values = keys.map(k => record[k]);

                            db.prepare(`INSERT OR REPLACE INTO ${tableName} (${columns}, is_synced) VALUES (${placeholders}, 1)`).run(...values);
                        }
                        totalPulled++;
                    }
                }
            }

            const now = new Date().toISOString();
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('tia_last_sync', now);
            }

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

    /**
     * Obtenir le statut de synchronisation
     * @returns {Object} - Statut
     */
    getStatus() {
        const lastSync = localStorage?.getItem('tia_last_sync') || null;
        const pendingCount = this.getPendingCount();

        return {
            lastSync,
            pendingChanges: pendingCount,
            isOnline: navigator?.onLine ?? true,
            status: pendingCount > 0 ? 'pending' : 'synced'
        };
    }

    /**
     * Nombre de changements en attente de sync
     * @returns {number} - Compteur
     */
    getPendingCount() {
        // Compter les enregistrements avec is_synced = 0
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
                const count = db.prepare(`
                    SELECT COUNT(*) as c FROM ${table} WHERE is_synced = 0 AND is_deleted = 0
                `).get();
                total += count?.c || 0;
            } catch (e) {
                // Table n'existe pas ou pas de colonne is_synced
            }
        }
        return total;
    }

    /**
     * Marquer comme synchronisé
     * @param {string} table - Nom table
     * @param {number} id - ID enregistrement
     */
    markSynced(table, id) {
        try {
            db.prepare(`UPDATE ${table} SET is_synced = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
        } catch (e) {
            console.error(`Erreur markSynced ${table}:`, e);
        }
    }

    /**
     * Enregistrer un log de sync
     * @param {Object} data - { type, table, recordId, action, status, details }
     */
    logSync(data) {
        return this.create({
            type: data.type, // 'push' | 'pull' | 'conflict'
            tableName: data.table,
            recordId: data.recordId,
            action: data.action, // 'create' | 'update' | 'delete'
            status: data.status, // 'success' | 'error' | 'conflict'
            details: JSON.stringify(data.details || {}),
            dateSync: new Date().toISOString()
        });
    }

    /**
     * Obtenir l'historique des syncs
     * @param {number} limit - Limite
     * @returns {Array} - Logs
     */
    getHistory(limit = 50) {
        const stmt = db.prepare(`
            SELECT * FROM SyncLog
            ORDER BY dateSync DESC
            LIMIT ?
        `);
        return stmt.all(limit);
    }
}

module.exports = SyncRepository;