const { initTestDb, resetData, closeDb, getDb } = require('../setup/dbHelper');

let depenses, alertes, dashboard, db;

beforeAll(() => { initTestDb(); db = getDb(); });
afterAll(() => closeDb());
beforeEach(() => {
  resetData();
  depenses = new (require('../../models/repositories/DepenseRepository'))();
  alertes = new (require('../../models/repositories/AlerteRepository'))();
  dashboard = new (require('../../models/repositories/DashboardRepository'))();
  // Chantier de travail
  const ChantierRepository = require('../../models/repositories/ChantierRepository');
  global.__chantierId = new ChantierRepository().createWithValidation({ nom: 'Chantier Finance' }, 1).id;
});

describe('DepenseRepository', () => {
  test('getByChantier() joint le valideur', () => {
    depenses.create({ chantierId: global.__chantierId, montant: 200, categorie: 'Matériaux', valideePar: 1 });
    const liste = depenses.getByChantier(global.__chantierId);
    expect(liste).toHaveLength(1);
    expect(liste[0].valideeParNom).toBe('Admin');
  });

  test('getTotalByChantier() somme les dépenses', () => {
    depenses.create({ chantierId: global.__chantierId, montant: 200 });
    depenses.create({ chantierId: global.__chantierId, montant: 300 });
    expect(depenses.getTotalByChantier(global.__chantierId)).toBe(500);
  });

  test('getByCategorie() groupe par catégorie', () => {
    depenses.create({ chantierId: global.__chantierId, montant: 100, categorie: 'Carburant' });
    depenses.create({ chantierId: global.__chantierId, montant: 400, categorie: 'Matériaux' });
    const parCat = depenses.getByCategorie(global.__chantierId);
    expect(parCat[0].categorie).toBe('Matériaux');
    expect(parCat[0].total).toBe(400);
  });

  test('getEnAttenteValidation() exclut les dépenses validées', () => {
    depenses.create({ chantierId: global.__chantierId, montant: 100, valideePar: null });
    depenses.create({ chantierId: global.__chantierId, montant: 100, valideePar: 1 });
    expect(depenses.getEnAttenteValidation(1)).toHaveLength(1);
  });
});

describe('AlerteRepository', () => {
  test('creer() + countNonLues() + marquerLue()', () => {
    alertes.creer({ entrepriseId: 1, message: 'Stock bas', niveauGravite: 'moyenne' });
    alertes.creer({ entrepriseId: 1, message: 'Facture en retard', niveauGravite: 'critique' });
    expect(alertes.countNonLues(1)).toBe(2);

    const nonLues = alertes.getNonLues(1);
    expect(nonLues[0].niveauGravite).toBe('critique'); // tri par gravité

    alertes.marquerLue(nonLues[0].id);
    expect(alertes.countNonLues(1)).toBe(1);

    alertes.marquerToutesLues(1);
    expect(alertes.countNonLues(1)).toBe(0);
  });
});

describe('DashboardRepository', () => {
  test('getStats() renvoie devise, KPIs chantiers et employés', () => {
    const stats = dashboard.getStats(1);
    expect(stats.devise).toBe('€');
    expect(stats.entrepriseNom).toBe('TIA Construction');
    expect(stats.chantiers.total).toBe(1);
    expect(stats.employes.total).toBe(0);
    expect(stats.alertesNonLues).toBe(0);
  });

  test('getStats() compte les factures en retard et le CA du mois', () => {
    const contrats = new (require('../../models/repositories/ContratRepository'))();
    const factures = new (require('../../models/repositories/FactureRepository'))();
    const contrat = contrats.create({ entrepriseId: 1, montant: 2000 }, 1);
    factures.create({
      entrepriseId: 1, contratId: contrat.id, montant: 2000,
      dateEmission: new Date().toISOString().split('T')[0],
      dateEcheance: '2026-07-01', statut: 'emis'
    }, 1);

    const stats = dashboard.getStats(1);
    expect(stats.caMois).toBe(2000);
    expect(stats.facturesRetard.count).toBe(1);
    expect(stats.facturesRetard.montantDu).toBe(2000);
  });

  test('🔴 [BUG CONNU #7] getStats() — la valeur stock doit refléter quantiteStock', () => {
    const articles = new (require('../../models/repositories/ArticleRepository'))();
    articles.create({ nom: 'Article X', quantiteStock: 10, prixUnitaire: 5 }, 1);
    const stats = dashboard.getStats(1);
    // COALESCE(stockActuel=0, quantiteStock) renvoie 0 actuellement au lieu de 50
    expect(stats.stocksValeur).toBe(50);
  });

  test('getCAEvolution() regroupe par mois', () => {
    const data = dashboard.getCAEvolution(1);
    expect(Array.isArray(data)).toBe(true);
  });

  test('getTopChantiersBudget() renvoie max 5 chantiers', () => {
    const ChantierRepository = require('../../models/repositories/ChantierRepository');
    const chr = new ChantierRepository();
    for (let i = 0; i < 7; i++) {
      chr.createWithValidation({ nom: `C${i}`, budgetPrevu: (i + 1) * 1000 }, 1);
    }
    const top = dashboard.getTopChantiersBudget(1);
    expect(top.length).toBeLessThanOrEqual(5);
    expect(top[0].budgetPrevisionnel).toBeGreaterThanOrEqual(top[top.length - 1].budgetPrevisionnel);
  });

  test('getActiviteRecente() fusionne chantiers, devis, incidents, factures', () => {
    const activite = dashboard.getActiviteRecente(1, 10);
    expect(activite.some(a => a.type === 'chantier')).toBe(true);
  });
});