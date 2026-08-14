const db = require('../../../models/db');
const DevisRepository = require('../../../models/repositories/DevisRepository');

describe('DevisRepository', () => {
  let repo;

  beforeEach(() => {
    db.pragma('foreign_keys = OFF');
    db.prepare('DELETE FROM LigneDevis').run();
    db.prepare('DELETE FROM Devis').run();
    repo = new DevisRepository();
    db.pragma('foreign_keys = OFF');
    db.prepare("INSERT OR IGNORE INTO Client (id, entrepriseId, nom, type, is_deleted) VALUES (1, 1, 'Client Test', 'particulier', 0)").run();
    db.pragma('foreign_keys = ON');
  });

  test('crée un devis avec lignes', () => {
    const data = {
      entrepriseId: 1,
      clientId: 1,
      dateValidite: '2026-09-14',
      lignes: [
        { description: 'Test', quantite: 2, prixUnitaire: 100, remise: 0, tauxTVA: 20 }
      ]
    };
    const result = repo.createWithLignes(data, 1);
    expect(result.id).toBeDefined();
    expect(result.numero).toBeDefined();
    expect(result.montantHT).toBeCloseTo(200, 1);
  });

  test('getWithLignes retourne les lignes associées', () => {
    const devis = repo.createWithLignes({
      entrepriseId: 1,
      clientId: 1,
      dateValidite: '2026-09-14',
      lignes: [
        { description: 'Ligne 1', quantite: 1, prixUnitaire: 50, remise: 0, tauxTVA: 20 }
      ]
    }, 1);

    const withLignes = repo.getWithLignes(devis.id);
    expect(withLignes.lignes.length).toBe(1);
    expect(withLignes.lignes[0].description).toBe('Ligne 1');
  });

  test('getAll respecte le multi-tenant', () => {
    db.pragma('foreign_keys = OFF');
    repo.createWithLignes({ entrepriseId: 1, clientId: 1, dateValidite: '2026-09-14', lignes: [] }, 1);
    db.pragma('foreign_keys = ON');

    const e1Devis = repo.getAll({ entrepriseId: 1 });
    expect(e1Devis.length).toBe(1);
  });
});
