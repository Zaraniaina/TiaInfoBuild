const db = require('../../../models/db');
const ChantierRepository = require('../../../models/repositories/ChantierRepository');

describe('ChantierRepository', () => {
  let repo;

  beforeEach(() => {
    repo = new ChantierRepository();
    db.pragma('foreign_keys = OFF');
    db.prepare('DELETE FROM Phase').run();
    db.prepare('DELETE FROM Incident').run();
    db.prepare('DELETE FROM Chantier').run();
    db.pragma('foreign_keys = ON');
    db.pragma('foreign_keys = OFF');
    db.prepare("INSERT OR IGNORE INTO Client (id, entrepriseId, nom, type, is_deleted) VALUES (1, 1, 'Client Test', 'particulier', 0)").run();
    db.pragma('foreign_keys = ON');
  });

  test('crée un chantier avec entrepriseId', () => {
    const data = { entrepriseId: 1, nom: 'Chantier Test', statut: 'planification', budgetPrevu: 100000 };
    const result = repo.create(data);
    expect(result.id).toBeDefined();
    expect(result.nom).toBe('Chantier Test');
    expect(result.entrepriseId).toBe(1);
  });

  test('récupère un chantier par id', () => {
    const created = repo.create({ entrepriseId: 1, nom: 'Chantier Get', statut: 'en_cours' });
    const fetched = repo.getById(created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.nom).toBe('Chantier Get');
  });

  test('met à jour un chantier', () => {
    const created = repo.create({ entrepriseId: 1, nom: 'Chantier Update', statut: 'planification' });
    const updated = repo.update(created.id, { statut: 'en_cours', budgetReel: 50000 });
    expect(updated.statut).toBe('en_cours');
    expect(updated.budgetReel).toBe(50000);
  });

  test('supprime logiquement un chantier', () => {
    const created = repo.create({ entrepriseId: 1, nom: 'Chantier Delete', statut: 'planification' });
    repo.softDelete(created.id);
    const fetched = repo.getById(created.id);
    expect(fetched).toBeNull();
  });

  test('normalise le statut planifie vers planification', () => {
    expect(repo.normalizeStatut('planifie')).toBe('planification');
    expect(repo.normalizeStatut('en_cours')).toBe('en_cours');
    expect(repo.normalizeStatut('')).toBe('planification');
  });

  test('getAll respecte le multi-tenant', () => {
    db.pragma('foreign_keys = OFF');
    repo.create({ entrepriseId: 1, nom: 'Chantier E1', statut: 'planification' });
    repo.create({ entrepriseId: 2, nom: 'Chantier E2', statut: 'planification' });
    db.pragma('foreign_keys = ON');
    const e1Chantiers = repo.getAll({ entrepriseId: 1 });
    expect(e1Chantiers.length).toBe(1);
    expect(e1Chantiers[0].nom).toBe('Chantier E1');
  });
});
