const { initTestDb, resetData, closeDb, getDb } = require('../setup/dbHelper');

let repo; // BaseRepository via ClientRepository (véhicule concret)

beforeAll(() => initTestDb());
afterAll(() => closeDb());
beforeEach(() => resetData());

describe('BaseRepository — CRUD générique', () => {
  beforeEach(() => {
    const ClientRepository = require('../../models/repositories/ClientRepository');
    repo = new ClientRepository();
  });

  test('create() injecte entrepriseId automatiquement', () => {
    const client = repo.create({ nom: 'Client Test' }, 1);
    expect(client.id).toBeDefined();
    expect(client.nom).toBe('Client Test');
    expect(client.entrepriseId).toBe(1);
    expect(client.is_deleted).toBe(0);
  });

  test('create() filtre les colonnes inexistantes (anti-injection SQL)', () => {
    const client = repo.create({ nom: 'X', colonnePirate: 'DROP TABLE' }, 1);
    expect(client.id).toBeDefined();
    expect(client.colonnePirate).toBeUndefined();
  });

  test('getById() renvoie null si inexistant ou supprimé', () => {
    expect(repo.getById(99999)).toBeNull();
    const c = repo.create({ nom: 'Y' }, 1);
    repo.softDelete(c.id);
    expect(repo.getById(c.id)).toBeNull();
  });

  test('getAll() filtre par entrepriseId (isolation multi-tenant)', () => {
    repo.create({ nom: 'Ent1-A' }, 1);
    const autre = getDb().prepare(
      `INSERT INTO Entreprise (nom, is_synced) VALUES ('Autre', 0)`
    ).run();
    const ClientRepository = require('../../models/repositories/ClientRepository');
    const repo2 = new ClientRepository();
    repo2.create({ nom: 'Ent2-A' }, autre.lastInsertRowid);

    const liste = repo.getAll({ entrepriseId: 1 });
    expect(liste.every(c => c.entrepriseId === 1)).toBe(true);
    expect(liste.find(c => c.nom === 'Ent2-A')).toBeUndefined();
  });

  test('getAll() applique where + params + pagination', () => {
    for (let i = 0; i < 5; i++) repo.create({ nom: `C${i}` }, 1);
    const page = repo.getAll({ entrepriseId: 1, limit: 2, offset: 0, orderBy: 'id ASC' });
    expect(page).toHaveLength(2);
  });

  test('count() compte les enregistrements actifs', () => {
    repo.create({ nom: 'A' }, 1);
    const b = repo.create({ nom: 'B' }, 1);
    repo.softDelete(b.id);
    expect(repo.count({ entrepriseId: 1 })).toBe(1);
  });

  test('update() remet is_synced à 0 (prêt pour la sync)', () => {
    const c = repo.create({ nom: 'Avant' }, 1);
    repo.markSynced(c.id, 42);
    expect(repo.getById(c.id).is_synced).toBe(1);
    repo.update(c.id, { nom: 'Après' });
    const maj = repo.getById(c.id);
    expect(maj.nom).toBe('Après');
    expect(maj.is_synced).toBe(0);
  });

  test('softDelete() marque is_deleted=1 sans détruire la ligne', () => {
    const c = repo.create({ nom: 'À supprimer' }, 1);
    expect(repo.softDelete(c.id)).toBe(true);
    const brut = getDb().prepare('SELECT * FROM Client WHERE id = ?').get(c.id);
    expect(brut.is_deleted).toBe(1);
  });

  test('markSynced() pose is_synced=1 et server_id', () => {
    const c = repo.create({ nom: 'Sync' }, 1);
    repo.markSynced(c.id, 77);
    const maj = repo.getById(c.id);
    expect(maj.is_synced).toBe(1);
    expect(maj.server_id).toBe(77);
  });

  test('search() recherche multi-colonnes avec LIKE', () => {
    const ArticleRepository = require('../../models/repositories/ArticleRepository');
    const articles = new ArticleRepository();
    articles.create({ nom: 'Ciment Portland', categorie: 'Matériaux' }, 1);
    articles.create({ nom: 'Fer à béton', categorie: 'Acier' }, 1);

    const resultats = articles.search('ciment', ['nom', 'categorie'], { entrepriseId: 1 });
    expect(resultats).toHaveLength(1);
    expect(resultats[0].nom).toBe('Ciment Portland');
  });

  test('transaction() rollback en cas d\'erreur', () => {
    expect(() => {
      repo.transaction(() => {
        repo.create({ nom: 'Devrait disparaître' }, 1);
        throw new Error('Échec provoqué');
      });
    }).toThrow('Échec provoqué');
    expect(repo.count({ entrepriseId: 1 })).toBe(0);
  });

  test('getUnsynced() liste uniquement les non synchronisés', () => {
    const a = repo.create({ nom: 'Non sync' }, 1);
    const b = repo.create({ nom: 'Sync' }, 1);
    repo.markSynced(b.id, 10);
    const unsynced = repo.getUnsynced(1);
    expect(unsynced.map(r => r.id)).toContain(a.id);
    expect(unsynced.map(r => r.id)).not.toContain(b.id);
  });
});