// Desktop/models/repositories/PaiementRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class PaiementRepository extends BaseRepository {
  constructor() {
    super('Paiement');
  }

  /**
   * Liste des paiements avec filtre entreprise
   */
  list(options = {}) {
    const { entrepriseId, factureId, limit = 50, offset = 0 } = options;
    let sql = `SELECT p.* FROM Paiement p`;
    const params = [];

    if (factureId) {
      sql += ` WHERE p.factureId = ? AND p.is_deleted = 0`;
      params.push(factureId);
    } else if (entrepriseId) {
      sql += ` JOIN Facture f ON p.factureId = f.id
              WHERE f.entrepriseId = ? AND p.is_deleted = 0`;
      params.push(entrepriseId);
    } else {
      sql += ` WHERE p.is_deleted = 0`;
    }

    sql += ` ORDER BY p.datePaiement DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return db.prepare(sql).all(...params);
  }

  /**
   * Récupérer les paiements d'une facture
   * @param {number} factureId - ID facture
   * @returns {Array} - Paiements
   */
  getByFacture(factureId) {
    const stmt = db.prepare(`
      SELECT * FROM Paiement
      WHERE factureId = ? AND is_deleted = 0
      ORDER BY datePaiement DESC
    `);
    return stmt.all(factureId);
  }

  /**
   * Total payé sur une facture
   * @param {number} factureId - ID facture
   * @returns {number} - Montant total payé
   */
  getTotalPaye(factureId) {
    const stmt = db.prepare(`
      SELECT SUM(montant) as total FROM Paiement
      WHERE factureId = ? AND is_deleted = 0
    `);
    const result = stmt.get(factureId);
    return result?.total || 0;
  }
}

module.exports = PaiementRepository;