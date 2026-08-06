const { initTestDb, resetData, closeDb } = require('../setup/dbHelper');

let stockCtrl, materielCtrl, repos;

beforeAll(() => { initTestDb(); });
afterAll(() => closeDb());
beforeEach(() => {
  resetData();
  repos = {
    articles: new (require('../../models/repositories/ArticleRepository'))(),
    fournisseurs: new (require('../../models/repositories/FournisseurRepository'))(),
    mouvements: new (require('../../models/repositories/MouvementStockRepository'))(),
    materiels: new (require('../../models/repositories/MaterielRepository'))(),
    maintenances: new (require('../../models/repositories/MaintenanceRepository'))()
  };
  stockCtrl = new (require('../../controllers/stockController'))(repos);
  materielCtrl = new (require('../../controllers/materielController'))(repos);
});

describe('StockController', () => {
  test('CRUD article + recherche', async () => {
    const c = await stockCtrl.createArticle({}, { nom: 'Ciment', quantiteStock: 0, categorie: 'Matériaux' }, 1);
    expect(c.success).toBe(true);
    expect((await stockCtrl.getListArticles({}, { entrepriseId: 1, search: 'ciment' })).data.items).toHaveLength(1);
    await stockCtrl.deleteArticle({}, c.data.id);
    expect((await stockCtrl.getListArticles({}, { entrepriseId: 1 })).data.items).toHaveLength(0);
  });

  test('updateStock + mouvements byArticle', async () => {
    const a = await stockCtrl.createArticle({}, { nom: 'Fer', quantiteStock: 10 }, 1);
    const upd = await stockCtrl.updateStockArticle({}, a.data.id, 20, 'entree', { motif: 'Livraison' });
    expect(upd.success).toBe(true);
    expect(upd.data.article.quantiteStock).toBe(30);
    const mvt = await stockCtrl.getMouvementsByArticle({}, a.data.id);
    expect(mvt.data).toHaveLength(1);
  });

  test('🔴 [BUG CONNU #1] getMouvementsByPeriode() devrait fonctionner', async () => {
    const a = await stockCtrl.createArticle({}, { nom: 'Bois', quantiteStock: 0 }, 1);
    await stockCtrl.updateStockArticle({}, a.data.id, 5, 'entree', {});
    const res = await stockCtrl.getMouvementsByPeriode({}, 1, '2026-01-01', '2026-12-31');
    // Le code actuel crash : getByPeriode n'existe pas dans le repository
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
  });

  test('getMouvementsStats fonctionne', async () => {
    const a = await stockCtrl.createArticle({}, { nom: 'Acier', quantiteStock: 0 }, 1);
    await stockCtrl.updateStockArticle({}, a.data.id, 15, 'entree', {});
    const stats = await stockCtrl.getMouvementsStats({}, 1, '2026-01-01', '2026-12-31');
    expect(stats.data.totalEntrees).toBe(15);
  });

  test('CRUD fournisseur', async () => {
    const f = await stockCtrl.createFournisseur({}, { nom: 'Holcim' }, 1);
    expect(f.success).toBe(true);
    expect((await stockCtrl.getListFournisseurs({}, { entrepriseId: 1 })).data.items).toHaveLength(1);
  });

  test('articles en alerte', async () => {
    await stockCtrl.createArticle({}, { nom: 'Stock bas', quantiteStock: 1, seuilAlerte: 10 }, 1);
    const res = await stockCtrl.getArticlesEnAlerte({}, 1);
    expect(res.data).toHaveLength(1);
  });
});

describe('MaterielController', () => {
  test('CRUD matériel + normalisation designation/nom', async () => {
    const m = await materielCtrl.createMateriel({}, { designation: 'Grue mobile' }, 1);
    expect(m.success).toBe(true);
    expect(m.data.nom).toBe('Grue mobile');
    expect(m.data.statut).toBe('disponible');

    const refus = await materielCtrl.createMateriel({}, {}, 1);
    expect(refus.success).toBe(false);
  });

  test('disponibles + stats', async () => {
    await materielCtrl.createMateriel({}, { nom: 'M1' }, 1);
    expect((await materielCtrl.getDisponibles({}, 1)).data).toHaveLength(1);
    const stats = await materielCtrl.getStatsMateriels({}, 1);
    expect(stats.data.total).toBe(1);
  });

  test('🔴 [BUG CONNU #4] getListMaintenances() doit filtrer par matériel', async () => {
    const m1 = await materielCtrl.createMateriel({}, { nom: 'Camion A' }, 1);
    const m2 = await materielCtrl.createMateriel({}, { nom: 'Camion B' }, 1);
    await materielCtrl.createMaintenance({}, { materielId: m1.data.id, type: 'preventive' });
    await materielCtrl.createMaintenance({}, { materielId: m2.data.id, type: 'corrective' });

    const res = await materielCtrl.getListMaintenances({}, { materielId: m1.data.id });
    // Le code actuel ignore materielId → renvoie toutes les maintenances
    expect(res.data.items).toHaveLength(1);
    expect(res.data.items[0].materielId).toBe(m1.data.id);
  });

  test('updateMaintenance fonctionne', async () => {
    const m = await materielCtrl.createMateriel({}, { nom: 'Niveleuse' }, 1);
    const mt = await materielCtrl.createMaintenance({}, { materielId: m.data.id, cout: 100 });
    const upd = await materielCtrl.updateMaintenance({}, mt.data.id, { cout: 250 });
    expect(upd.data.cout).toBe(250);
  });
});