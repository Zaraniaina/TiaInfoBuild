const BaseRepository = require('./BaseRepository');
const db = require('../db');

class FactureRepository extends BaseRepository {
  constructor() {
    super('Facture');
  }

  create(data, entrepriseId = null) {
    const payload = { ...data };
    const entId = payload.entrepriseId || entrepriseId;

    if (entId && !payload.dateEcheance) {
      const ent = db.prepare('SELECT delaiPaiementDefaut FROM Entreprise WHERE id = ?').get(entId);
      const jours = parseInt(ent?.delaiPaiementDefaut, 10) || 30;
      const emission = payload.dateEmission ? new Date(payload.dateEmission) : new Date();
      emission.setDate(emission.getDate() + jours);
      payload.dateEcheance = emission.toISOString().split('T')[0];
    }
    if (!payload.dateEmission) payload.dateEmission = new Date().toISOString().split('T')[0];

    const facture = super.create(payload, entrepriseId);
    if (facture && !facture.numero) {
      const ent = db.prepare('SELECT prefixeFacture FROM Entreprise WHERE id = ?').get(facture.entrepriseId);
      const prefixe = ent?.prefixeFacture || 'FAC';
      const numero = `${prefixe}-${new Date().getFullYear()}-${String(facture.id).padStart(4, '0')}`;
      return this.update(facture.id, { numero });
    }
    return facture;
  }

  getWithPaiements(id) {
    const facture = this.getById(id);
    if (!facture) return null;
    const paiements = db.prepare(`SELECT * FROM Paiement WHERE factureId = ? AND is_deleted = 0 ORDER BY datePaiement DESC`).all(id);
    const totalPaye = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
    const resteAPayer = (facture.montant || 0) - totalPaye;

    let contrat = null, chantier = null;
    if (facture.contratId) {
      contrat = db.prepare('SELECT * FROM Contrat WHERE id = ? AND is_deleted = 0').get(facture.contratId);
      if (contrat && contrat.chantierId) {
        chantier = db.prepare('SELECT * FROM Chantier WHERE id = ? AND is_deleted = 0').get(contrat.chantierId);
      }
    }

    return {
      ...facture, paiements, totalPaye,
      resteAPayer: Math.max(0, resteAPayer),
      estPayee: resteAPayer <= 0,
      contrat, chantier
    };
  }

  getEnRetard(entrepriseId) {
    const today = new Date().toISOString().split('T')[0];
    const stmt = db.prepare(`
      SELECT f.*, co.montant AS contratMontant, cl.nom AS clientNom
      FROM Facture f
      LEFT JOIN Contrat co ON f.contratId = co.id AND co.is_deleted = 0
      LEFT JOIN Devis d ON co.devisId = d.id AND d.is_deleted = 0
      LEFT JOIN Client cl ON d.clientId = cl.id AND cl.is_deleted = 0
      WHERE f.entrepriseId = ? AND f.is_deleted = 0
        AND f.dateEcheance IS NOT NULL AND f.dateEcheance < ?
        AND f.statut NOT IN ('paye', 'payee', 'annulee')
      ORDER BY f.dateEcheance
    `);
    return stmt.all(entrepriseId, today);
  }

  ajouterPaiement(factureId, paiementData) {
    const facture = this.getWithPaiements(factureId);
    if (!facture) throw new Error('Facture non trouvée');

    const montant = parseFloat(paiementData.montant);
    if (!montant || montant <= 0) throw new Error('Le montant du paiement doit être supérieur à 0');

    // ⚠️ CORRECTION CRITIQUE : Instanciation correcte de la classe
    const PaiementRepository = require('./PaiementRepository');
    const paiementRepo = new PaiementRepository();
    
    paiementRepo.create({
      factureId,
      montant,
      modePaiement: paiementData.modePaiement,
      datePaiement: paiementData.datePaiement || new Date().toISOString().split('T')[0]
    });

    const nouveauTotalPaye = facture.totalPaye + montant;
    let nouveauStatut = facture.statut;
    if (nouveauTotalPaye >= facture.montant) {
      nouveauStatut = 'paye';
    } else if (nouveauTotalPaye > 0) {
      nouveauStatut = 'partiellement_payee'; // Cohérent avec le dashboard
    }

    this.update(factureId, {
      statut: nouveauStatut,
      montantPaye: Math.min(nouveauTotalPaye, facture.montant || 0)
    });

    return this.getWithPaiements(factureId);
  }
}

module.exports = FactureRepository;