const { initTestDb, resetData, closeDb, getDb } = require('../setup/dbHelper');

let utilisateurs, db;

beforeAll(() => { initTestDb(); db = getDb(); });
afterAll(() => closeDb());
beforeEach(() => {
  resetData();
  utilisateurs = new (require('../../models/repositories/UtilisateurRepository'))();
});

describe('UtilisateurRepository', () => {
  test('createUser() exige email et nom', () => {
    expect(() => utilisateurs.createUser({ nom: 'X' }, 1)).toThrow("L'email est obligatoire");
    expect(() => utilisateurs.createUser({ email: 'a@b.c' }, 1)).toThrow('Le nom est obligatoire');
  });

  test('createUser() refuse un email en double', () => {
    utilisateurs.createUser({ nom: 'A', email: 'test@tia.mg', password: 'pwd123' }, 1);
    expect(() => utilisateurs.createUser({ nom: 'B', email: 'test@tia.mg' }, 1))
      .toThrow('existe déjà');
  });

  test('createUser() hache le mot de passe en SHA-256', () => {
    const u = utilisateurs.createUser({ nom: 'C', email: 'c@tia.mg', password: 'secret1' }, 1);
    expect(u.motDePasseHash).toHaveLength(64);
    expect(u.motDePasseHash).not.toBe('secret1');
  });

  test('updateUser() re-hache un nouveau mot de passe', () => {
    const u = utilisateurs.createUser({ nom: 'D', email: 'd@tia.mg', password: 'old' }, 1);
    const maj = utilisateurs.updateUser(u.id, { password: 'new', nom: 'D maj' });
    expect(maj.nom).toBe('D maj');
    expect(maj.motDePasseHash).not.toBe(u.motDePasseHash);
  });

  test('getListWithRole() joint le rôle', () => {
    const liste = utilisateurs.getListWithRole({ entrepriseId: 1 });
    expect(liste).toHaveLength(1); // admin seedé
    expect(liste[0].roleNom).toBe('Administrateur');
    expect(liste[0].roleCode).toBe('ADMIN');
  });

  test('getWithRelations() renvoie l\'utilisateur avec son rôle', () => {
    const u = utilisateurs.getWithRelations(1);
    expect(u.email).toBe('admin@tiabuild.com');
    expect(u.roleNom).toBe('Administrateur');
  });
});