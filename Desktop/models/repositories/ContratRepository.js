// Desktop/models/repositories/ContratRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class ContratRepository extends BaseRepository {
  constructor() {
    super('Contrat');
  }

  /**
   * Surchargé pour supporter le filtre par entrepriseId
   */
  getAll(options = {}) {
    const { entrepriseId, limit = 50, offset = 0, where = '', params = [] } = options;

    if (entrepriseId) {
      let sql = `
        SELECT co.*, d.numero as devisNumero, d.reference as devisReference,
               c.nom as chantierNom, cl.nom as clientNom, cl.entreprise as clientEntreprise,
               cl.prenom as clientPrenom, cl.type as clientType
        FROM Contrat co
        LEFT JOIN Devis d ON co.devisId = d.id AND d.is_deleted = 0
        LEFT JOIN Chantier c ON co.chantierId = c.id AND c.is_deleted = 0
        LEFT JOIN Client cl ON co.clientId = cl.id AND cl.is_deleted = 0
        WHERE (co.entrepriseId = ? OR d.entrepriseId = ? OR c.entrepriseId = ? OR cl.entrepriseId = ?)
        AND co.is_deleted = 0
      `;
      const allParams = [entrepriseId, entrepriseId, entrepriseId, entrepriseId, ...params];
      if (where) {
        sql += ` AND ${where}`;
      }
      sql += ` ORDER BY co.id DESC LIMIT ? OFFSET ?`;
      allParams.push(limit, offset);
      return db.prepare(sql).all(...allParams);
    }

    return super.getAll(options);
  }

  count(options = {}) {
    const { entrepriseId, where = '', params = [] } = options;

    if (entrepriseId) {
      let sql = `
        SELECT COUNT(*) as total
        FROM Contrat co
        LEFT JOIN Devis d ON co.devisId = d.id AND d.is_deleted = 0
        LEFT JOIN Chantier c ON co.chantierId = c.id AND c.is_deleted = 0
        LEFT JOIN Client cl ON co.clientId = cl.id AND cl.is_deleted = 0
        WHERE (co.entrepriseId = ? OR d.entrepriseId = ? OR c.entrepriseId = ? OR cl.entrepriseId = ?)
        AND co.is_deleted = 0
      `;
      const allParams = [entrepriseId, entrepriseId, entrepriseId, entrepriseId, ...params];
      if (where) {
        sql += ` AND ${where}`;
      }
      const result = db.prepare(sql).get(...allParams);
      return result?.total || 0;
    }

    return super.count(options);
  }

  getWithRelations(id) {
    const contrat = this.getById(id);
    if (!contrat) return null;

    const devis = contrat.devisId
      ? db.prepare('SELECT * FROM Devis WHERE id = ? AND is_deleted = 0').get(contrat.devisId)
      : null;

    const chantier = contrat.chantierId
      ? db.prepare('SELECT * FROM Chantier WHERE id = ? AND is_deleted = 0').get(contrat.chantierId)
      : null;

    const client = contrat.clientId
      ? db.prepare('SELECT * FROM Client WHERE id = ? AND is_deleted = 0').get(contrat.clientId)
      : null;

    const factures = db.prepare(`
      SELECT * FROM Facture WHERE contratId = ? AND is_deleted = 0
      ORDER BY dateEmission DESC
    `).all(id);

    return { ...contrat, devis, chantier, client, factures };
  }
}

module.exports = ContratRepository;