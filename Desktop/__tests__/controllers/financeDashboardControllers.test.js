const { initTestDb, resetData, closeDb } = require('../setup/dbHelper');

let financeCtrl, dashboardCtrl, repos;

beforeAll(() => { initTestDb(); });
afterAll(() => closeDb());
beforeEach(() => {
  resetData();
  repos = {
    depenses: new (require('../../models/repositories/DepenseRepository'))(),
    alertes: new (require('../../models/repositories/AlerteRepository'))(),
    dashboard: new (require('../../models/repositories/DashboardRepository'))()
  };
  financeCtrl = new (require('../../controllers/financeController'))(repos);
  dashboardCtrl = new (require('../../controllers/dashboardController'))(repos);
});

describe('FinanceController — Dépenses', () => {
  test('getDepensesByChantier + total + catégories', async () => {
    const ChantierRepository = require('../../models/repositories/ChantierRepository');
    const c = new ChantierRepository().createWithValidation({ nom: 'Chantier F' }, 1);
    repos.depenses.create({ chantierId: c.id, montant: 100, categorie: 'A' });
    repos.depenses.create({ chantierId: c.id, montant: 200, categorie: 'B' });

    expect((await financeCtrl.getDepensesByChantier({}, c.id)).data).toHaveLength(2);
    expect((await financeCtrl.getTotalDepensesByChantier({}, c.id)).data).toBe(300);
    expect((await financeCtrl.getDepensesByCategorie({}, c.id)).data).toHaveLength(2);
  });

  test('🔴 [BUG CONNU #5] createDepense() devrait exister (Finance en lecture seule)', async () => {
    // Le contrôleur actuel n'a AUCUNE méthode de création de dépense
    expect(typeof financeCtrl.createDepense).toBe('function');
  });

  test('🔴 [BUG CONNU #5] validerDepense() devrait exister', async () => {
    expect(typeof financeCtrl.validerDepense).toBe('function');
  });
});

describe('FinanceController — Rapports financiers', () => {
  test('🔴 [MANQUANT #12] genererRapportFinancier() devrait exister', async () => {
    expect(typeof financeCtrl.genererRapportFinancier).toBe('function');
  });
});

describe('FinanceController — Alertes', () => {
  test('cycle complet des alertes', async () => {
    await financeCtrl.creerAlerte({}, { entrepriseId: 1, message: 'Test alerte', niveauGravite: 'info' });
    expect((await financeCtrl.countAlertesNonLues({}, 1)).data).toBe(1);

    const nonLues = await financeCtrl.getAlertesNonLues({}, 1);
    await financeCtrl.marquerAlerteLue({}, nonLues.data[0].id);
    expect((await financeCtrl.countAlertesNonLues({}, 1)).data).toBe(0);

    await financeCtrl.creerAlerte({}, { entrepriseId: 1, message: 'Autre' });
    await financeCtrl.marquerToutesAlertesLues({}, 1);
    expect((await financeCtrl.countAlertesNonLues({}, 1)).data).toBe(0);
  });
});

describe('DashboardController', () => {
  test('getDashboardStats renvoie les KPIs', async () => {
    const res = await dashboardCtrl.getDashboardStats({}, 1);
    expect(res.success).toBe(true);
    expect(res.data.devise).toBe('€');
    expect(res.data.chantiers).toBeDefined();
  });

  test('getCAEvolution / topChantiers / activiteRecente', async () => {
    expect((await dashboardCtrl.getCAEvolution({}, 1)).success).toBe(true);
    expect((await dashboardCtrl.getTopChantiersBudget({}, 1)).success).toBe(true);
    expect((await dashboardCtrl.getActiviteRecente({}, 1, 5)).success).toBe(true);
  });
});