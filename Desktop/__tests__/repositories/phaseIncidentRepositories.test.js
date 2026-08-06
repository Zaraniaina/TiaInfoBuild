const { initTestDb, resetData, closeDb, getDb } = require('../setup/dbHelper');

let phases, incidents, chantiers, chantierId, db;

beforeAll(() => { initTestDb(); db = getDb(); });
afterAll(() => closeDb());
beforeEach(() => {
  resetData();
  const PhaseRepository = require('../../models/repositories/PhaseRepository');
  const IncidentRepository = require('../../models/repositories/IncidentRepository');
  const ChantierRepository = require('../../models/repositories/ChantierRepository');
  phases = new PhaseRepository();
  incidents = new IncidentRepository();
  chantiers = new ChantierRepository();
  chantierId = chantiers.createWithValidation({ nom: 'Test Phases' }, 1).id;
});

describe('PhaseRepository', () => {
  test('getByChantier() trie par ordre', () => {
    chantiers.addPhase(chantierId, { nom: 'B' });
    chantiers.addPhase(chantierId, { nom: 'A' });
    const liste = phases.getByChantier(chantierId);
    expect(liste.map(p => p.nom)).toEqual(['B', 'A']); // ordre d'insertion 1,2
  });

  test('updateAvancement() met à jour le pourcentage', () => {
    const p = chantiers.addPhase(chantierId, { nom: 'Terrassement' });
    const maj = phases.updateAvancement(p.id, 60);
    expect(maj.avancementPct).toBe(60);
  });

  test('🔴 [BUG CONNU #6] updateAvancement() devrait poser is_synced=0', () => {
    const p = chantiers.addPhase(chantierId, { nom: 'Maçonnerie' });
    // Simule une phase déjà synchronisée
    db.prepare('UPDATE Phase SET is_synced = 1 WHERE id = ?').run(p.id);
    phases.updateAvancement(p.id, 50);
    // Le code actuel ne remet PAS is_synced à 0 → la modif ne sera jamais synchronisée
    expect(phases.getById(p.id).is_synced).toBe(0);
  });

  test('🔴 [BUG CONNU] updateAvancement() devrait borner entre 0 et 100', () => {
    const p = chantiers.addPhase(chantierId, { nom: 'Finitions' });
    phases.updateAvancement(p.id, 150);
    expect(phases.getById(p.id).avancementPct).toBeLessThanOrEqual(100);
  });

  test('reorder() réordonne les phases', () => {
    const p1 = chantiers.addPhase(chantierId, { nom: 'P1' });
    const p2 = chantiers.addPhase(chantierId, { nom: 'P2' });
    phases.reorder(chantierId, [p2.id, p1.id]);
    const liste = phases.getByChantier(chantierId);
    expect(liste[0].nom).toBe('P2');
    expect(liste[1].nom).toBe('P1');
  });

  test('getAvancementGlobal() moyenne les avancements', () => {
    const p1 = chantiers.addPhase(chantierId, { nom: 'P1' });
    const p2 = chantiers.addPhase(chantierId, { nom: 'P2' });
    phases.updateAvancement(p1.id, 40);
    phases.updateAvancement(p2.id, 80);
    expect(phases.getAvancementGlobal(chantierId)).toBe(60);
  });
});

describe('IncidentRepository', () => {
  test('changerStatut() valide le statut', () => {
    const i = chantiers.addIncident(chantierId, { titre: 'Accident' }, 1);
    expect(() => incidents.changerStatut(i.id, 'statut_bidon')).toThrow('Statut invalide');
    const maj = incidents.changerStatut(i.id, 'resolu');
    expect(maj.statut).toBe('resolu');
  });

  test('getOuvertsByEntreprise() trie par gravité', () => {
    chantiers.addIncident(chantierId, { titre: 'Léger', gravite: 'faible' }, 1);
    chantiers.addIncident(chantierId, { titre: 'Grave', gravite: 'critique' }, 1);
    const ouverts = incidents.getOuvertsByEntreprise(1);
    expect(ouverts).toHaveLength(2);
    expect(ouverts[0].titre).toBe('Grave');
    // Les incidents résolus sont exclus
    incidents.changerStatut(ouverts[0].id, 'resolu');
    expect(incidents.getOuvertsByEntreprise(1)).toHaveLength(1);
  });
});