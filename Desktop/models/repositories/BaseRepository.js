const db = require('../db');

/**
 * BaseRepository - Couche d'abstraction générique pour l'accès aux données
 * Fournit CRUD de base + gestion des flags de synchronisation (is_synced, is_deleted, server_id)
 */
class BaseRepository {
    constructor(tableName, primaryKey = 'id') {
        this.tableName = tableName;
        this.primaryKey = primaryKey;
        this.db = db;
    }

    /**
     * Construire la clause WHERE pour le filtrage multi-tenant
     * @param {number} entrepriseId - ID de l'entreprise (optionnel)
     * @returns {string} - Clause WHERE SQL
     */
    _entrepriseWhere(entrepriseId) {
        if (entrepriseId) {
            return `WHERE entrepriseId = ${entrepriseId} AND is_deleted = 0`;
        }
        return 'WHERE is_deleted = 0';
    }

    /**
     * Mapper un objet JS vers les colonnes de la table (exclut id, created_at, updated_at)
     * @param {Object} data - Données à insérer/mettre à jour
     * @returns {Object} - { columns: string, values: Array, placeholders: string }
     */
    _mapData(data) {
        const allowedKeys = Object.keys(data).filter(k =>
            k !== this.primaryKey &&
            k !== 'created_at' &&
            k !== 'updated_at'
        );

        const columns = allowedKeys.join(', ');
        const placeholders = allowedKeys.map(() => '?').join(', ');
        const values = allowedKeys.map(k => data[k]);

        return { columns, values, placeholders };
    }

    /**
     * Créer un nouvel enregistrement
     * @param {Object} data - Données à insérer
     * @param {number} entrepriseId - ID entreprise pour multi-tenant
     * @returns {Object} - { id, server_id, ...data }
     */
    create(data, entrepriseId = null) {
        const { columns, values, placeholders } = this._mapData(data);

        // Ajouter entrepriseId si fourni et pas déjà dans data
        let finalColumns = columns;
        let finalValues = values;
        let finalPlaceholders = placeholders;

        if (entrepriseId && !data.entrepriseId) {
            finalColumns += (columns ? ', ' : '') + 'entrepriseId';
            finalPlaceholders += (placeholders ? ', ' : '') + '?';
            finalValues.push(entrepriseId);
        }

        const stmt = this.db.prepare(
            `INSERT INTO ${this.tableName} (${finalColumns}) VALUES (${finalPlaceholders})`
        );
        const info = stmt.run(...finalValues);

        return this.getById(info.lastInsertRowid);
    }

