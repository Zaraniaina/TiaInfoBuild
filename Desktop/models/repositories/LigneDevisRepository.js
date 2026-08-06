// Desktop/models/repositories/LigneDevisRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class LigneDevisRepository extends BaseRepository {
  constructor() {
    super('LigneDevis');
  }

  /**
   * Récupérer les lignes d'un devis
   * @param {number} devisId - ID devis
   * @returns {Array} - Lignes du devis
   */
  getByDevis(devisId) {
    const stmt = db.prepare(`
      SELECT * FROM LigneDevis
      WHERE devisId = ? AND is_deleted = 0
      ORDER BY id
    `);
    return stmt.all(devisId);
  }

  /**
   * Calculer le total d'un devis
   * @param {number} devisId - ID devis
   * @returns {number} - Montant total
   */
  calculerTotal(devisId) {
    const lignes = this.getByDevis(devisId);
    return lignes.reduce((sum, l) => sum + (l.quantite || 0) * (l.prixUnitaire || 0), 0);
  }

  /**
   * Ajouter une ligne à un devis
   * @param {number} devisId - ID devis
   * @param {Object} ligneData - { description, quantite, prixUnitaire }
   * @returns {Object} - Ligne créée
   */
  ajouterLigne(devisId, ligneData) {
    return this.create({
      devisId,
      description: ligneData.description || '',
      quantite: ligneData.quantite || 0,
      prixUnitaire: ligneData.prixUnitaire || 0
    });
  }

  /**
   * Mettre à jour plusieurs lignes (remplacement complet)
   * @param {number} devisId - ID devis
   * @param {Array} lignes - Tableau de { id?, description, quantite, prixUnitaire }
   * @returns {Array} - Lignes finales
   */
  remplacerLignes(devisId, lignes) {
    return db.transaction(() => {
      // Soft delete anciennes lignes
      db.prepare('UPDATE LigneDevis SET is_deleted = 1, is_synced = 0 WHERE devisId = ? AND is_deleted = 0')
        .run(devisId);

      // Créer nouvelles lignes
      const nouvelles = lignes.map(l => this.create({
        devisId,
        description: l.description || '',
        quantite: l.quantite || 0,
        prixUnitaire: l.prixUnitaire || 0
      }));

      return nouvelles;
    });
  }
}

module.exports = LigneDevisRepository;