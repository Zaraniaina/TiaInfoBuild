// Desktop/models/repositories/PaiementRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class PaiementRepository extends BaseRepository {
  constructor() {
    super('Paiement');
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