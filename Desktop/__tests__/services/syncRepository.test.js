const { initTestDb, resetData, closeDb, getDb } = require('../setup/dbHelper');

jest.mock('../../services/apiClient');
const apiClient = require('../../services/apiClient');

let sync, db;

beforeAll(() => { initTestDb(); db = getDb(); });
afterAll(() => closeDb());
beforeEach(() => {
  resetData();
  jest.clearAllMocks();
  const SyncRepository = require('../../models/repositories/SyncRepository');
  sync = new SyncRepository();
});

describe('SyncRepository — Configuration', () => {
  test('getConfig()/setConfig()', () => {
    const config = sync.getConfig();
    expect(config.autoSync).toBe(true);
    sync.setConfig({ interval: 60000 });
    expect(sync.getConfig().interval).toBe(60000);
    sync.setConfig({ interval: 300000 }); // reset
  });
});

describe('SyncRepository — Push', () => {
  test('push() envoie les enregistrements non synchronisés et les marque syncéd', async () => {
    db.prepare(`INSERT INTO Chantier (entrepriseId, nom, is_synced) VALUES (1, 'Nouveau', 0)`).run();
    apiClient.post.mockResolvedValue({ syncedIds: [1] });

    const res = await sync.push();
    expect(res.pushed).toBeGreaterThanOrEqual(1);
    const chantier = db.prepare('SELECT is_synced FROM Chantier WHERE id = 1').get();
    expect(chantier.is_synced).toBe(1);
  });

  test('🔴 [BUG CONNU #17] push() ne doit PAS doubler le préfixe /api', async () => {
    db.prepare(`INSERT INTO Client (entrepriseId, nom, is_synced) VALUES (1, 'Push', 0)`).run();
    apiClient.post.mockResolvedValue({});
    await sync.push();

    // baseUrl contient déjà /api → l'endpoint doit être /sync/push/client/
    // Le code actuel appelle /api/sync/push/client/ (double préfixe)
    const appels = apiClient.post.mock.calls.map(c => c[0]);
    expect(appels).toContain('/sync/push/client/');
  });

  test('push() journalise les erreurs par table', async () => {
    db.prepare(`INSERT INTO Article (entrepriseId, nom, is_synced) VALUES (1, 'Erreur', 0)`).run();
    apiClient.post.mockRejectedValue(new Error('serveur down'));
    const res = await sync.push();
    expect(res.errors.length).toBeGreaterThan(0);
    expect(sync.getHistory(10).some(h => h.status === 'error')).toBe(true);
  });
});

describe('SyncRepository — Pull', () => {
  test('pull() insère les nouveaux enregistrements du serveur', async () => {
    apiClient.get.mockResolvedValue({
      Client: [{ id: 500, entrepriseId: 1, nom: 'Importé du serveur' }]
    });
    const res = await sync.pull();
    expect(res.success).toBe(true);
    const client = db.prepare('SELECT * FROM Client WHERE id = 500').get();
    expect(client.nom).toBe('Importé du serveur');
    expect(client.is_synced).toBe(1);
  });

  test('pull() met à jour les enregistrements existants', async () => {
    db.prepare(`INSERT INTO Client (id, entrepriseId, nom, is_synced) VALUES (600, 1, 'Ancien', 1)`).run();
    apiClient.get.mockResolvedValue({
      Client: [{ id: 600, nom: 'Mis à jour' }]
    });
    await sync.pull();
    expect(db.prepare('SELECT nom FROM Client WHERE id = 600').get().nom).toBe('Mis à jour');
  });

  test('🔴 [BUG CONNU #17] pull() ne doit PAS doubler le préfixe /api', async () => {
    apiClient.get.mockResolvedValue({});
    await sync.pull();
    expect(apiClient.get).toHaveBeenCalledWith('/sync/pull/', expect.anything());
  });
});

describe('SyncRepository — Statut', () => {
  test('getStatus() compte les changements en attente', () => {
    db.prepare(`INSERT INTO Chantier (entrepriseId, nom, is_synced) VALUES (1, 'Pending', 0)`).run();
    const status = sync.getStatus();
    expect(status.pendingChanges).toBeGreaterThanOrEqual(1);
    expect(status.status).toBe('pending');
  });

  test('getPendingCount() ignore les enregistrements synchronisés', () => {
    db.prepare(`INSERT INTO Chantier (entrepriseId, nom, is_synced) VALUES (1, 'Synced', 1)`).run();
    expect(sync.getPendingCount()).toBe(0);
  });
});