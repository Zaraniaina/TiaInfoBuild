// Desktop/models/repositories/DevisRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class DevisRepository extends BaseRepository {
  constructor() {
    super('Devis');
  }

  /**
   * Récupérer un devis avec ses lignes
   * @param {number} id - ID devis
   * @returns {Object|null} - Devis avec lignes et client
   */
  getWithLignes(id) {
    const devis = this.getById(id);
    if (!devis) return null;

    const lignes = db.prepare(`
      SELECT * FROM LigneDevis
      WHERE devisId = ? AND is_deleted = 0
      ORDER BY id
    `).all(id);

    // Client
    const client = devis.clientId
      ? db.prepare('SELECT * FROM Client WHERE id = ? AND is_deleted = 0').get(devis.clientId)
      : null;

    // Chantier
    let chantier = null;
    if (devis.chantierId) {
      chantier = db.prepare('SELECT * FROM Chantier WHERE id = ? AND is_deleted = 0').get(devis.chantierId);
    }

    return { ...devis, lignes, client, chantier };
  }

  /**
   * Créer un devis avec ses lignes (transaction)
   * @param {Object} data - { clientId, dateValidite, lignes: [{ description, quantite, prixUnitaire }] }
   * @param {number} entrepriseId - ID entreprise
   * @returns {Object} - Devis créé
   */
  createWithLignes(data, entrepriseId) {
    const { lignes, ...devisData } = data;

    return db.transaction(() => {
      // Calculer montant total
      const montantTotal = (lignes || []).reduce((sum, l) => sum + (l.quantite || 0) * (l.prixUnitaire || 0), 0);

      // Créer le devis
      const devis = this.create({
        ...devisData,
        entrepriseId,
        montantTotal,
        statut: 'brouillon',
        dateCreation: new Date().toISOString().split('T')[0]
      }, entrepriseId);

      // Créer les lignes
      const ligneRepo = require('./LigneDevisRepository');
      const ligneRepoInstance = new ligneRepo();
      for (const ligne of (lignes || [])) {
        ligneRepoInstance.create({
          devisId: devis.id,
          description: ligne.description || '',
          reference: ligne.reference || ligne.description || '',
          type: ligne.type || 'produit',
          articleId: ligne.articleId || null,
          quantite: ligne.quantite || 0,
          prixUnitaire: ligne.prixUnitaire || 0,
          tauxTVA: ligne.tauxTVA || 0,
          remise: ligne.remise || 0,
          unite: ligne.unite || '',
          ligneTotal: ligne.ligneTotal || 0,
          ligneTotalTTC: ligne.ligneTotalTTC || 0
        });
      }

      return this.getWithLignes(devis.id);
    });
  }

   /**
    * Mettre à jour un devis avec ses lignes (transaction)
    * @param {number} id - ID devis
    * @param {Object} data - { clientId, lignes: [...], ... }
    * @returns {Object} - Devis mis à jour avec lignes
    */
  updateWithLignes(id, data) {
    const { lignes, ...devisData } = data;

    return db.transaction(() => {
      const ligneRepo = require('./LigneDevisRepository');
      const ligneRepoInstance = new ligneRepo();

      if (Array.isArray(lignes)) {
        const existing = ligneRepoInstance.getByDevis(id);
        existing.forEach(l => ligneRepoInstance.delete(l.id));
        for (const ligne of lignes) {
          ligneRepoInstance.create({
            devisId: id,
            description: ligne.description || '',
            quantite: ligne.quantite || 0,
            prixUnitaire: ligne.prixUnitaire || 0,
            tauxTVA: ligne.tauxTVA || 0,
            remise: ligne.remise || 0,
            unite: ligne.unite || '',
            reference: ligne.reference || '',
            type: ligne.type || 'produit',
            articleId: ligne.articleId || null,
            ligneTotal: ligne.ligneTotal || 0,
            ligneTotalTTC: ligne.ligneTotalTTC || 0
          });
        }
      }

      const montantTotal = (lignes || []).reduce((sum, l) => sum + (l.quantite || 0) * (l.prixUnitaire || 0), 0);

      this.update(id, { ...devisData, montantTotal });

      return this.getWithLignes(id);
    });
  }

  /**
    * Transformer un devis en contrat
   * @param {number} devisId - ID du devis
   * @param {Object} contratData - Données du contrat
   * @returns {Object} - Contrat créé
   */
  transformerEnContrat(devisId, contratData) {
    const devis = this.getById(devisId);
    if (!devis) throw new Error('Devis non trouvé');
    if (devis.statut !== 'accepte') throw new Error('Le devis doit être accepté');

    const contratRepo = require('./ContratRepository');
    return new contratRepo().create({
      ...contratData,
      devisId,
      montant: devis.montantTotal,
      statut: 'en_cours'
    });
  }

  /**
   * Suppression logique d'un devis
   */
  delete(id) {
    return this.softDelete(id);
  }
}

module.exports = DevisRepository;