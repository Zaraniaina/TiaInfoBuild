const { initTestDb, resetData, closeDb, getDb } = require('../setup/dbHelper');

let chantiers, db;

beforeAll(() => { initTestDb(); db = getDb(); });
afterAll(() => closeDb());
beforeEach(() => {
  resetData();
  const ChantierRepository = require('../../models/repositories/ChantierRepository');
  chantiers = new ChantierRepository();
});

describe('ChantierRepository', () => {
  test('createWithValidation() exige un nom', () => {
    expect(() => chantiers.createWithValidation({}, 1))
      .toThrow('Le nom du chantier est obligatoire');
  });

  test('createWithValidation() refuse les doublons par entreprise', () => {
    chantiers.createWithValidation({ nom: 'Route RN1' }, 1);
    expect(() => chantiers.createWithValidation({ nom: 'Route RN1' }, 1))
      .toThrow('existe déjà');
  });

  test('createWithValidation() normalise le budget et le statut par défaut', () => {
    const c = chantiers.createWithValidation({ nom: 'Pont', budgetPrevu: '15000' }, 1);
    expect(c.budgetPrevisionnel).toBe(15000);
    expect(c.budgetPrevu).toBe(15000);
    expect(c.statut).toBe('planification');
  });

  test('getListWithStats() renvoie clientNom, chefNom et compteurs', () => {
    const client = db.prepare(`INSERT INTO Client (entrepriseId, nom, is_synced) VALUES (1, 'Mairie', 0)`).run();
    chantiers.createWithValidation({ nom: 'École', clientId: client.lastInsertRowid, chefChantierId: 1 }, 1);

    const liste = chantiers.getListWithStats({ entrepriseId: 1 });
    expect(liste).toHaveLength(1);
    expect(liste[0].clientNom).toBe('Mairie');
    expect(liste[0].chefNom).toBe('Admin');
    expect(liste[0].nbPhases).toBe(0);
  });

  test('getListWithStats() filtre par statut et recherche', () => {
    chantiers.createWithValidation({ nom: 'Alpha', statut: 'actif' }, 1);
    chantiers.createWithValidation({ nom: 'Beta', statut: 'termine' }, 1);

    expect(chantiers.getListWithStats({ entrepriseId: 1, statut: 'actif' })).toHaveLength(1);
    expect(chantiers.getListWithStats({ entrepriseId: 1, search: 'bet' })).toHaveLength(1);
  });

  test('countWithFilters() compte avec filtres', () => {
    chantiers.createWithValidation({ nom: 'A' }, 1);
    chantiers.createWithValidation({ nom: 'B' }, 1);
    expect(chantiers.countWithFilters({ entrepriseId: 1 })).toBe(2);
    expect(chantiers.countWithFilters({ entrepriseId: 1, search: 'A' })).toBe(1);
  });

  test('getWithRelations() agrège phases, incidents, affectations, client', () => {
    const c = chantiers.createWithValidation({ nom: 'Immeuble' }, 1);
    chantiers.addPhase(c.id, { nom: 'Fondations' });
    chantiers.addIncident(c.id, { titre: 'Retard livraison' }, 1);

    const detail = chantiers.getWithRelations(c.id);
    expect(detail.phases).toHaveLength(1);
    expect(detail.incidents).toHaveLength(1);
    expect(detail.incidents[0].declareParNom).toBe('Admin');
    expect(detail.affectations).toHaveLength(0);
  });

  test('addPhase() incrémente l\'ordre automatiquement', () => {
    const c = chantiers.createWithValidation({ nom: 'Villa' }, 1);
    const p1 = chantiers.addPhase(c.id, { nom: 'Phase 1' });
    const p2 = chantiers.addPhase(c.id, { nom: 'Phase 2' });
    expect(p1.ordre).toBe(1);
    expect(p2.ordre).toBe(2);
  });

  test('recalculerBudgetReel() somme les dépenses du chantier', () => {
    const c = chantiers.createWithValidation({ nom: 'Hangar' }, 1);
    db.prepare(`INSERT INTO Depense (chantierId, categorie, montant, is_synced) VALUES (?, 'Matériaux', 500, 0)`).run(c.id);
    db.prepare(`INSERT INTO Depense (chantierId, categorie, montant, is_synced) VALUES (?, 'Main oeuvre', 300, 0)`).run(c.id);

    const maj = chantiers.recalculerBudgetReel(c.id);
    expect(maj.budgetReel).toBe(800);
  });

  test('getDashboardStats() calcule les KPIs chantier', () => {
    chantiers.createWithValidation({ nom: 'Actif1', statut: 'actif', budgetPrevu: 1000 }, 1);
    chantiers.createWithValidation({ nom: 'Actif2', statut: 'en_cours', budgetPrevu: 2000 }, 1);
    chantiers.createWithValidation({ nom: 'Fini', statut: 'termine' }, 1);

    const stats = chantiers.getDashboardStats(1);
    expect(stats.chantiersActifs).toBe(2);
    expect(stats.budgetPrevuTotal).toBe(3000);
    expect(stats.parStatut.termine).toBe(1);
  });
});