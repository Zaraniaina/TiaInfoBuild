// Desktop/models/repositories/FournisseurRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class FournisseurRepository extends BaseRepository {
  constructor() {
    super('Fournisseur');
  }

  /**
   * Récupérer les fournisseurs d'une entreprise
   * @param {number} entrepriseId - ID entreprise
   * @param {Object} options - { limit, offset, search }
   * @returns {Array} - Fournisseurs
   */
  getByEntreprise(entrepriseId, options = {}) {
    const { limit = 50, offset = 0, search } = options;
    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = ' AND (nom LIKE ? OR contact LIKE ? OR email LIKE ? OR telephone LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    const sql = `
      SELECT f.*,
        (SELECT COUNT(*) FROM MouvementStock ms WHERE ms.fournisseurId = f.id AND ms.is_deleted = 0) as nbCommandes
      FROM Fournisseur f
      WHERE f.entrepriseId = ? AND f.is_deleted = 0
      ${whereClause}
      ORDER BY f.nom
      LIMIT ? OFFSET ?
    `;
    const stmt = db.prepare(sql);
    return stmt.all(entrepriseId, ...params, limit, offset);
  }

  /**
   * Rechercher des fournisseurs
   * @param {string} query - Terme de recherche
   * @param {Array} fields - Champs à rechercher
   * @param {Object} options - { entrepriseId, limit, offset }
   * @returns {Array} - Résultats
   */
  search(query, fields = ['nom', 'contact', 'email', 'telephone'], options = {}) {
    const { entrepriseId, limit = 20, offset = 0 } = options;
    const conditions = fields.map(f => `${f} LIKE ?`).join(' OR ');
    const searchParam = `%${query}%`;
    const params = fields.map(() => searchParam);

    const sql = `
      SELECT * FROM Fournisseur
      WHERE entrepriseId = ? AND is_deleted = 0
      AND (${conditions})
      ORDER BY nom
      LIMIT ? OFFSET ?
    `;
    const stmt = db.prepare(sql);
    return stmt.all(entrepriseId, ...params, limit, offset);
  }

  /**
   * Créer un fournisseur avec validation
   * @param {Object} data - Données fournisseur
   * @param {number} entrepriseId - ID entreprise
   * @returns {Object} - Fournisseur créé
   */
  createWithValidation(data, entrepriseId) {
    // Validation basique
    if (!data.nom || !data.nom.trim()) {
      throw new Error('Le nom du fournisseur est obligatoire');
    }

    // Unicité email (si fourni)
    if (data.email && data.email.trim()) {
      const existingEmail = db.prepare(
        `SELECT id FROM Fournisseur WHERE email = ? AND entrepriseId = ? AND is_deleted = 0`
      ).get(data.email.trim(), entrepriseId);
      if (existingEmail) {
        throw new Error('Un fournisseur avec cet email existe déjà.');
      }
    }

    // Unicité téléphone (si fourni)
    if (data.telephone && data.telephone.trim()) {
      const existingPhone = db.prepare(
        `SELECT id FROM Fournisseur WHERE telephone = ? AND entrepriseId = ? AND is_deleted = 0`
      ).get(data.telephone.trim(), entrepriseId);
      if (existingPhone) {
        throw new Error('Un fournisseur avec ce numéro de téléphone existe déjà.');
      }
    }

    return this.create({
      ...data,
      entrepriseId,
      nom: data.nom.trim(),
      contact: data.contact?.trim() || '',
      email: data.email?.trim() || '',
      telephone: data.telephone?.trim() || '',
      adresse: data.adresse?.trim() || '',
      siret: data.siret?.trim() || '',
      conditionsPaiement: data.conditionsPaiement || '30 jours',
      notes: data.notes?.trim() || ''
    }, entrepriseId);
  }

  /**
   * Mettre à jour un fournisseur avec validation
   * @param {number} id - ID fournisseur
   * @param {Object} data - Données à mettre à jour
   * @returns {Object} - Fournisseur mis à jour
   */
  updateWithValidation(id, data) {
    const current = this.getById(id);
    if (!current) throw new Error('Fournisseur introuvable.');

    // Unicité email (si modifié)
    if (data.email && data.email.trim() && data.email.trim() !== (current.email || '')) {
      const existingEmail = db.prepare(
        `SELECT id FROM Fournisseur WHERE email = ? AND entrepriseId = ? AND is_deleted = 0 AND id != ?`
      ).get(data.email.trim(), current.entrepriseId, id);
      if (existingEmail) {
        throw new Error('Un fournisseur avec cet email existe déjà.');
      }
    }

    // Unicité téléphone (si modifié)
    if (data.telephone && data.telephone.trim() && data.telephone.trim() !== (current.telephone || '')) {
      const existingPhone = db.prepare(
        `SELECT id FROM Fournisseur WHERE telephone = ? AND entrepriseId = ? AND is_deleted = 0 AND id != ?`
      ).get(data.telephone.trim(), current.entrepriseId, id);
      if (existingPhone) {
        throw new Error('Un fournisseur avec ce numéro de téléphone existe déjà.');
      }
    }

    return this.update(id, data);
  }

  /**
   * Fournisseurs avec stats (pour dashboard)
   * @param {number} entrepriseId - ID entreprise
   * @returns {Array} - Top fournisseurs
   */
  getTopFournisseurs(entrepriseId) {
    const stmt = db.prepare(`
      SELECT f.*,
        COUNT(ms.id) as nbCommandes,
        SUM(ms.quantite * ms.prixUnitaire) as montantTotal
      FROM Fournisseur f
      LEFT JOIN MouvementStock ms ON f.id = ms.fournisseurId AND ms.is_deleted = 0 AND ms.typeMouvement = 'entree'
      WHERE f.entrepriseId = ? AND f.is_deleted = 0
      GROUP BY f.id
      ORDER BY montantTotal DESC
      LIMIT 10
    `);
    return stmt.all(entrepriseId);
  }
}

module.exports = FournisseurRepository;