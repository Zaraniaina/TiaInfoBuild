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
    const montantTotal = facture.montantTTC || facture.montant || 0;
    const resteAPayer = montantTotal - totalPaye;

    // Client - essayer d'abord avec clientId direct, sinon via contrat
    let client = null;
    if (facture.clientId) {
      client = db.prepare('SELECT * FROM Client WHERE id = ? AND is_deleted = 0').get(facture.clientId);
    }
    
    // Si pas de client trouvé et qu'il y a un contrat, essayer via le contrat
    if (!client && facture.contratId) {
      const contrat = db.prepare('SELECT * FROM Contrat WHERE id = ? AND is_deleted = 0').get(facture.contratId);
      if (contrat && contrat.clientId) {
        client = db.prepare('SELECT * FROM Client WHERE id = ? AND is_deleted = 0').get(contrat.clientId);
      }
    }

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
      client,
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
    const today = db.prepare("SELECT date('now', 'localtime') as today").get().today;
    const stmt = db.prepare(`
      SELECT f.*, 
             COALESCE(c.nom, cl.nom) as clientNom, 
             co.montant as contratMontant
      FROM Facture f
      LEFT JOIN Contrat co ON f.contratId = co.id AND co.is_deleted = 0
      LEFT JOIN Devis d ON co.devisId = d.id AND d.is_deleted = 0
      LEFT JOIN Client c ON d.clientId = c.id AND c.is_deleted = 0
      LEFT JOIN Client cl ON f.clientId = cl.id AND cl.is_deleted = 0
      WHERE f.entrepriseId = ? AND f.is_deleted = 0
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
      entrepriseId: facture.entrepriseId,
      montant: paiementData.montant,
      modePaiement: paiementData.modePaiement,
      datePaiement: paiementData.datePaiement || new Date().toISOString().split('T')[0],
      reference: paiementData.reference,
      banque: paiementData.banque,
      notes: paiementData.notes
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

  /**
   * Suppression logique d'une facture
   */
  delete(id) {
    return this.softDelete(id);
  }

  /**
   * Calculer le reste à payer d'une facture
   * @param {number} factureId - ID facture
   * @returns {number} - Montant restant dû
   */
  resteAPayer(factureId) {
    const facture = this.getById(factureId);
    if (!facture) return 0;
    const paiements = db.prepare(`
      SELECT COALESCE(SUM(montant), 0) as total FROM Paiement
      WHERE factureId = ? AND is_deleted = 0
    `).get(factureId);
    const totalPaye = paiements?.total || 0;
    return Math.max(0, (facture.montantTTC || facture.montant || 0) - totalPaye);
  }
}

module.exports = FactureRepository;