const BaseRepository = require('./BaseRepository');
const db = require('../db');

/**
 * RapportFinancierRepository
 * Exploite enfin la table RapportFinancier (CA, dépenses, marge par chantier)
 */
class RapportFinancierRepository extends BaseRepository {
  constructor() {
    super('RapportFinancier');
  }

  /**
   * Générer un rapport financier pour un chantier
   * CA = somme des factures des contrats liés au chantier
   * Dépenses = somme des dépenses du chantier
   * Marge = CA - Dépenses
   * @param {number} chantierId
   * @param {string} periode - ex: '2026-08'
   * @returns {Object} - Rapport créé
   */
  generer(chantierId, periode) {
    const chantier = db.prepare(
      'SELECT id, entrepriseId, nom FROM Chantier WHERE id = ? AND is_deleted = 0'
    ).get(chantierId);
    if (!chantier) throw new Error('Chantier introuvable');

    // Chiffre d'affaires : factures liées via les contrats du chantier
    const ca = db.prepare(`
      SELECT SUM(COALESCE(f.montantTTC, f.montant, 0)) as total
      FROM Facture f
      JOIN Contrat co ON f.contratId = co.id AND co.is_deleted = 0
      WHERE co.chantierId = ? AND f.is_deleted = 0
    `).get(chantierId);

    // Dépenses totales du chantier
    const depenses = db.prepare(`
      SELECT SUM(montant) as total FROM Depense
      WHERE chantierId = ? AND is_deleted = 0
    `).get(chantierId);

    const chiffreAffaires = ca?.total || 0;
    const depensesTotal = depenses?.total || 0;

    return this.create({
      chantierId,
      periode: periode || new Date().toISOString().slice(0, 7),
      chiffreAffaires,
      depensesTotal,
      marge: chiffreAffaires - depensesTotal,
      dateGeneration: new Date().toISOString()
    });
  }

  /**
   * Rapports d'un chantier
   * @param {number} chantierId
   * @returns {Array}
   */
  getByChantier(chantierId) {
    const stmt = db.prepare(`
      SELECT * FROM RapportFinancier
      WHERE chantierId = ? AND is_deleted = 0
      ORDER BY dateGeneration DESC
    `);
    return stmt.all(chantierId);
  }

  /**
   * Rapports d'une entreprise (via ses chantiers)
   * @param {number} entrepriseId
   * @returns {Array}
   */
  getByEntreprise(entrepriseId) {
    const stmt = db.prepare(`
      SELECT rf.*, c.nom as chantierNom
      FROM RapportFinancier rf
      JOIN Chantier c ON rf.chantierId = c.id AND c.is_deleted = 0
      WHERE c.entrepriseId = ? AND rf.is_deleted = 0
      ORDER BY rf.dateGeneration DESC
    `);
    return stmt.all(entrepriseId);
  }
}

module.exports = RapportFinancierRepository;