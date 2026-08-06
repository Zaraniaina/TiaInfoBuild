const { initTestDb, resetData, closeDb, getDb } = require('../setup/dbHelper');

let materiels, maintenances, db;

beforeAll(() => { initTestDb(); db = getDb(); });
afterAll(() => closeDb());
beforeEach(() => {
  resetData();
  materiels = new (require('../../models/repositories/MaterielRepository'))();
  maintenances = new (require('../../models/repositories/MaintenanceRepository'))();
});

describe('MaterielRepository', () => {
  test('getByEntreprise() filtre par statut/type/recherche', () => {
    materiels.create({ nom: 'Grue A', statut: 'disponible', type: 'levage' }, 1);
    materiels.create({ nom: 'Bétonnière B', statut: 'en_service', type: 'beton' }, 1);
    expect(materiels.getByEntreprise(1, { statut: 'disponible' })).toHaveLength(1);
    expect(materiels.getByEntreprise(1, { search: 'grue' })).toHaveLength(1);
  });

  test('getDisponibles() exclut les matériels affectés', () => {
    const m1 = materiels.create({ nom: 'Dispo', statut: 'disponible' }, 1);
    const m2 = materiels.create({ nom: 'Affecté', statut: 'disponible' }, 1);
    const ChantierRepository = require('../../models/repositories/ChantierRepository');
    const c = new ChantierRepository().createWithValidation({ nom: 'Chantier' }, 1);
    db.prepare(`INSERT INTO AffectationMateriel (materielId, chantierId, dateDebut, is_synced)
                VALUES (?, ?, date('now'), 0)`).run(m2.id, c.id);

    const dispos = materiels.getDisponibles(1);
    expect(dispos.map(m => m.id)).toContain(m1.id);
    expect(dispos.map(m => m.id)).not.toContain(m2.id);
  });

  test('getWithRelations() agrège affectations, maintenances, alertes', () => {
    const m = materiels.create({ nom: 'Excavatrice' }, 1);
    maintenances.create({ materielId: m.id, type: 'preventive', cout: 200 });
    const detail = materiels.getWithRelations(m.id);
    expect(detail.maintenances).toHaveLength(1);
    expect(detail.affectations).toHaveLength(0);
  });

  test('getDashboardStats() calcule les KPIs matériels', () => {
    materiels.create({ nom: 'M1', statut: 'disponible', valeurAchat: 10000 }, 1);
    materiels.create({ nom: 'M2', statut: 'en_panne', valeurAchat: 5000 }, 1);
    const stats = materiels.getDashboardStats(1);
    expect(stats.total).toBe(2);
    expect(stats.valeurTotale).toBe(15000);
    expect(stats.parStatut.en_panne).toBe(1);
  });
});

describe('MaintenanceRepository', () => {
  test('getByMateriel() liste l\'historique', () => {
    const m = materiels.create({ nom: 'Camion' }, 1);
    maintenances.create({ materielId: m.id, type: 'corrective', cout: 150 });
    maintenances.create({ materielId: m.id, type: 'preventive', cout: 80 });
    expect(maintenances.getByMateriel(m.id)).toHaveLength(2);
    expect(maintenances.getCoutTotalByMateriel(m.id)).toBe(230);
  });

  test('getAVenir() liste les échéances proches', () => {
    const m = materiels.create({ nom: 'Niveleuse' }, 1);
    maintenances.create({
      materielId: m.id,
      prochaineDateEcheance: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
    });
    expect(maintenances.getAVenir(1, 30)).toHaveLength(1);
  });
});