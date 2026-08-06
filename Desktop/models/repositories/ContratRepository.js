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
    const { entrepriseId, limit = 50, offset = 0 } = options;

    if (entrepriseId) {
      const sql = `
        SELECT co.*, d.numero as devisNumero, c.nom as chantierNom
        FROM Contrat co
        LEFT JOIN Devis d ON co.devisId = d.id AND d.is_deleted = 0
        LEFT JOIN Chantier c ON co.chantierId = c.id AND c.is_deleted = 0
        WHERE (co.entrepriseId = ? OR d.entrepriseId = ? OR c.entrepriseId = ?)
        AND co.is_deleted = 0
        ORDER BY co.id DESC
        LIMIT ? OFFSET ?
      `;
      return db.prepare(sql).all(entrepriseId, entrepriseId, entrepriseId, limit, offset);
    }

    return super.getAll(options);
  }

  count(options = {}) {
    const { entrepriseId } = options;

    if (entrepriseId) {
      const sql = `
        SELECT COUNT(*) as total
        FROM Contrat co
        LEFT JOIN Devis d ON co.devisId = d.id AND d.is_deleted = 0
        LEFT JOIN Chantier c ON co.chantierId = c.id AND c.is_deleted = 0
        WHERE (co.entrepriseId = ? OR d.entrepriseId = ? OR c.entrepriseId = ?)
        AND co.is_deleted = 0
      `;
      const result = db.prepare(sql).get(entrepriseId, entrepriseId, entrepriseId);
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

    const factures = db.prepare(`
      SELECT * FROM Facture WHERE contratId = ? AND is_deleted = 0
      ORDER BY dateEmission DESC
    `).all(id);

    return { ...contrat, devis, chantier, factures };
  }
}

module.exports = ContratRepository;