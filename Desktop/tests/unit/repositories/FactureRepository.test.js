const db = require('../../../models/db');
const FactureRepository = require('../../../models/repositories/FactureRepository');

describe('FactureRepository', () => {
  let repo;

  beforeEach(() => {
    repo = new FactureRepository();
    db.prepare('DELETE FROM Paiement').run();
    db.prepare('DELETE FROM Facture').run();
    db.prepare("INSERT OR IGNORE INTO Contrat (id, entrepriseId, devisId, chantierId, statut, is_deleted) VALUES (1, 1, NULL, NULL, 'brouillon', 0)").run();
  });

  test('ajouterPaiement met à jour le statut en partiellement_payee', () => {
    const facture = db.prepare(`
      INSERT INTO Facture (entrepriseId, contratId, montant, montantTTC, statut, is_deleted)
      VALUES (1, 1, 1000, 1000, 'emis', 0)
    `).run();

    const paiement = repo.ajouterPaiement(facture.lastInsertRowid, {
      montant: 300,
      modePaiement: 'virement',
      datePaiement: new Date().toISOString().split('T')[0]
    });

    expect(paiement.statut).toBe('partiellement_payee');
    expect(paiement.totalPaye).toBe(300);
    expect(paiement.resteAPayer).toBe(700);
  });

  test('ajouterPaiement met à jour le statut en payee quand total atteint', () => {
    const facture = db.prepare(`
      INSERT INTO Facture (entrepriseId, contratId, montant, montantTTC, statut, is_deleted)
      VALUES (1, 1, 1000, 1000, 'emis', 0)
    `).run();

    const paiement = repo.ajouterPaiement(facture.lastInsertRowid, {
      montant: 1000,
      modePaiement: 'virement',
      datePaiement: new Date().toISOString().split('T')[0]
    });

    expect(paiement.statut).toBe('paye');
    expect(paiement.estPayee).toBe(true);
  });

  test('ajouterPaiement rejette une facture inexistante', () => {
    expect(() => {
      repo.ajouterPaiement(9999, { montant: 100 });
    }).toThrow('Facture non trouvée');
  });
});
