// Desktop/models/repositories/FactureRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class FactureRepository extends BaseRepository {
  constructor() {
    super('Facture');
  }

  /**
   * Récupérer une facture avec ses paiements
   * @param {number} id - ID facture
   * @returns {Object|null} - Facture avec paiements
   */
  getWithPaiements(id) {
    const facture = this.getById(id);
    if (!facture) return null;

    const paiements = db.prepare(`
      SELECT * FROM Paiement
      WHERE factureId = ? AND is_deleted = 0
      ORDER BY datePaiement DESC
    `).all(id);

    const totalPaye = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
    const resteAPayer = (facture.montant || 0) - totalPaye;

    // Contrat et chantier
    let contrat = null, chantier = null;
    if (facture.contratId) {
      contrat = db.prepare('SELECT * FROM Contrat WHERE id = ? AND is_deleted = 0').get(facture.contratId);
      if (contrat && contrat.chantierId) {
        chantier = db.prepare('SELECT * FROM Chantier WHERE id = ? AND is_deleted = 0').get(contrat.chantierId);
      }
    }

    return {
      ...facture,
      paiements,
      totalPaye,
      resteAPayer: Math.max(0, resteAPayer),
      estPayee: resteAPayer <= 0,
      contrat,
      chantier
    };
  }

  /**
   * Obtenir les factures en retard de paiement
   * @param {number} entrepriseId - ID entreprise
   * @returns {Array} - Factures échues non payées
   */
  getEnRetard(entrepriseId) {
    const today = new Date().toISOString().split('T')[0];
    const stmt = db.prepare(`
      SELECT f.*, c.nom as clientNom, co.montant as contratMontant
      FROM Facture f
      JOIN Contrat co ON f.contratId = co.id
      JOIN Devis d ON co.devisId = d.id
      JOIN Client c ON d.clientId = c.id
      WHERE d.entrepriseId = ? AND f.is_deleted = 0 AND co.is_deleted = 0 AND d.is_deleted = 0 AND c.is_deleted = 0
      AND f.dateEcheance < ? AND f.statut != 'paye'
      ORDER BY f.dateEcheance
    `);
    return stmt.all(entrepriseId, today);
  }

  /**
   * Enregistrer un paiement sur une facture
   * @param {number} factureId - ID facture
   * @param {Object} paiementData - { montant, modePaiement, datePaiement }
   * @returns {Object} - Facture mise à jour
   */
  ajouterPaiement(factureId, paiementData) {
    const facture = this.getWithPaiements(factureId);
    if (!facture) throw new Error('Facture non trouvée');

    const paiementRepo = require('./PaiementRepository');
    const paiement = new paiementRepo().create({
      factureId,
      montant: paiementData.montant,
      modePaiement: paiementData.modePaiement,
      datePaiement: paiementData.datePaiement || new Date().toISOString().split('T')[0]
    });

    // Mettre à jour le statut de la facture
    const nouveauTotalPaye = facture.totalPaye + (paiementData.montant || 0);
    let nouveauStatut = facture.statut;
    if (nouveauTotalPaye >= facture.montant) {
      nouveauStatut = 'paye';
    } else if (nouveauTotalPaye > 0) {
      nouveauStatut = 'partiellement_payee';
    }

    this.update(factureId, { statut: nouveauStatut, montantPaye: nouveauTotalPaye });

    return this.getWithPaiements(factureId);
  }
}

module.exports = FactureRepository;