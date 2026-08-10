// Desktop/models/repositories/ClientRepository.js
const db = require('../db');

class ClientRepository {
  /**
   * Helper pour obtenir la liste dynamique des colonnes réellement présentées dans la table Client
   */
  getTableColumns() {
    try {
      const columns = db.prepare(`PRAGMA table_info(Client)`).all();
      return columns.map(c => c.name);
    } catch (e) {
      console.error('ClientRepository.getTableColumns error:', e);
      return [];
    }
  }

  /**
   * Récupérer tous les clients
   */
  getAll({ entrepriseId, limit = 50, offset = 0 }) {
    try {
      const stmt = db.prepare(`
        SELECT c.*,
          u.nom as commercialNom,
          u.prenom as commercialPrenom
        FROM Client c
        LEFT JOIN Utilisateur u ON c.commercialId = u.id
        WHERE c.entrepriseId = ? AND c.is_deleted = 0
        ORDER BY c.nom ASC
        LIMIT ? OFFSET ?
      `);
      return stmt.all(entrepriseId, limit, offset) || [];
    } catch (e) {
      console.error('ClientRepository.getAll error:', e);
      return [];
    }
  }

  /**
   * Compter les clients d'une entreprise
   */
  count({ entrepriseId }) {
    try {
      const stmt = db.prepare(`
        SELECT COUNT(*) as total
        FROM Client
        WHERE entrepriseId = ? AND is_deleted = 0
      `);
      return stmt.get(entrepriseId)?.total || 0;
    } catch (e) {
      console.error('ClientRepository.count error:', e);
      return 0;
    }
  }

  /**
   * Recherche avec filtres et tri
   */
  searchWithFilters(entrepriseId, { search, type, tri, limit = 50, offset = 0 }) {
    try {
      let sql = `
        SELECT c.*,
          u.nom as commercialNom,
          u.prenom as commercialPrenom
        FROM Client c
        LEFT JOIN Utilisateur u ON c.commercialId = u.id
        WHERE c.entrepriseId = ? AND c.is_deleted = 0
      `;
      const params = [entrepriseId];

      if (search) {
        sql += ` AND (c.nom LIKE ? OR c.prenom LIKE ? OR c.entreprise LIKE ? OR c.email LIKE ? OR c.telephone LIKE ? OR c.siret LIKE ?)`;
        const term = `%${search}%`;
        params.push(term, term, term, term, term, term);
      }

      if (type) {
        sql += ` AND c.type = ?`;
        params.push(type);
      }

      // Tri
      if (tri === 'nom_desc') {
        sql += ` ORDER BY c.nom DESC, c.prenom DESC`;
      } else if (tri === 'dateCreation_desc') {
        sql += ` ORDER BY c.created_at DESC`;
      } else if (tri === 'ca_desc') {
        sql += ` ORDER BY c.caTotal DESC`;
      } else {
        sql += ` ORDER BY c.nom ASC, c.prenom ASC`;
      }

      sql += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const stmt = db.prepare(sql);
      return stmt.all(...params) || [];
    } catch (e) {
      console.error('ClientRepository.searchWithFilters error:', e);
      return [];
    }
  }

  /**
   * Compter avec filtres
   */
  countWithFilters(entrepriseId, { search, type }) {
    try {
      let sql = `SELECT COUNT(*) as total FROM Client c WHERE c.entrepriseId = ? AND c.is_deleted = 0`;
      const params = [entrepriseId];

      if (search) {
        sql += ` AND (c.nom LIKE ? OR c.prenom LIKE ? OR c.entreprise LIKE ? OR c.email LIKE ? OR c.telephone LIKE ? OR c.siret LIKE ?)`;
        const term = `%${search}%`;
        params.push(term, term, term, term, term, term);
      }

      if (type) {
        sql += ` AND c.type = ?`;
        params.push(type);
      }

      const stmt = db.prepare(sql);
      return stmt.get(...params)?.total || 0;
    } catch (e) {
      console.error('ClientRepository.countWithFilters error:', e);
      return 0;
    }
  }

  /**
   * Récupérer un client par son ID
   */
  getById(id) {
    try {
      const stmt = db.prepare(`SELECT * FROM Client WHERE id = ? AND is_deleted = 0`);
      return stmt.get(id) || null;
    } catch (e) {
      console.error('ClientRepository.getById error:', e);
      return null;
    }
  }

  /**
   * Récupérer un client avec ses relations
   */
  getWithRelations(id) {
    try {
      const stmt = db.prepare(`
        SELECT c.*,
          u.nom as commercialNom,
          u.prenom as commercialPrenom,
          u.email as commercialEmail
        FROM Client c
        LEFT JOIN Utilisateur u ON c.commercialId = u.id
        WHERE c.id = ? AND c.is_deleted = 0
      `);
      const row = stmt.get(id);
      if (!row) return null;

      if (row.commercialId) {
        row.commercial = {
          id: row.commercialId,
          nom: row.commercialNom,
          prenom: row.commercialPrenom,
          email: row.commercialEmail
        };
      } else {
        row.commercial = null;
      }

      try {
        const adrStmt = db.prepare(`
          SELECT * FROM ClientAdresse
          WHERE clientId = ? AND is_deleted = 0
          ORDER BY defaut DESC, id ASC
        `);
        row.adresses = adrStmt.all(id) || [];
      } catch (e) {
        row.adresses = [];
      }

      return row;
    } catch (e) {
      console.error('ClientRepository.getWithRelations error:', e);
      throw e;
    }
  }

