const { initTestDb, resetData, closeDb, getDb } = require('../setup/dbHelper');

let employes, pointages, equipes, heuresSup, db;

beforeAll(() => { initTestDb(); db = getDb(); });
afterAll(() => closeDb());
beforeEach(() => {
  resetData();
  employes = new (require('../../models/repositories/EmployeRepository'))();
  pointages = new (require('../../models/repositories/PointageRepository'))();
  equipes = new (require('../../models/repositories/EquipeRepository'))();
  heuresSup = new (require('../../models/repositories/HeureSupplementaireRepository'))();
});

describe('EmployeRepository', () => {
  test('createWithValidation() exige nom et prénom', () => {
    expect(() => employes.createWithValidation({ prenom: 'X' }, 1)).toThrow('Le nom est obligatoire');
    expect(() => employes.createWithValidation({ nom: 'X' }, 1)).toThrow('Le prénom est obligatoire');
  });

  test('createWithValidation() refuse un matricule en double', () => {
    employes.createWithValidation({ nom: 'Rakoto', prenom: 'Jean', matricule: 'EMP-001' }, 1);
    expect(() => employes.createWithValidation({ nom: 'Rabe', prenom: 'Paul', matricule: 'EMP-001' }, 1))
      .toThrow('Ce matricule existe déjà');
  });

  test('getListWithStats() inclut compteurs pointages/heures sup', () => {
    const e = employes.createWithValidation({ nom: 'Rakoto', prenom: 'Jean' }, 1);
    pointages.create({ employeId: e.id, dateJour: new Date().toISOString().split('T')[0], statut: 'present' });
    const liste = employes.getListWithStats({ entrepriseId: 1 });
    expect(liste[0].nbPointagesMois).toBe(1);
  });

  test('getPresentsToday() joint le pointage du jour', () => {
    const e = employes.createWithValidation({ nom: 'Rasoa', prenom: 'Marie' }, 1);
    employes.pointer({ employeId: e.id, heureArrivee: '08:00', statut: 'present' });
    const presents = employes.getPresentsToday(1);
    expect(presents).toHaveLength(1);
    expect(presents[0].heureArrivee).toBe('08:00');
  });

  test('pointer() crée puis met à jour le pointage du jour', () => {
    const e = employes.createWithValidation({ nom: 'Andry', prenom: 'Luc' }, 1);
    employes.pointer({ employeId: e.id, heureArrivee: '07:30' });
    employes.pointer({ employeId: e.id, heureDepart: '17:00' });
    const today = new Date().toISOString().split('T')[0];
    const p = db.prepare('SELECT * FROM Pointage WHERE employeId = ? AND dateJour = ?').get(e.id, today);
    expect(p.heureArrivee).toBe('07:30');
    expect(p.heureDepart).toBe('17:00');
  });

  test('getDashboardStats() calcule effectif et présents', () => {
    const e1 = employes.createWithValidation({ nom: 'A', prenom: 'a' }, 1);
    employes.createWithValidation({ nom: 'B', prenom: 'b', statut: 'conge' }, 1);
    employes.pointer({ employeId: e1.id, statut: 'present' });
    const stats = employes.getDashboardStats(1);
    expect(stats.effectifTotal).toBe(2);
    expect(stats.presentsAujourdhui).toBe(1);
    expect(stats.parStatut.conge).toBe(1);
  });
});

describe('PointageRepository', () => {
  test('getByEmploye() filtre par dates', () => {
    const e = employes.createWithValidation({ nom: 'X', prenom: 'x' }, 1);
    pointages.create({ employeId: e.id, dateJour: '2026-08-01', statut: 'present' });
    pointages.create({ employeId: e.id, dateJour: '2026-07-01', statut: 'present' });
    const aout = pointages.getByEmploye(e.id, { dateDebut: '2026-08-01', dateFin: '2026-08-31' });
    expect(aout).toHaveLength(1);
  });

  test('getStatsEmploye() compte par statut', () => {
    const e = employes.createWithValidation({ nom: 'Y', prenom: 'y' }, 1);
    pointages.create({ employeId: e.id, dateJour: '2026-08-01', statut: 'present' });
    pointages.create({ employeId: e.id, dateJour: '2026-08-02', statut: 'retard' });
    pointages.create({ employeId: e.id, dateJour: '2026-08-03', statut: 'absent' });
    const stats = pointages.getStatsEmploye(e.id, '2026-08-01', '2026-08-31');
    expect(stats.presents).toBe(1);
    expect(stats.retards).toBe(1);
    expect(stats.absents).toBe(1);
  });
});

describe('EquipeRepository', () => {
  test('getByEntreprise() renvoie chefNom et nbMembres', () => {
    const chef = employes.createWithValidation({ nom: 'Chef', prenom: 'Principal' }, 1);
    const membre = employes.createWithValidation({ nom: 'Membre', prenom: 'Un' }, 1);
    const eq = equipes.create({ nom: 'Équipe Gros Oeuvre', chefEquipeId: chef.id }, 1);
    equipes.ajouterMembre(eq.id, membre.id);

    const liste = equipes.getByEntreprise(1);
    expect(liste).toHaveLength(1);
    expect(liste[0].chefNom).toBe('Chef');
    expect(liste[0].nbMembres).toBe(1);
  });

  test('ajouterMembre()/retirerMembre() gèrent les membres', () => {
    const e = employes.createWithValidation({ nom: 'Z', prenom: 'z' }, 1);
    const eq = equipes.create({ nom: 'Équipe B' }, 1);
    equipes.ajouterMembre(eq.id, e.id);
    expect(equipes.getWithMembres(eq.id).membres).toHaveLength(1);
    equipes.retirerMembre(eq.id, e.id);
    expect(equipes.getWithMembres(eq.id).membres).toHaveLength(0);
  });

  test('exists() détecte les doublons de membres', () => {
    const MembreEquipeRepository = require('../../models/repositories/MembreEquipeRepository');
    const membres = new MembreEquipeRepository();
    const e = employes.createWithValidation({ nom: 'W', prenom: 'w' }, 1);
    const eq = equipes.create({ nom: 'Équipe C' }, 1);
    expect(membres.exists(eq.id, e.id)).toBe(false);
    equipes.ajouterMembre(eq.id, e.id);
    expect(membres.exists(eq.id, e.id)).toBe(true);
  });
});

describe('HeureSupplementaireRepository', () => {
  test('getTotalByEmploye() somme les heures sur une période', () => {
    const e = employes.createWithValidation({ nom: 'H', prenom: 'h' }, 1);
    heuresSup.create({ employeId: e.id, dateJour: '2026-08-01', nombreHeures: 3 });
    heuresSup.create({ employeId: e.id, dateJour: '2026-08-02', nombreHeures: 2 });
    expect(heuresSup.getTotalByEmploye(e.id, '2026-08-01', '2026-08-31')).toBe(5);
  });
});