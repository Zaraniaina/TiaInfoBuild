const BaseRepository = require('./BaseRepository');
const db = require('../db');

class DashboardRepository extends BaseRepository {
  constructor() {
    super('Chantier');
  }

  /**
   * Statistiques globales pour le dashboard
   */
  getStats(entrepriseId) {
    const stats = {};

    // Obtenir la devise configurée pour l'entreprise
    const entreprise = db.prepare(
      `SELECT devise, nom FROM Entreprise WHERE id = ?`
    ).get(entrepriseId);
    stats.devise = entreprise?.devise || '€';
    stats.entrepriseNom = entreprise?.nom || 'TIA Construction';

    // Chantiers
    const chantiers = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN statut IN ('en_cours', 'actif') THEN 1 ELSE 0 END) as enCours,
        SUM(CASE WHEN statut IN ('planifie', 'planification') THEN 1 ELSE 0 END) as planifies,
        SUM(CASE WHEN statut = 'termine' THEN 1 ELSE 0 END) as termines,
        SUM(CASE WHEN statut IN ('arrete', 'en_pause') THEN 1 ELSE 0 END) as arretes
      FROM Chantier
      WHERE entrepriseId = ? AND is_deleted = 0
    `).get(entrepriseId);
    stats.chantiers = chantiers;

    // Employés
    const employes = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN statut = 'actif' THEN 1 ELSE 0 END) as actifs,
        SUM(CASE WHEN statut = 'conge' THEN 1 ELSE 0 END) as enConge
      FROM Employe
      WHERE entrepriseId = ? AND is_deleted = 0
    `).get(entrepriseId);
    stats.employes = employes;

    // Stocks - articles en alerte
    const stocksAlerte = db.prepare(`
      SELECT COUNT(*) as count FROM Article
      WHERE entrepriseId = ? AND is_deleted = 0
      AND COALESCE(stockActuel, quantiteStock, 0) <= COALESCE(seuilAlerte, 0)
    `).get(entrepriseId);
    stats.stocksAlerte = stocksAlerte.count;

    // Stocks - valeur totale (utilise quantiteStock directement)
    const stocksValeur = db.prepare(`
      SELECT SUM(quantiteStock * COALESCE(prixUnitaire, 0)) as total 
      FROM Article
      WHERE entrepriseId = ? AND is_deleted = 0
    `).get(entrepriseId);
    stats.stocksValeur = stocksValeur.total || 0;

    // Finances - factures en retard
    const facturesRetard = db.prepare(`
      SELECT COUNT(*) as count, 
             SUM(COALESCE(montantTTC, montant, 0) - COALESCE(montantPaye, 0)) as montantDu
      FROM Facture
      WHERE entrepriseId = ? AND is_deleted = 0
      AND statut IN ('emise', 'envoyee', 'partiellement_payee', 'emis')
      AND dateEcheance < date('now')
    `).get(entrepriseId);
    stats.facturesRetard = facturesRetard;

       // Finances - CA du mois (corrigé : comparaison robuste)
    const now = new Date();
    const annee = now.getFullYear();
    const mois = String(now.getMonth() + 1).padStart(2, '0');
    const periodeMois = `${annee}-${mois}`;
    
    const caMois = db.prepare(`
      SELECT SUM(COALESCE(montantTTC, montant, 0)) as total FROM Facture
      WHERE entrepriseId = ? AND is_deleted = 0
      AND strftime('%Y-%m', dateEmission) = ?
    `).get(entrepriseId, periodeMois);
    stats.caMois = caMois?.total || 0;

    // Dépenses du mois
    const depensesMois = db.prepare(`
      SELECT SUM(montant) as total FROM Depense
      WHERE chantierId IN (SELECT id FROM Chantier WHERE entrepriseId = ? AND is_deleted = 0)
      AND is_deleted = 0
      AND dateDepense >= ?
    `).get(entrepriseId, debutMoisStr);
    stats.depensesMois = depensesMois.total || 0;

    // Alertes non lues
    const alertesNonLues = db.prepare(`
      SELECT COUNT(*) as count FROM Alerte
      WHERE entrepriseId = ? AND is_deleted = 0 AND statut = 'non_lue'
    `).get(entrepriseId);
    stats.alertesNonLues = alertesNonLues.count;

    // Matériels en maintenance
    const materielsMaintenance = db.prepare(`
      SELECT COUNT(DISTINCT m.id) as count
      FROM Materiel m
      JOIN Maintenance mt ON m.id = mt.materielId
      WHERE m.entrepriseId = ? AND m.is_deleted = 0 AND mt.is_deleted = 0
      AND mt.prochaineDateEcheance < date('now')
    `).get(entrepriseId);
    stats.materielsMaintenance = materielsMaintenance.count;

    return stats;
  }

  /**
   * Activité récente
   */
  getActiviteRecente(entrepriseId, limit = 10) {
    const nouveauxChantiers = db.prepare(`
      SELECT 'chantier' as type, id, nom as titre, 'Nouveau chantier' as description,
             created_at as date, 'primary' as couleur
      FROM Chantier
      WHERE entrepriseId = ? AND is_deleted = 0
      ORDER BY created_at DESC
      LIMIT ?
    `).all(entrepriseId, limit);

    const nouveauxDevis = db.prepare(`
      SELECT 'devis' as type, id, COALESCE(numero, 'DEV-' || id) as titre, 'Nouveau devis' as description,
             created_at as date, 'info' as couleur
      FROM Devis
      WHERE entrepriseId = ? AND is_deleted = 0
      ORDER BY created_at DESC
      LIMIT ?
    `).all(entrepriseId, limit);

    const incidents = db.prepare(`
      SELECT 'incident' as type, i.id, i.titre, 'Incident: ' || i.description as description,
             i.dateIncident as date, 'danger' as couleur
      FROM Incident i
      JOIN Chantier c ON i.chantierId = c.id
      WHERE c.entrepriseId = ? AND i.is_deleted = 0 AND c.is_deleted = 0
      AND i.statut IN ('ouvert', 'en_cours', 'signale')
      ORDER BY i.dateIncident DESC
      LIMIT ?
    `).all(entrepriseId, limit);

    const factures = db.prepare(`
      SELECT 'facture' as type, f.id, COALESCE(f.numero, 'FAC-' || f.id) as titre, 'Facture en retard' as description,
             f.dateEcheance as date, 'warning' as couleur
      FROM Facture f
      WHERE f.entrepriseId = ? AND f.is_deleted = 0
      AND f.statut IN ('emise', 'envoyee', 'partiellement_payee', 'emis')
      AND f.dateEcheance < date('now')
      ORDER BY f.dateEcheance
      LIMIT ?
    `).all(entrepriseId, limit);

    const all = [...nouveauxChantiers, ...nouveauxDevis, ...incidents, ...factures];
    all.sort((a, b) => new Date(b.date) - new Date(a.date));
    return all.slice(0, limit);
  }

  /**
   * Évolution CA sur 12 mois
   */
  getCAEvolution(entrepriseId) {
    const stmt = db.prepare(`
      SELECT
        strftime('%Y-%m', dateEmission) as mois,
        SUM(COALESCE(montantTTC, montant, 0)) as ca
      FROM Facture
      WHERE entrepriseId = ? AND is_deleted = 0
      AND dateEmission >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', dateEmission)
      ORDER BY mois
    `);
    return stmt.all(entrepriseId);
  }

  /**
   * Top 5 chantiers par budget
   */
  getTopChantiersBudget(entrepriseId) {
    const stmt = db.prepare(`
      SELECT id, nom, 
             COALESCE(budgetPrevisionnel, budgetPrevu, 0) as budgetPrevisionnel, 
             budgetReel,
             (budgetReel / NULLIF(COALESCE(budgetPrevisionnel, budgetPrevu, 0), 0) * 100) as pctBudget
      FROM Chantier
      WHERE entrepriseId = ? AND is_deleted = 0
      AND COALESCE(budgetPrevisionnel, budgetPrevu, 0) > 0
      ORDER BY budgetPrevisionnel DESC
      LIMIT 5
    `);
    return stmt.all(entrepriseId);
  }
}

module.exports = DashboardRepository;