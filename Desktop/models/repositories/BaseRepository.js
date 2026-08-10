// Desktop/models/repositories/BaseRepository.js
const db = require('../db');

/**
 * BaseRepository - Couche d'abstraction générique pour l'accès aux données
 */
class BaseRepository {
  constructor(tableName, primaryKey = 'id') {
    this.tableName = tableName;
    this.primaryKey = primaryKey;
    this.db = db;
    this._tableColumns = null;
  }

  /**
   * Inspecter et mettre en cache les colonnes réelles de la table SQLite
   * @returns {Set<string>|null} Ensemble des noms de colonnes
   */
  getTableColumns() {
    if (!this._tableColumns) {
      try {
        const rows = this.db.prepare(`PRAGMA table_info(${this.tableName})`).all();
        if (rows && rows.length > 0) {
          this._tableColumns = new Set(rows.map(r => r.name));
        }
      } catch (e) {
        this._tableColumns = null;
      }
    }
    return this._tableColumns;
  }

  /**
   * Réinitialiser le cache des colonnes (en cas de migration dynamique)
   */
  refreshTableColumns() {
    this._tableColumns = null;
    return this.getTableColumns();
  }

  /**
   * Construire la clause WHERE pour le filtrage multi-tenant sans ambiguïté
   */
  _entrepriseWhere(entrepriseId, prefix = '') {
    const p = prefix ? `${prefix}.` : '';
    if (entrepriseId) {
      return `WHERE ${p}entrepriseId = ${entrepriseId} AND ${p}is_deleted = 0`;
    }
    return `WHERE ${p}is_deleted = 0`;
  }

  /**
   * Mapper et filtrer un objet JS vers les colonnes réelles de la table
   */
  _mapData(data) {
    const validCols = this.getTableColumns();
    const allowedKeys = Object.keys(data).filter(k =>
      k !== this.primaryKey &&
      k !== 'created_at' &&
      k !== 'updated_at' &&
      (validCols ? validCols.has(k) : true)
    );
    const columns = allowedKeys.join(', ');
    const placeholders = allowedKeys.map(() => '?').join(', ');
    const values = allowedKeys.map(k => data[k]);
    return { allowedKeys, columns, values, placeholders };
  }

  create(data, entrepriseId = null) {
    const { columns, values, placeholders } = this._mapData(data);
    let finalColumns = columns;
    let finalValues = [...values];
    let finalPlaceholders = placeholders;

    const validCols = this.getTableColumns();
    if (entrepriseId && !data.entrepriseId && (!validCols || validCols.has('entrepriseId'))) {
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

  getById(id) {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ? AND is_deleted = 0`);
    return stmt.get(id) || null;
  }

  getByServerId(serverId) {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE server_id = ? AND is_deleted = 0`);
    return stmt.get(serverId) || null;
  }

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

  update(id, data) {
    const { allowedKeys, values } = this._mapData(data);
    if (!allowedKeys || allowedKeys.length === 0) return this.getById(id);

    const setClause = allowedKeys.map(key => `${key} = ?`).concat(['is_synced = 0', 'updated_at = CURRENT_TIMESTAMP']).join(', ');
    const stmt = this.db.prepare(
      `UPDATE ${this.tableName} SET ${setClause} WHERE ${this.primaryKey} = ?`
    );
    stmt.run(...values, id);
    return this.getById(id);
  }

   list(options = {}) {
    return this.getAll(options);
  }

  softDelete(id) {
    const stmt = this.db.prepare(
      `UPDATE ${this.tableName} SET is_deleted = 1, is_synced = 0, updated_at = CURRENT_TIMESTAMP WHERE ${this.primaryKey} = ?`
    );
    const info = stmt.run(id);
    return info.changes > 0;
  }

  delete(id) {
    return this.softDelete(id);
  }

  hardDelete(id) {
    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`);
    const info = stmt.run(id);
    return info.changes > 0;
  }

  markSynced(id, serverId) {
    const stmt = this.db.prepare(
      `UPDATE ${this.tableName} SET is_synced = 1, server_id = ?, updated_at = CURRENT_TIMESTAMP WHERE ${this.primaryKey} = ?`
    );
    const info = stmt.run(serverId, id);
    return info.changes > 0;
  }

  getUnsynced(entrepriseId, limit = 100) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE entrepriseId = ? AND is_deleted = 0 AND is_synced = 0
      ORDER BY created_at ASC
      LIMIT ?
    `);
    return stmt.all(entrepriseId, limit);
  }

  getDeletedUnsynced(entrepriseId, limit = 100) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE entrepriseId = ? AND is_deleted = 1 AND is_synced = 0
      ORDER BY updated_at ASC
      LIMIT ?
    `);
    return stmt.all(entrepriseId, limit);
  }

  search(searchTerm, columns, options = {}) {
    if (!searchTerm || !columns || !columns.length) return this.getAll(options);

    const whereClause = columns.map(c => `${c} LIKE ?`).join(' OR ');
    const searchParam = `%${searchTerm}%`;
    const params = columns.map(() => searchParam);

    return this.getAll({
      ...options,
      where: `(${whereClause})`,
      params
    });
  }

  rawQuery(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  transaction(callback) {
    const transaction = this.db.transaction(callback);
    return transaction();
  }
}

module.exports = BaseRepository;