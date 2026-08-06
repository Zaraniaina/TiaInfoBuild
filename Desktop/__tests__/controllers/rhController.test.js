const { initTestDb, resetData, closeDb } = require('../setup/dbHelper');

let ctrl, repos;

beforeAll(() => { initTestDb(); });
afterAll(() => closeDb());
beforeEach(() => {
  resetData();
  repos = {
    employes: new (require('../../models/repositories/EmployeRepository'))(),
    pointages: new (require('../../models/repositories/PointageRepository'))(),
    heuresSup: new (require('../../models/repositories/HeureSupplementaireRepository'))(),
    equipes: new (require('../../models/repositories/EquipeRepository'))()
  };
  ctrl = new (require('../../controllers/rhController'))(repos);
});

describe('RhController — Employés', () => {
  test('CRUD employé complet', async () => {
    const created = await ctrl.createEmploye({}, { nom: 'Rakoto', prenom: 'Jean', matricule: 'M-1' }, 1);
    expect(created.success).toBe(true);
    const id = created.data.id;

    expect((await ctrl.getListEmployes({}, { entrepriseId: 1 })).data.items).toHaveLength(1);
    expect((await ctrl.getEmployeById({}, id)).data.nom).toBe('Rakoto');
    await ctrl.updateEmploye({}, id, { poste: 'Chef de chantier' });
    expect((await ctrl.getEmployeById({}, id)).data.poste).toBe('Chef de chantier');
    await ctrl.deleteEmploye({}, id);
    expect((await ctrl.getListEmployes({}, { entrepriseId: 1 })).data.items).toHaveLength(0);
  });

  test('pointer + presentsToday', async () => {
    const e = await ctrl.createEmploye({}, { nom: 'A', prenom: 'a' }, 1);
    await ctrl.pointer({}, { employeId: e.data.id, heureArrivee: '08:00' });
    const presents = await ctrl.getPresentsToday({}, 1);
    expect(presents.data).toHaveLength(1);
  });
});

describe('RhController — Pointages', () => {
  test('🔴 [BUG CONNU #2] getListPointages() doit filtrer par employé', async () => {
    const e1 = await ctrl.createEmploye({}, { nom: 'E1', prenom: 'e' }, 1);
    const e2 = await ctrl.createEmploye({}, { nom: 'E2', prenom: 'e' }, 1);
    await ctrl.createPointage({}, { employeId: e1.data.id, dateJour: '2026-08-01' });
    await ctrl.createPointage({}, { employeId: e2.data.id, dateJour: '2026-08-01' });

    const res = await ctrl.getListPointages({}, { employeId: e1.data.id });
    // Le code actuel ignore le filtre et renvoie TOUS les pointages
    expect(res.data).toHaveLength(1);
    expect(res.data[0].employeId).toBe(e1.data.id);
  });
});

describe('RhController — Heures sup', () => {
  test('🔴 [BUG CONNU #3] getListHeuresSup() doit filtrer par employé', async () => {
    const e1 = await ctrl.createEmploye({}, { nom: 'H1', prenom: 'h' }, 1);
    const e2 = await ctrl.createEmploye({}, { nom: 'H2', prenom: 'h' }, 1);
    await ctrl.createHeureSup({}, { employeId: e1.data.id, dateJour: '2026-08-01', nombreHeures: 3 });
    await ctrl.createHeureSup({}, { employeId: e2.data.id, dateJour: '2026-08-01', nombreHeures: 2 });

    const res = await ctrl.getListHeuresSup({}, { employeId: e1.data.id });
    expect(res.data).toHaveLength(1);
  });
});

describe('RhController — Équipes', () => {
  test('création d\'équipe', async () => {
    const res = await ctrl.createEquipe({}, { nom: 'Équipe A' }, 1);
    expect(res.success).toBe(true);
  });

  test('🔴 [BUG CONNU #11] getListEquipes() devrait renvoyer chefNom et nbMembres', async () => {
    const chef = await ctrl.createEmploye({}, { nom: 'Chef', prenom: 'C' }, 1);
    await ctrl.createEquipe({}, { nom: 'Équipe X', chefEquipeId: chef.data.id }, 1);
    const res = await ctrl.getListEquipes({}, 1);
    // Le code actuel utilise getAll() brut → pas de chefNom/nbMembres
    expect(res.data[0].chefNom).toBe('Chef');
    expect(res.data[0].nbMembres).toBe(0);
  });
});