    /**
     * Récupérer un enregistrement par ID
     * @param {number} id - ID local
     * @returns {Object|null} - Enregistrement ou null
     */
    getById(id) {
        const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ? AND is_deleted = 0`);
        return stmt.get(id) || null;
    }

    /**
     * Récupérer un enregistrement par server_id
     * @param {number} serverId - ID serveur distant
     * @returns {Object|null} - Enregistrement ou null
     */
    getByServerId(serverId) {
        const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE server_id = ? AND is_deleted = 0`);
        return stmt.get(serverId) || null;
    }

    /**
     * Récupérer tous les enregistrements (avec pagination et filtres)
     * @param {Object} options - { entrepriseId, limit, offset, orderBy, where, params }
     * @returns {Array} - Liste des enregistrements
     */
    getAll(options = {}) {
        const {
            entrepriseId,
            limit = 50,
            offset = 0,
            orderBy = `${this.primaryKey} DESC`,
            where = '',
            params = []
        } = options;

        let sql = `SELECT * FROM ${this.tableName} ${this._entrepriseWhere(entrepriseId)}`;

        if (where) {
            sql += ` AND ${where}`;
        }

        sql += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;

        const stmt = this.db.prepare(sql);
        return stmt.all(...params, limit, offset);
    }

    /**
     * Compter les enregistrements
     * @param {Object} options - { entrepriseId, where, params }
     * @returns {number} - Nombre total
     */
    count(options = {}) {
        const { entrepriseId, where = '', params = [] } = options;

        let sql = `SELECT COUNT(*) as total FROM ${this.tableName} ${this._entrepriseWhere(entrepriseId)}`;

        if (where) {
            sql += ` AND ${where}`;
        }

        const stmt = this.db.prepare(sql);
        const result = stmt.get(...params);
        return result?.total || 0;
    }

    /**
     * Mettre à jour un enregistrement
     * @param {number} id - ID local
     * @param {Object} data - Données à mettre à jour
     * @returns {Object|null} - Enregistrement mis à jour ou null
     */
    update(id, data) {
        const { columns, values } = this._mapData(data);

        if (!columns) return this.getById(id);

        // Marquer comme non synchronisé
        const setClause = `${columns}, is_synced = 0, updated_at = CURRENT_TIMESTAMP`;

        const stmt = this.db.prepare(
            `UPDATE ${this.tableName} SET ${setClause.split(', ').map(c => c.includes('=') ? c : `${c} = ?`).join(', ')} WHERE ${this.primaryKey} = ?`
        );

        // Reconstruire les valeurs dans l'ordre des colonnes
        const allowedKeys = Object.keys(data).filter(k =>
            k !== this.primaryKey &&
            k !== 'created_at' &&
            k !== 'updated_at'
        );
        const orderedValues = allowedKeys.map(k => data[k]);

        stmt.run(...orderedValues, id);

        return this.getById(id);
    }

    /**
     * Suppression logique (soft delete)
     * @param {number} id - ID local
     * @returns {boolean} - Succès
     */
    softDelete(id) {
        const stmt = this.db.prepare(
            `UPDATE ${this.tableName} SET is_deleted = 1, is_synced = 0, updated_at = CURRENT_TIMESTAMP WHERE ${this.primaryKey} = ?`
        );
        const info = stmt.run(id);
        return info.changes > 0;
    }

    /**
     * Suppression physique (à utiliser avec précaution)
     * @param {number} id - ID local
     * @returns {boolean} - Succès
     */
    hardDelete(id) {
        const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`);
        const info = stmt.run(id);
        return info.changes > 0;
    }

    /**
     * Marquer comme synchronisé
     * @param {number} id - ID local
     * @param {number} serverId - ID serveur distant
     * @returns {boolean} - Succès
     */
    markSynced(id, serverId) {
        const stmt = this.db.prepare(
            `UPDATE ${this.tableName} SET is_synced = 1, server_id = ?, updated_at = CURRENT_TIMESTAMP WHERE ${this.primaryKey} = ?`
        );
        const info = stmt.run(serverId, id);
        return info.changes > 0;
    }

    /**
     * Récupérer les enregistrements non synchronisés (pour push vers serveur)
     * @param {number} entrepriseId - ID entreprise
     * @param {number} limit - Limite
     * @returns {Array} - Enregistrements à synchroniser
     */
    getUnsynced(entrepriseId, limit = 100) {
        const stmt = this.db.prepare(`
            SELECT * FROM ${this.tableName} 
            WHERE entrepriseId = ? AND is_deleted = 0 AND is_synced = 0
            ORDER BY created_at ASC
            LIMIT ?
        `);
        return stmt.all(entrepriseId, limit);
    }

    /**
     * Récupérer les enregistrements supprimés non synchronisés
     * @param {number} entrepriseId - ID entreprise
     * @param {number} limit - Limite
     * @returns {Array} - Enregistrements supprimés à synchroniser
     */
    getDeletedUnsynced(entrepriseId, limit = 100) {
        const stmt = this.db.prepare(`
            SELECT * FROM ${this.tableName} 
            WHERE entrepriseId = ? AND is_deleted = 1 AND is_synced = 0
            ORDER BY updated_at ASC
            LIMIT ?
        `);
        return stmt.all(entrepriseId, limit);
    }

    /**
     * Recherche textuelle simple
     * @param {string} searchTerm - Terme de recherche
     * @param {string[]} columns - Colonnes à rechercher
     * @param {Object} options - { entrepriseId, limit, offset }
     * @returns {Array} - Résultats
     */
    search(searchTerm, columns, options = {}) {
        const { entrepriseId, limit = 50, offset = 0 } = options;

        if (!searchTerm || !columns.length) return this.getAll(options);

        const whereClause = columns.map(c => `${c} LIKE ?`).join(' OR ');
        const searchParam = `%${searchTerm}%`;
        const params = columns.map(() => searchParam);

        return this.getAll({
            ...options,
            where: `(${whereClause})`,
            params
        });
    }

    /**
     * Exécuter une requête brute (pour cas complexes)
     * @param {string} sql - SQL brut
     * @param {Array} params - Paramètres
     * @returns {Array} - Résultats
     */
    rawQuery(sql, params = []) {
        const stmt = this.db.prepare(sql);
        return stmt.all(...params);
    }

    /**
     * Exécuter une transaction
     * @param {Function} callback - Fonction recevant la DB pour exécuter plusieurs opérations
     * @returns {any} - Résultat du callback
     */
    transaction(callback) {
        const transaction = this.db.transaction(callback);
        return transaction();
    }
}

module.exports = BaseRepository;