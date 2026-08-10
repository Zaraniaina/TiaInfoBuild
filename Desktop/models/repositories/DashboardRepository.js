// Desktop/models/repositories/DashboardRepository.js
const BaseRepository = require('./BaseRepository');
const db = require('../db');

class DashboardRepository extends BaseRepository {
  constructor() {
    super('Chantier');
  }

  /**
   * Statistiques globales pour le dashboard (inclut la devise de l'entreprise)
   */
  getStats(entrepriseId) {
    const stats = {};

    // Obtenir la devise configurée pour l'entreprise
    const entreprise = db.prepare(`SELECT devise, nom FROM Entreprise WHERE id = ?`).get(entrepriseId);
    stats.devise = entreprise?.devise || 'MGA';
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

    // Stocks - valeur totale
    const stocksValeur = db.prepare(`
      SELECT SUM(COALESCE(stockActuel, quantiteStock, 0) * COALESCE(prixUnitaire, 0)) as total FROM Article
      WHERE entrepriseId = ? AND is_deleted = 0
    `).get(entrepriseId);
    stats.stocksValeur = stocksValeur.total || 0;

    // Finances - factures en retard
    const facturesRetard = db.prepare(`
      SELECT COUNT(*) as count, SUM(COALESCE(montantTTC, montant, 0) - COALESCE(montantPaye, 0)) as montantDu
      FROM Facture
      WHERE entrepriseId = ? AND is_deleted = 0
      AND statut IN ('emise', 'envoyee', 'partiellement_payee', 'emis')
      AND dateEcheance < date('now')
    `).get(entrepriseId);
    stats.facturesRetard = facturesRetard;

    // Finances - CA du mois
    const debutMois = new Date();
    debutMois.setDate(1);
    const debutMoisStr = debutMois.toISOString().split('T')[0];

    const caMois = db.prepare(`
      SELECT SUM(COALESCE(montantTTC, montant, 0)) as total FROM Facture
      WHERE entrepriseId = ? AND is_deleted = 0
      AND dateEmission >= ?
    `).get(entrepriseId, debutMoisStr);
    stats.caMois = caMois.total || 0;

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
            SELECT id, nom, COALESCE(budgetPrevisionnel, budgetPrevu, 0) as budgetPrevisionnel, budgetReel,
                (budgetReel / NULLIF(COALESCE(budgetPrevisionnel, budgetPrevu, 0), 0) * 100) as pctBudget
            FROM Chantier
            WHERE entrepriseId = ? AND is_deleted = 0
            AND COALESCE(budgetPrevisionnel, budgetPrevu, 0) > 0
            ORDER BY budgetPrevisionnel DESC
            LIMIT 5
        `);
        return stmt.all(entrepriseId);
    }

    /**
     * Factures en retard pour le dashboard
     */
    getFacturesRetard(entrepriseId) {
        const stmt = db.prepare(`
            SELECT f.id, f.numero, f.dateEcheance, f.montantTTC, f.montantPaye,
                (COALESCE(f.montantTTC, f.montant, 0) - COALESCE(f.montantPaye, 0)) as montantDu,
                c.nom as clientNom
            FROM Facture f
            LEFT JOIN Client c ON f.clientId = c.id
            WHERE f.entrepriseId = ? AND f.is_deleted = 0
            AND f.statut IN ('emise', 'envoyee', 'partiellement_payee', 'emis')
            AND f.dateEcheance < date('now')
            ORDER BY f.dateEcheance ASC
            LIMIT 10
        `);
        return stmt.all(entrepriseId);
    }

    /**
     * Statistiques spécifiques RH
     */
    getRHStats(entrepriseId) {
        const stats = {};
        
        // Pointages par type (pour le mois en cours)
        const debutMois = new Date();
        debutMois.setDate(1);
        const debutMoisStr = debutMois.toISOString().split('T')[0];

        stats.pointagesMois = db.prepare(`
            SELECT type, COUNT(*) as count 
            FROM Pointage 
            WHERE employeId IN (SELECT id FROM Employe WHERE entrepriseId = ? AND is_deleted = 0)
            AND dateJour >= ? 
            GROUP BY type
        `).all(entrepriseId, debutMoisStr);

        // Heures supplémentaires en attente
        stats.heuresSupAttente = db.prepare(`
            SELECT COUNT(*) as count, SUM(nbHeures) as totalHeures 
            FROM HeureSupplementaire 
            WHERE employeId IN (SELECT id FROM Employe WHERE entrepriseId = ? AND is_deleted = 0)
            AND statut = 'en_attente'
        `).get(entrepriseId);

        return stats;
    }

    /**
     * Statistiques spécifiques Commercial
     */
    getCommercialStats(entrepriseId) {
        const stats = {};

        // Devis par statut (Accepté, Refusé, Envoyé, Brouillon)
        stats.devisParStatut = db.prepare(`
            SELECT statut, COUNT(*) as count, SUM(COALESCE(montantTTC, 0)) as totalTTC
            FROM Devis
            WHERE entrepriseId = ? AND is_deleted = 0
            GROUP BY statut
        `).all(entrepriseId);

        // Nouveaux clients du mois
        const debutMois = new Date();
        debutMois.setDate(1);
        const debutMoisStr = debutMois.toISOString().split('T')[0];

        stats.nouveauxClients = db.prepare(`
            SELECT COUNT(*) as count 
            FROM Client
            WHERE entrepriseId = ? AND is_deleted = 0
            AND created_at >= ?
        `).get(entrepriseId, debutMoisStr).count;

        return stats;
    }

    /**
     * Statistiques spécifiques Logistique / Matériel
     */
    getLogistiqueStats(entrepriseId) {
        const stats = {};

        // Répartition des états de matériels
        stats.materielsParEtat = db.prepare(`
            SELECT etat, COUNT(*) as count 
            FROM Materiel
            WHERE entrepriseId = ? AND is_deleted = 0
            GROUP BY etat
        `).all(entrepriseId);

        // Top 5 articles les plus consommés (Mouvements de sortie)
        stats.topArticlesConsommes = db.prepare(`
            SELECT a.designation, SUM(m.quantite) as quantiteSortie
            FROM MouvementStock m
            JOIN Article a ON m.articleId = a.id
            WHERE a.entrepriseId = ? AND m.type = 'sortie' AND m.is_deleted = 0
            GROUP BY a.id, a.designation
            ORDER BY quantiteSortie DESC
            LIMIT 5
        `).all(entrepriseId);

        return stats;
    }
}

module.exports = DashboardRepository;