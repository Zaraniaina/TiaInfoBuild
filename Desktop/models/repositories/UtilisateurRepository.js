const BaseRepository = require('./BaseRepository');
const db = require('../db');
const bcrypt = require('bcryptjs');

class UtilisateurRepository extends BaseRepository {
  constructor() {
    super('Utilisateur');
  }

  /**
   * Récupérer la liste des utilisateurs avec leur rôle
   */
  getListWithRole(options = {}) {
    const { entrepriseId, limit = 50, offset = 0, search } = options;
    let whereClause = '';
    const params = [];

    if (search) {
      whereClause += ' AND (u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    let tenantWhere = this._entrepriseWhere(entrepriseId, 'u');
    if (whereClause) {
      tenantWhere += whereClause;
    }

    const sql = `
      SELECT u.id, u.server_id, u.entrepriseId, u.roleId, u.nom, u.prenom, u.email,
        u.telephone, u.statut, u.dateCreation, u.derniereConnexion, u.is_synced,
        r.nom as roleNom, r.code as roleCode
      FROM Utilisateur u
      LEFT JOIN Role r ON u.roleId = r.id AND r.is_deleted = 0
      ${tenantWhere}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const stmt = db.prepare(sql);
    return stmt.all(...params, limit, offset);
  }

  /**
   * Récupérer un utilisateur par ID avec son rôle
   */
  getWithRelations(id) {
    const user = db.prepare(`
      SELECT u.id, u.server_id, u.entrepriseId, u.roleId, u.nom, u.prenom, u.email,
        u.telephone, u.statut, u.dateCreation, u.derniereConnexion, u.is_synced,
        r.nom as roleNom, r.code as roleCode
      FROM Utilisateur u
      LEFT JOIN Role r ON u.roleId = r.id AND r.is_deleted = 0
      WHERE u.id = ? AND u.is_deleted = 0
    `).get(id);
    return user || null;
  }

  /**
   * Créer un utilisateur avec hachage sécurisé du mot de passe
   */
  createUser(data, entrepriseId) {
    if (!data.email || !data.email.trim()) {
      throw new Error("L'email est obligatoire.");
    }
    if (!data.nom || !data.nom.trim()) {
      throw new Error("Le nom est obligatoire.");
    }

    const existing = db.prepare(`SELECT id FROM Utilisateur WHERE email = ? AND is_deleted = 0`).get(data.email.trim());
    if (existing) {
      throw new Error("Un utilisateur avec cet email existe déjà.");
    }

    let pwdHash = '';
    if (data.password || data.motDePasse) {
      const pwd = data.password || data.motDePasse;
      pwdHash = bcrypt.hashSync(pwd, 10);
    }

    const userData = {
      entrepriseId: entrepriseId || data.entrepriseId || 1,
      roleId: data.roleId || 1,
      nom: data.nom.trim(),
      prenom: data.prenom?.trim() || '',
      email: data.email.trim(),
      motDePasseHash: pwdHash,
      telephone: data.telephone?.trim() || '',
      statut: data.statut || 'actif',
      is_synced: 0
    };

    return this.create(userData, entrepriseId);
  }

  /**
   * Mettre à jour un utilisateur
   */
  updateUser(id, data) {
    const payload = { ...data };

    if (data.password || data.motDePasse) {
      const pwd = data.password || data.motDePasse;
      payload.motDePasseHash = bcrypt.hashSync(pwd, 10);
      delete payload.password;
      delete payload.motDePasse;
    }

    return this.update(id, payload);
  }
}

module.exports = UtilisateurRepository;