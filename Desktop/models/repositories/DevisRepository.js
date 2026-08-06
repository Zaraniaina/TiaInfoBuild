const BaseRepository = require('./BaseRepository');
const db = require('../db');

class DevisRepository extends BaseRepository {
  constructor() {
    super('Devis');
  }

  getWithLignes(id) {
    const devis = this.getById(id);
    if (!devis) return null;
    const lignes = db.prepare(`SELECT * FROM LigneDevis WHERE devisId = ? AND is_deleted = 0 ORDER BY id`).all(id);
    const client = devis.clientId ? db.prepare('SELECT * FROM Client WHERE id = ? AND is_deleted = 0').get(devis.clientId) : null;
    return { ...devis, lignes, client };
  }

  createWithLignes(data, entrepriseId) {
    const { lignes, ...devisData } = data;

    // ⚠️ CORRECTION CRITIQUE : ajout du () pour exécuter la transaction
    return db.transaction(() => {
      const montantTotal = (lignes || []).reduce(
        (sum, l) => sum + (l.quantite || 0) * (l.prixUnitaire || 0), 0
      );

      let devis = this.create({
        ...devisData,
        entrepriseId,
        montantTotal,
        statut: 'brouillon',
        dateCreation: new Date().toISOString().split('T')[0]
      }, entrepriseId);

      const ent = db.prepare('SELECT prefixeDevis, validiteDevis FROM Entreprise WHERE id = ?').get(entrepriseId);
      const numero = devis.numero || `${ent?.prefixeDevis || 'DEV'}-${new Date().getFullYear()}-${String(devis.id).padStart(4, '0')}`;
      
      let dateValidite = devisData.dateValidite;
      if (!dateValidite) {
        const d = new Date();
        d.setDate(d.getDate() + (parseInt(ent?.validiteDevis, 10) || 30));
        dateValidite = d.toISOString().split('T')[0];
      }
      devis = this.update(devis.id, { numero, dateValidite });

      const LigneDevisRepository = require('./LigneDevisRepository');
      const ligneRepoInstance = new LigneDevisRepository();
      for (const ligne of (lignes || [])) {
        ligneRepoInstance.create({
          devisId: devis.id,
          description: ligne.description,
          quantite: ligne.quantite || 0,
          prixUnitaire: ligne.prixUnitaire || 0
        });
      }

      return this.getWithLignes(devis.id);
    })(); // <--- LE () ICI EST OBLIGATOIRE
  }

  transformerEnContrat(devisId, contratData) {
    const devis = this.getById(devisId);
    if (!devis) throw new Error('Devis non trouvé');
    if (devis.statut !== 'accepte') throw new Error('Le devis doit être accepté');

    const ContratRepository = require('./ContratRepository');
    return new ContratRepository().create({
      ...contratData,
      devisId,
      entrepriseId: contratData?.entrepriseId || devis.entrepriseId,
      montant: devis.montantTotal,
      statut: 'en_cours'
    });
  }
}

module.exports = DevisRepository;