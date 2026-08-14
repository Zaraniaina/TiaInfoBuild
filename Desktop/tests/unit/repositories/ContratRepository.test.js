const db = require('../../../models/db');
const ContratRepository = require('../../../models/repositories/ContratRepository');

describe('ContratRepository', () => {
  let repo;

  beforeEach(() => {
    db.pragma('foreign_keys = OFF');
    db.prepare('DELETE FROM Contrat').run();
    repo = new ContratRepository();
    db.pragma('foreign_keys = OFF');
    db.prepare("INSERT OR IGNORE INTO Client (id, entrepriseId, nom, type, is_deleted) VALUES (1, 1, 'Client Test', 'particulier', 0)").run();
    db.pragma('foreign_keys = ON');
  });

  test('crée un contrat', () => {
    const data = {
      entrepriseId: 1,
      clientId: 1,
      objet: 'Contrat test',
      montantHT: 1000,
      tva: 20,
      dateDebut: '2026-09-01',
      dateFin: '2026-12-31'
    };
    const result = repo.create(data);
    expect(result.id).toBeDefined();
    expect(result.objet).toBe('Contrat test');
  });

  test('getAll retourne les contrats par entreprise', () => {
    db.pragma('foreign_keys = OFF');
    repo.create({ entrepriseId: 1, clientId: 1, objet: 'Contrat E1' });
    db.pragma('foreign_keys = ON');

    const result = repo.getAll({ entrepriseId: 1 });
    expect(result.length).toBe(1);
    expect(result[0].objet).toBe('Contrat E1');
  });

  test('soft-delete un contrat', () => {
    const created = repo.create({ entrepriseId: 1, clientId: 1, objet: 'Contrat Delete' });
    repo.softDelete(created.id);
    const fetched = repo.getById(created.id);
    expect(fetched).toBeNull();
  });

  test('count respecte le multi-tenant', () => {
    db.pragma('foreign_keys = OFF');
    repo.create({ entrepriseId: 1, clientId: 1, objet: 'C1' });
    repo.create({ entrepriseId: 1, clientId: 1, objet: 'C2' });
    db.pragma('foreign_keys = ON');

    expect(repo.count({ entrepriseId: 1 })).toBe(2);
  });
});
