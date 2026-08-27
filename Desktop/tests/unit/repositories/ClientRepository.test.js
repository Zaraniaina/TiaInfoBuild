const db = require('../../../models/db');
const ClientRepository = require('../../../models/repositories/ClientRepository');

describe('ClientRepository', () => {
  let repo;

  beforeEach(() => {
    db.pragma('foreign_keys = OFF');
    db.prepare('DELETE FROM Client').run();
    db.pragma('foreign_keys = ON');
    repo = new ClientRepository();
  });

  test('getAll retourne les clients par entreprise', () => {
    db.pragma('foreign_keys = OFF');
    db.prepare("INSERT INTO Client (entrepriseId, nom, type, is_deleted) VALUES (1, 'Client A', 'particulier', 0)").run();
    db.prepare("INSERT INTO Client (entrepriseId, nom, type, is_deleted) VALUES (2, 'Client B', 'entreprise', 0)").run();
    db.pragma('foreign_keys = ON');

    const result = repo.getAll({ entrepriseId: 1, limit: 50, offset: 0 });
    expect(result.length).toBe(1);
    expect(result[0].nom).toBe('Client A');
  });

  test('count retourne le bon nombre', () => {
    db.pragma('foreign_keys = OFF');
    db.prepare("INSERT INTO Client (entrepriseId, nom, type, is_deleted) VALUES (1, 'Client C', 'particulier', 0)").run();
    db.prepare("INSERT INTO Client (entrepriseId, nom, type, is_deleted) VALUES (1, 'Client D', 'entreprise', 0)").run();
    db.prepare("INSERT INTO Client (entrepriseId, nom, type, is_deleted) VALUES (1, 'Client E', 'particulier', 1)").run();
    db.pragma('foreign_keys = ON');

    expect(repo.count({ entrepriseId: 1 })).toBe(2);
  });

  test('searchWithFilters filtre par type', () => {
    db.pragma('foreign_keys = OFF');
    db.prepare("INSERT INTO Client (entrepriseId, nom, type, is_deleted) VALUES (1, 'Client F', 'particulier', 0)").run();
    db.prepare("INSERT INTO Client (entrepriseId, nom, type, is_deleted) VALUES (1, 'Client G', 'entreprise', 0)").run();
    db.pragma('foreign_keys = ON');

    const result = repo.searchWithFilters(1, { type: 'entreprise' });
    expect(result.length).toBe(1);
    expect(result[0].nom).toBe('Client G');
  });
});
