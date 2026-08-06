const { initTestDb, resetData, closeDb, getDb } = require('../setup/dbHelper');

let articles, mouvements, fournisseurs, db;

beforeAll(() => { initTestDb(); db = getDb(); });
afterAll(() => closeDb());
beforeEach(() => {
  resetData();
  articles = new (require('../../models/repositories/ArticleRepository'))();
  mouvements = new (require('../../models/repositories/MouvementStockRepository'))();
  fournisseurs = new (require('../../models/repositories/FournisseurRepository'))();
});

describe('ArticleRepository — gestion de stock', () => {
  test('updateStock() entrée incrémente le stock et crée un mouvement', () => {
    const a = articles.create({ nom: 'Ciment', quantiteStock: 10, unite: 'sac' }, 1);
    const { article, mouvement } = articles.updateStock(a.id, 40, 'entree', { motif: 'Livraison' });
    expect(article.quantiteStock).toBe(50);
    expect(mouvement.typeMouvement).toBe('entree');
    expect(mouvement.quantite).toBe(40);
  });

  test('updateStock() sortie décrémente le stock', () => {
    const a = articles.create({ nom: 'Fer', quantiteStock: 100 }, 1);
    const { article } = articles.updateStock(a.id, 30, 'sortie', {});
    expect(article.quantiteStock).toBe(70);
  });

  test('updateStock() refuse une sortie supérieure au stock', () => {
    const a = articles.create({ nom: 'Sable', quantiteStock: 5 }, 1);
    expect(() => articles.updateStock(a.id, 10, 'sortie', {}))
      .toThrow('Stock insuffisant');
  });

  test('updateStock() rejette un type de mouvement invalide', () => {
    const a = articles.create({ nom: 'Gravier', quantiteStock: 5 }, 1);
    expect(() => articles.updateStock(a.id, 1, 'transfert', {})).toThrow();
  });

  test('🔴 [BUG CONNU #7] updateStock() devrait aussi mettre à jour stockActuel (lu par le dashboard)', () => {
    const a = articles.create({ nom: 'Peinture', quantiteStock: 10 }, 1);
    articles.updateStock(a.id, 5, 'entree', {});
    const article = articles.getById(a.id);
    // Le dashboard lit COALESCE(stockActuel, quantiteStock) → les deux doivent être cohérents
    expect(article.stockActuel).toBe(article.quantiteStock);
  });

  test('getEnAlerte() liste les articles sous le seuil', () => {
    articles.create({ nom: 'Stock bas', quantiteStock: 2, seuilAlerte: 5 }, 1);
    articles.create({ nom: 'Stock ok', quantiteStock: 50, seuilAlerte: 5 }, 1);
    const alerte = articles.getEnAlerte(1);
    expect(alerte).toHaveLength(1);
    expect(alerte[0].nom).toBe('Stock bas');
  });

  test('getDashboardStats() calcule valeur stock et mouvements du mois', () => {
    const a = articles.create({ nom: 'Brique', quantiteStock: 100, prixUnitaire: 2 }, 1);
    articles.updateStock(a.id, 10, 'entree', {});
    const stats = articles.getDashboardStats(1);
    expect(stats.totalArticles).toBe(1);
    expect(stats.valeurStock).toBe(220); // 110 × 2
    expect(stats.mouvementsMois.entrees).toBe(10);
  });
});

describe('MouvementStockRepository', () => {
  test('getByArticle() renvoie l\'historique', () => {
    const a = articles.create({ nom: 'Tube PVC', quantiteStock: 0 }, 1);
    articles.updateStock(a.id, 20, 'entree', {});
    articles.updateStock(a.id, 5, 'sortie', {});
    expect(mouvements.getByArticle(a.id)).toHaveLength(2);
  });

  test('getByChantier() ne renvoie que les sorties', () => {
    const ChantierRepository = require('../../models/repositories/ChantierRepository');
    const c = new ChantierRepository().createWithValidation({ nom: 'Chantier X' }, 1);
    const a = articles.create({ nom: 'Câble', quantiteStock: 100 }, 1);
    articles.updateStock(a.id, 10, 'sortie', { chantierId: c.id });
    expect(mouvements.getByChantier(c.id)).toHaveLength(1);
    expect(mouvements.getByChantier(c.id)[0].articleNom).toBe('Câble');
  });

  test('getStatsPeriode() totalise entrées/sorties', () => {
    const a = articles.create({ nom: 'Bois', quantiteStock: 0 }, 1);
    articles.updateStock(a.id, 30, 'entree', {});
    articles.updateStock(a.id, 12, 'sortie', {});
    const stats = mouvements.getStatsPeriode(1, '2026-01-01', '2026-12-31');
    expect(stats.totalEntrees).toBe(30);
    expect(stats.totalSorties).toBe(12);
    expect(stats.nbMouvements).toBe(2);
  });

  test('🔴 [BUG CONNU #1] getByPeriode() devrait exister (crash de la vue Mouvements)', () => {
    expect(typeof mouvements.getByPeriode).toBe('function');
  });
});

describe('FournisseurRepository', () => {
  test('createWithValidation() exige le nom et normalise', () => {
    expect(() => fournisseurs.createWithValidation({}, 1)).toThrow('obligatoire');
    const f = fournisseurs.createWithValidation({ nom: '  BTP Materials  ' }, 1);
    expect(f.nom).toBe('BTP Materials');
    expect(f.conditionsPaiement).toBe('30 jours');
  });

  test('getByEntreprise() filtre par recherche', () => {
    fournisseurs.create({ nom: 'Holcim' }, 1);
    fournisseurs.create({ nom: 'Autre SARL' }, 1);
    expect(fournisseurs.getByEntreprise(1, { search: 'holcim' })).toHaveLength(1);
  });
});