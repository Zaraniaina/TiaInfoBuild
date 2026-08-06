const { initTestDb, resetData, closeDb } = require('../setup/dbHelper');

let ctrl, repos;

beforeAll(() => { initTestDb(); });
afterAll(() => closeDb());
beforeEach(() => {
  resetData();
  // Reconstruction des repos comme dans main.js
  repos = {
    chantiers: new (require('../../models/repositories/ChantierRepository'))(),
    phases: new (require('../../models/repositories/PhaseRepository'))(),
    incidents: new (require('../../models/repositories/IncidentRepository'))()
  };
  const ChantierController = require('../../controllers/chantierController');
  ctrl = new ChantierController(repos);
});

describe('ChantierController — enveloppe de réponse', () => {
  test('create() renvoie { success:true, data }', async () => {
    const res = await ctrl.create({}, { nom: 'Tour Horizon', budgetPrevu: 50000 }, 1);
    expect(res.success).toBe(true);
    expect(res.data.nom).toBe('Tour Horizon');
  });

  test('create() en erreur renvoie { success:false, error }', async () => {
    const res = await ctrl.create({}, {}, 1);
    expect(res.success).toBe(false);
    expect(res.error).toContain('obligatoire');
  });

  test('list/get/update/delete cycle complet', async () => {
    const created = await ctrl.create({}, { nom: 'Cycle' }, 1);
    const id = created.data.id;

    const list = await ctrl.getList({}, { entrepriseId: 1 });
    expect(list.data.items).toHaveLength(1);
    expect(list.data.total).toBe(1);

    const got = await ctrl.getById({}, id);
    expect(got.data.nom).toBe('Cycle');

    await ctrl.update({}, id, { statut: 'actif' });
    expect((await ctrl.getById({}, id)).data.statut).toBe('actif');

    await ctrl.delete({}, id);
    expect((await ctrl.getList({}, { entrepriseId: 1 })).data.items).toHaveLength(0);
  });

  test('addPhase + updatePhaseAvancement + avancementGlobal', async () => {
    const c = await ctrl.create({}, { nom: 'Phases' }, 1);
    await ctrl.addPhase({}, c.data.id, { nom: 'P1' });
    const phases = await ctrl.getPhasesByChantier({}, c.data.id);
    await ctrl.updatePhaseAvancement({}, phases.data[0].id, 75);
    const global = await ctrl.getAvancementGlobalPhases({}, c.data.id);
    expect(global.data).toBe(75);
  });

  test('addIncident + changerStatutIncident', async () => {
    const c = await ctrl.create({}, { nom: 'Incidents' }, 1);
    await ctrl.addIncident({}, c.data.id, { titre: 'Panne grue' }, 1);
    const liste = await ctrl.getIncidentsByChantier({}, c.data.id);
    expect(liste.data).toHaveLength(1);
    await ctrl.changerStatutIncident({}, liste.data[0].id, 'resolu');
    const ouverts = await ctrl.getIncidentsOuvertsByEntreprise({}, 1);
    expect(ouverts.data).toHaveLength(0);
  });

  test('recalculerBudget somme les dépenses', async () => {
    const c = await ctrl.create({}, { nom: 'Budget' }, 1);
    const DepenseRepository = require('../../models/repositories/DepenseRepository');
    new DepenseRepository().create({ chantierId: c.data.id, montant: 750 });
    const res = await ctrl.recalculerBudget({}, c.data.id);
    expect(res.data.budgetReel).toBe(750);
  });

  test('getStats renvoie les KPIs', async () => {
    await ctrl.create({}, { nom: 'S1', statut: 'actif' }, 1);
    const stats = await ctrl.getStats({}, 1);
    expect(stats.success).toBe(true);
    expect(stats.data.chantiersActifs).toBe(1);
  });
});