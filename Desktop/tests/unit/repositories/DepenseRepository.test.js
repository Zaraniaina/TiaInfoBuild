const db = require('../../../models/db');
const DepenseRepository = require('../../../models/repositories/DepenseRepository');

describe('DepenseRepository', () => {
  let repo;

  beforeEach(() => {
    repo = new DepenseRepository();
    db.prepare('DELETE FROM Depense').run();
    db.prepare('DELETE FROM Chantier').run();
    db.prepare('DELETE FROM Utilisateur').run();
    db.prepare("INSERT OR IGNORE INTO Utilisateur (id, entrepriseId, nom, email, motDePasseHash, is_deleted) VALUES (0, 1, 'Système', 'system@local', 'x', 0)").run();
    db.prepare("INSERT OR IGNORE INTO Utilisateur (id, entrepriseId, nom, email, motDePasseHash, is_deleted) VALUES (1, 1, 'Validateur', 'valid@local', 'x', 0)").run();
  });

  test('getEnAttenteValidation retourne dépenses sans valideePar (NULL)', () => {
    const chantier = db.prepare(`
      INSERT INTO Chantier (entrepriseId, nom, statut, is_deleted)
      VALUES (1, 'Test Chantier', 'planification', 0)
    `).run();

    db.prepare(`
      INSERT INTO Depense (chantierId, montant, categorie, dateDepense, valideePar, is_deleted)
      VALUES (?, 100, 'Test', date('now'), NULL, 0)
    `).run(chantier.lastInsertRowid);

    const result = repo.getEnAttenteValidation(1);
    expect(result.length).toBe(1);
    expect(result[0].montant).toBe(100);
  });

  test('getEnAttenteValidation retourne dépenses sans valideePar (0)', () => {
    const chantier = db.prepare(`
      INSERT INTO Chantier (entrepriseId, nom, statut, is_deleted)
      VALUES (1, 'Test Chantier 2', 'planification', 0)
    `).run();

    db.prepare(`
      INSERT INTO Depense (chantierId, montant, categorie, dateDepense, valideePar, is_deleted)
      VALUES (?, 200, 'Test', date('now'), 0, 0)
    `).run(chantier.lastInsertRowid);

    const result = repo.getEnAttenteValidation(1);
    expect(result.length).toBe(1);
    expect(result[0].montant).toBe(200);
  });

  test('getEnAttenteValidation ne retourne pas dépenses validées', () => {
    const chantier = db.prepare(`
      INSERT INTO Chantier (entrepriseId, nom, statut, is_deleted)
      VALUES (1, 'Test Chantier 3', 'planification', 0)
    `).run();

    db.prepare(`
      INSERT INTO Depense (chantierId, montant, categorie, dateDepense, valideePar, is_deleted)
      VALUES (?, 300, 'Test', date('now'), 1, 0)
    `).run(chantier.lastInsertRowid);

    const result = repo.getEnAttenteValidation(1);
    expect(result.length).toBe(0);
  });
});