  /**
   * Créer un nouveau client avec filtrage dynamique des colonnes
   */
  create(data, entrepriseId) {
    try {
      const existingCols = this.getTableColumns();
      const entId = entrepriseId || data.entrepriseId || 1;

      // Validation obligatoire
      if (!data.nom || !data.nom.trim()) {
        throw new Error('Le nom du client est obligatoire.');
      }

      // Unicité email (si fourni)
      if (data.email && data.email.trim()) {
        const existingEmail = db.prepare(
          `SELECT id FROM Client WHERE email = ? AND entrepriseId = ? AND is_deleted = 0`
        ).get(data.email.trim(), entId);
        if (existingEmail) {
          throw new Error('Un client avec cet email existe déjà.');
        }
      }

      // Unicité téléphone (si fourni)
      if (data.telephone && data.telephone.trim()) {
        const existingPhone = db.prepare(
          `SELECT id FROM Client WHERE telephone = ? AND entrepriseId = ? AND is_deleted = 0`
        ).get(data.telephone.trim(), entId);
        if (existingPhone) {
          throw new Error('Un client avec ce numéro de téléphone existe déjà.');
        }
      }

      const payload = {
        entrepriseId: entId,
        nom: data.nom || 'Sans nom',
        type: data.type || 'particulier',
        civilite: data.civilite || 'M.',
        prenom: data.prenom || '',
        entreprise: data.entreprise || '',
        siret: data.siret || '',
        numeroTVA: data.numeroTVA || '',
        adresse: data.adresse || '',
        codePostal: data.codePostal || '',
        ville: data.ville || '',
        telephone: data.telephone || '',
        portable: data.portable || '',
        email: data.email || '',
        siteWeb: data.siteWeb || '',
        notes: data.notes || '',
        conditionsPaiement: data.conditionsPaiement || 'Comptant',
        modePaiement: data.modePaiement || 'virement',
        encoursMax: parseFloat(data.encoursMax) || 0,
        commercialId: data.commercialId ? parseInt(data.commercialId) : null,
        origine: data.origine || '',
        rib: data.rib || ''
      };

      // Filtrer les colonnes pour n'insérer que celles présentes dans la table SQLite
      const safePayload = {};
      Object.keys(payload).forEach(key => {
        if (existingCols.length === 0 || existingCols.includes(key)) {
          safePayload[key] = payload[key];
        }
      });

      const keys = Object.keys(safePayload);
      const cols = keys.join(', ');
      const vals = keys.map(k => `@${k}`).join(', ');

      const stmt = db.prepare(`INSERT INTO Client (${cols}) VALUES (${vals})`);
      const info = stmt.run(safePayload);
      return this.getById(info.lastInsertRowid);
    } catch (e) {
      console.error('ClientRepository.create error:', e);
      throw e;
    }
  }

  /**
   * Mettre à jour un client avec filtrage dynamique des colonnes
   */
  update(id, data) {
    try {
      const existingCols = this.getTableColumns();
      const current = this.getById(id);

      // Unicité email (si modifié)
      if (data.email && data.email.trim() && data.email.trim() !== (current?.email || '')) {
        const existingEmail = db.prepare(
          `SELECT id FROM Client WHERE email = ? AND entrepriseId = ? AND is_deleted = 0 AND id != ?`
        ).get(data.email.trim(), current?.entrepriseId || 1, id);
        if (existingEmail) {
          throw new Error('Un client avec cet email existe déjà.');
        }
      }

      // Unicité téléphone (si modifié)
      if (data.telephone && data.telephone.trim() && data.telephone.trim() !== (current?.telephone || '')) {
        const existingPhone = db.prepare(
          `SELECT id FROM Client WHERE telephone = ? AND entrepriseId = ? AND is_deleted = 0 AND id != ?`
        ).get(data.telephone.trim(), current?.entrepriseId || 1, id);
        if (existingPhone) {
          throw new Error('Un client avec ce numéro de téléphone existe déjà.');
        }
      }

      const allowed = [
        'nom', 'type', 'civilite', 'prenom', 'entreprise', 'siret', 'numeroTVA',
        'adresse', 'codePostal', 'ville', 'telephone', 'portable', 'email', 'siteWeb',
        'notes', 'conditionsPaiement', 'modePaiement', 'encoursMax', 'commercialId',
        'origine', 'rib', 'caTotal', 'encoursActuel', 'dernierContact'
      ];

      const payload = {};
      allowed.forEach(key => {
        if (key in data && (existingCols.length === 0 || existingCols.includes(key))) {
          payload[key] = data[key];
        }
      });

      const fields = Object.keys(payload);
      if (fields.length === 0) return this.getById(id);

      const setClause = fields.map(f => `${f} = @${f}`).join(', ');
      const stmt = db.prepare(`UPDATE Client SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = @id AND is_deleted = 0`);
      stmt.run({ ...payload, id });
      return this.getById(id);
    } catch (e) {
      console.error('ClientRepository.update error:', e);
      throw e;
    }
  }

  /**
   * Suppression logique d'un client
   */
  softDelete(id) {
    try {
      const stmt = db.prepare(`UPDATE Client SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
      stmt.run(id);
      return { success: true };
    } catch (e) {
      console.error('ClientRepository.softDelete error:', e);
      throw e;
    }
  }
}

module.exports = ClientRepository;