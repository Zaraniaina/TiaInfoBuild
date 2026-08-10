// Desktop/models/repositories/HistoriquePosteRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class HistoriquePosteRepository extends BaseRepository {
  constructor() {
    super('HistoriquePoste');
  }

  /**
   * Obtenir l'historique complet des postes d'un employé
   */
  getByEmploye(employeId) {
    return db.prepare(`
      SELECT * FROM HistoriquePoste
      WHERE employeId = ? AND is_deleted = 0
      ORDER BY dateDebut DESC
    `).all(employeId);
  }

  /**
   * Obtenir le poste actuel (sans dateFin)
   */
  getPosteActuel(employeId) {
    return db.prepare(`
      SELECT * FROM HistoriquePoste
      WHERE employeId = ? AND is_deleted = 0 AND dateFin IS NULL
      ORDER BY dateDebut DESC
      LIMIT 1
    `).get(employeId) || null;
  }

  /**
   * Changer le poste d'un employé :
   *  - Ferme le poste actuel (dateFin = dateDebut du nouveau - 1 jour)
   *  - Crée un nouveau poste (dateFin = NULL)
   * @param {number} employeId
   * @param {Object} data - { poste, typeContrat, salaireBase, dateDebut, motifChangement, entrepriseId }
   */
  changerPoste(employeId, data) {
    const { poste, typeContrat, salaireBase, dateDebut, motifChangement, entrepriseId } = data;

    if (!poste || !dateDebut) throw new Error('Poste et date de début sont obligatoires');

    return db.transaction(() => {
      // Fermer le poste actuel
      db.prepare(`
        UPDATE HistoriquePoste
        SET dateFin = date(?, '-1 day'), is_synced = 0, updated_at = CURRENT_TIMESTAMP
        WHERE employeId = ? AND dateFin IS NULL AND is_deleted = 0
      `).run(dateDebut, employeId);

      // Créer le nouveau poste
      const info = db.prepare(`
        INSERT INTO HistoriquePoste
          (entrepriseId, employeId, poste, typeContrat, salaireBase, dateDebut, dateFin, motifChangement)
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
      `).run(
        entrepriseId,
        employeId,
        poste.trim(),
        typeContrat || 'CDI',
        parseFloat(salaireBase) || 0,
        dateDebut,
        motifChangement || null
      );

      return db.prepare('SELECT * FROM HistoriquePoste WHERE id = ?').get(info.lastInsertRowid);
    })();
  }

  /**
   * Créer un premier enregistrement lors de l'embauche
   */
  creerPremierPoste(employeId, data) {
    const { poste, typeContrat, salaireBase, dateDebut, entrepriseId } = data;
    const stmt = db.prepare(`
      INSERT INTO HistoriquePoste
        (entrepriseId, employeId, poste, typeContrat, salaireBase, dateDebut)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      entrepriseId,
      employeId,
      (poste || 'Ouvrier').trim(),
      typeContrat || 'CDI',
      parseFloat(salaireBase) || 0,
      dateDebut || new Date().toISOString().split('T')[0]
    );
    return db.prepare('SELECT * FROM HistoriquePoste WHERE id = ?').get(info.lastInsertRowid);
  }
}

module.exports = HistoriquePosteRepository;
