const { initTestDb, resetData, closeDb, getDb } = require('../setup/dbHelper');

let clients, devis, contrats, factures, paiements, db;

beforeAll(() => { initTestDb(); db = getDb(); });
afterAll(() => closeDb());
beforeEach(() => {
  resetData();
  clients = new (require('../../models/repositories/ClientRepository'))();
  devis = new (require('../../models/repositories/DevisRepository'))();
  contrats = new (require('../../models/repositories/ContratRepository'))();
  factures = new (require('../../models/repositories/FactureRepository'))();
  paiements = new (require('../../models/repositories/PaiementRepository'))();
});

const creerClient = (nom = 'Client Test') => clients.create({ nom }, 1);

describe('ClientRepository', () => {
  test('search() cherche sur nom/email/téléphone', () => {
    creerClient('Mairie Antananarivo');
    creerClient('Société XYZ');
    expect(clients.search(1, 'mairie')).toHaveLength(1);
  });

  test('getWithRelations() agrège chantiers et devis', () => {
    const c = creerClient();
    const d = devis.createWithLignes({
      clientId: c.id,
      lignes: [{ description: 'Travaux', quantite: 1, prixUnitaire: 100 }]
    }, 1);
    const detail = clients.getWithRelations(c.id);
    expect(detail.devis).toHaveLength(1);
    expect(detail.chantiers).toHaveLength(0);
  });
});

describe('DevisRepository', () => {
  test('createWithLignes() calcule le montant total', () => {
    const c = creerClient();
    const d = devis.createWithLignes({
      clientId: c.id,
      lignes: [
        { description: 'Béton', quantite: 10, prixUnitaire: 50 },
        { description: 'Main oeuvre', quantite: 5, prixUnitaire: 200 }
      ]
    }, 1);
    expect(d.montantTotal).toBe(1500);
    expect(d.lignes).toHaveLength(2);
    expect(d.statut).toBe('brouillon');
  });

  test('transformerEnContrat() exige un devis accepté', () => {
    const c = creerClient();
    const d = devis.createWithLignes({
      clientId: c.id,
      lignes: [{ description: 'X', quantite: 1, prixUnitaire: 100 }]
    }, 1);
    expect(() => devis.transformerEnContrat(d.id, {})).toThrow('doit être accepté');

    devis.update(d.id, { statut: 'accepte' });
    const contrat = devis.transformerEnContrat(d.id, { entrepriseId: 1 });
    expect(contrat.montant).toBe(100);
    expect(contrat.statut).toBe('en_cours');
    expect(contrat.devisId).toBe(d.id);
  });
});

describe('FactureRepository', () => {
  const creerFacture = (opts = {}) => {
    const c = creerClient();
    const contrat = contrats.create({ entrepriseId: 1, montant: 1000, devisId: null }, 1);
    return factures.create({
      entrepriseId: 1,
      contratId: contrat.id,
      montant: opts.montant || 1000,
      dateEcheance: opts.dateEcheance || '2026-08-01',
      statut: opts.statut || 'emis'
    }, 1);
  };

  test('getWithPaiements() calcule totalPaye et resteAPayer', () => {
    const f = creerFacture();
    paiements.create({ factureId: f.id, montant: 400 });
    const detail = factures.getWithPaiements(f.id);
    expect(detail.totalPaye).toBe(400);
    expect(detail.resteAPayer).toBe(600);
    expect(detail.estPayee).toBe(false);
  });

  test('ajouterPaiement() passe la facture à "paye" si total atteint', () => {
    const f = creerFacture();
    const maj = factures.ajouterPaiement(f.id, { montant: 1000, modePaiement: 'virement' });
    expect(maj.statut).toBe('paye');
    expect(maj.estPayee).toBe(true);
  });

  test('🔴 [BUG CONNU #18] ajouterPaiement() partiel devrait utiliser "partiellement_payee" (cohérence dashboard)', () => {
    const f = creerFacture();
    const maj = factures.ajouterPaiement(f.id, { montant: 300 });
    // Le code actuel écrit 'partiel', le dashboard attend 'partiellement_payee'
    expect(maj.statut).toBe('partiellement_payee');
  });

  test('getEnRetard() liste les factures échues non payées (chaîne devis complète)', () => {
    const c = creerClient();
    const d = devis.createWithLignes({
      clientId: c.id,
      lignes: [{ description: 'X', quantite: 1, prixUnitaire: 500 }]
    }, 1);
    devis.update(d.id, { statut: 'accepte' });
    const contrat = devis.transformerEnContrat(d.id, { entrepriseId: 1 });
    factures.create({
      entrepriseId: 1, contratId: contrat.id, montant: 500,
      dateEcheance: '2026-07-01', statut: 'emis'
    }, 1);

    const retard = factures.getEnRetard(1);
    expect(retard).toHaveLength(1);
    expect(retard[0].clientNom).toBe('Client Test');
  });

  test('🔴 [BUG CONNU #9] getEnRetard() ne doit PAS exclure les factures des contrats sans devis', () => {
    creerFacture({ dateEcheance: '2026-07-01', statut: 'emis' }); // contrat sans devis
    // Le INNER JOIN Devis actuel exclut cette facture du résultat
    expect(factures.getEnRetard(1)).toHaveLength(1);
  });

  test('getByFacture() liste les paiements d\'une facture', () => {
    const f = creerFacture();
    paiements.create({ factureId: f.id, montant: 100 });
    paiements.create({ factureId: f.id, montant: 200 });
    expect(paiements.getByFacture(f.id)).toHaveLength(2);
    expect(paiements.getTotalPaye(f.id)).toBe(300);
  });
});