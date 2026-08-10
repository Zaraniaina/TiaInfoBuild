const db = require('../../../models/db');
const UtilisateurRepository = require('../../../models/repositories/UtilisateurRepository');

describe('UtilisateurRepository', () => {
  let repo;

  beforeEach(() => {
    repo = new UtilisateurRepository();
    db.pragma('foreign_keys = OFF');
    db.prepare('DELETE FROM Utilisateur').run();
    db.pragma('foreign_keys = ON');
  });

  test('createUser rejette email vide', () => {
    expect(() => repo.createUser({ nom: 'Test' }, 1)).toThrow("L'email est obligatoire.");
  });

  test('createUser rejette nom vide', () => {
    expect(() => repo.createUser({ email: 'test@test.com' }, 1)).toThrow("Le nom est obligatoire.");
  });

  test('createUser rejette doublon email', () => {
    repo.createUser({ nom: 'Test', email: 'test@test.com', roleId: 2 }, 1);
    expect(() => repo.createUser({ nom: 'Test2', email: 'test@test.com', roleId: 2 }, 1)).toThrow("Un utilisateur avec cet email existe déjà.");
  });

  test('createUser rejette doublon téléphone', () => {
    repo.createUser({ nom: 'Test', email: 'test1@test.com', telephone: '0123456789', roleId: 2 }, 1);
    expect(() => repo.createUser({ nom: 'Test2', email: 'test2@test.com', telephone: '0123456789', roleId: 2 }, 1)).toThrow("Ce numéro de téléphone est déjà utilisé par un autre utilisateur.");
  });
});
