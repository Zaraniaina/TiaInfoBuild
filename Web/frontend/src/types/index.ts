// Types généraux pour TIA INFO BUILD Web

// ============================================================
// AUTH & USER
// ============================================================

export interface Role {
  id: number;
  nom: string;
  description?: string;
  code: string;
  permissions: Record<string, string>;
  is_system?: boolean;
}

export interface Entreprise {
  id: number;
  nom: string;
  nom_commercial?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  telephone?: string;
  email?: string;
  logo?: string;
  abonnement: string;
  devise: string;
  siret?: string;
  numero_tva?: string;
  code_ape?: string;
  site_web?: string;
  prefixe_devis: string;
  prefixe_facture: string;
  prefixe_contrat: string;
  tva_defaut: number;
  delai_paiement_defaut: number;
  validite_devis: number;
  mentions_legales?: string;
  actif: boolean;
  date_creation: string;
  created_at: string;
  updated_at: string;
}

export interface Utilisateur {
  id: number;
  entreprise_id?: number;
  role_id: number;
  role: Role;
  nom: string;
  prenom?: string;
  email: string;
  telephone?: string;
  statut: string;
  date_creation: string;
  derniere_connexion?: string;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: Utilisateur;
}

// ============================================================
// CHANTIERS
// ============================================================

export type StatutChantier =
  "planification" | "en_cours" | "suspendu" | "termine" | "annule";
export type StatutPhase = "non_commencee" | "en_cours" | "terminee" | "bloquee";
export type GraviteIncident = "faible" | "moyenne" | "elevee" | "critique";

export interface Chantier {
  id: number;
  entreprise_id: number;
  client_id?: number;
  chef_chantier_id?: number;
  numero?: string;
  nom: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  date_debut?: string;
  date_fin_prevue?: string;
  date_fin_reelle?: string;
  budget_prevu: number;
  budget_previsionnel: number;
  budget_reel: number;
  marge_cible: number;
  tva: number;
  statut: StatutChantier;
  description?: string;
  phases?: Phase[];
  incidents?: Incident[];
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Phase {
  id: number;
  chantier_id: number;
  nom: string;
  description?: string;
  date_debut?: string;
  date_fin?: string;
  budget: number;
  avancement_pct: number;
  statut: StatutPhase;
  ordre: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: number;
  chantier_id: number;
  declare_par?: number;
  titre: string;
  description?: string;
  date_incident: string;
  gravite: GraviteIncident;
  statut: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface AffectationRessource {
  id: number;
  chantier_id: number;
  type_ressource: "employe" | "materiel";
  ressource_id: number;
  date_debut?: string;
  date_fin?: string;
  role?: string;
  is_deleted: boolean;
}

// ============================================================
// RH
// ============================================================

export type TypeContrat =
  | "CDI"
  | "CDD"
  | "INTERIM"
  | "STAGE"
  | "APPRENTISSAGE"
  | "JOURNALIER"
  | "SAISONNIER";
export type StatutEmploye = "actif" | "inactif" | "suspendu";
export type TypePointage =
  "present" | "absence_justifiee" | "absence_injustifiee" | "maladie" | "conge";
export type StatutHeureSup = "en_attente" | "validee" | "refusee";
export type TypeCompensation = "paiement" | "repos";

export interface Employe {
  id: number;
  entreprise_id: number;
  matricule?: string;
  nom: string;
  prenom?: string;
  poste?: string;
  photo?: string;
  date_embauche?: string;
  type_contrat: TypeContrat;
  date_debut_contrat?: string;
  date_fin_contrat?: string;
  salaire_base: number;
  telephone?: string;
  email?: string;
  adresse?: string;
  statut: StatutEmploye;
  code_qr_badge?: string;
  historique_postes?: HistoriquePoste[];
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface HistoriquePoste {
  id: number;
  entreprise_id: number;
  employe_id: number;
  poste: string;
  type_contrat?: TypeContrat;
  salaire_base: number;
  date_debut: string;
  date_fin?: string;
  motif_changement?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Equipe {
  id: number;
  entreprise_id: number;
  chef_equipe_id?: number;
  nom: string;
  description?: string;
  specialite?: string;
  date_creation: string;
  statut: string;
  membres?: MembreEquipe[];
  chantiers?: AffectationChantier[];
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface MembreEquipe {
  id: number;
  equipe_id: number;
  employe_id: number;
  date_debut: string;
  date_fin?: string;
  role?: string;
  is_deleted: boolean;
}

export interface AffectationChantier {
  id: number;
  employe_id: number;
  chantier_id: number;
  date_debut?: string;
  date_fin?: string;
  role?: string;
  is_deleted: boolean;
}

export interface Pointage {
  id: number;
  entreprise_id: number;
  employe_id: number;
  chantier_id?: number;
  date_jour: string;
  heure_debut?: string;
  heure_fin?: string;
  heures_total: number;
  type: TypePointage;
  notes?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface HeureSupplementaire {
  id: number;
  entreprise_id: number;
  employe_id: number;
  chantier_id?: number;
  date_hs: string;
  nb_heures: number;
  taux_majoration: number;
  motif?: string;
  statut: StatutHeureSup;
  type_compensation: TypeCompensation;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// STOCKS
// ============================================================

export interface CategorieArticle {
  id: number;
  nom: string;
  count: number;
}

export interface Fournisseur {
  id: number;
  entreprise_id: number;
  nom: string;
  contact?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  pays?: string;
  siret?: string;
  conditions_paiement?: string;
  notes?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: number;
  entreprise_id: number;
  reference: string;
  nom: string;
  description?: string;
  categorie?: string;
  unite: string;
  stock_actuel: number;
  seuil_alerte: number;
  stock_mini: number;
  prix_achat: number;
  prix_vente: number;
  marge: number;
  tva: number;
  poids?: number;
  fournisseur_id?: number;
  code_barre?: string;
  emplacement?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export type TypeMouvement =
  "entree" | "sortie" | "inventaire" | "retour" | "perte";

export interface MouvementStock {
  id: number;
  entreprise_id: number;
  article_id: number;
  type_mouvement: TypeMouvement;
  date_mouvement: string;
  quantite: number;
  prix_unitaire: number;
  chantier_id?: number;
  fournisseur_id?: number;
  reference?: string;
  notes?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// COMMERCIAL
// ============================================================

export type TypeClient = "particulier" | "entreprise" | "administration_publique" | "association" | "ong" | "promoteur_immobilier";
export type StatutDevis =
  "brouillon" | "envoye" | "accepte" | "refuse" | "expire";
export type StatutContrat = "en_cours" | "termine" | "resilié";
export type TypeFacture = "standard" | "acompte" | "solde" | "avoir";
export type StatutFacture =
  "emis" | "envoye" | "payee" | "partiellement_payee" | "en_retard" | "annule";

export interface Client {
  id: number;
  entreprise_id: number;
  type: TypeClient;
  civilite?: string;
  nom: string;
  prenom?: string;
  entreprise?: string;
  siret?: string;
  numero_tva?: string;
  email?: string;
  telephone?: string;
  portable?: string;
  site_web?: string;
  adresse?: string;
  adresse_complement?: string;
  code_postal?: string;
  ville?: string;
  pays?: string;
  conditions_paiement?: string;
  mode_paiement?: string;
  encours_max: number;
  encours_actuel: number;
  commercial_id?: number;
  origine?: string;
  rib?: string;
  notes?: string;
  ca_total: number;
  dernier_contact?: string;
  adresses?: ClientAdresse[];
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientAdresse {
  id: number;
  client_id: number;
  type: "facturation" | "livraison" | "chantier" | "autre";
  defaut: boolean;
  ligne1: string;
  ligne2?: string;
  code_postal?: string;
  ville?: string;
  pays?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Devis {
  id: number;
  entreprise_id: number;
  client_id: number;
  numero: string;
  objet?: string;
  lignes?: LigneDevis[];
  montant_ht: number;
  tva: number;
  montant_ttc: number;
  date_creation: string;
  date_validite?: string;
  statut: StatutDevis;
  conditions_paiement?: string;
  mode_paiement?: string;
  notes?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface LigneDevis {
  id: number;
  devis_id: number;
  type: string;
  article_id?: number;
  description: string;
  categorie?: string;
  quantite: number;
  unite?: string;
  prix_unitaire: number;
  remise: number;
  taux_tva: number;
  total_ht: number;
  total_ttc: number;
  ordre: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contrat {
  id: number;
  entreprise_id: number;
  client_id: number;
  reference: string;
  type_contrat?: string;
  montant: number;
  date_debut?: string;
  date_fin?: string;
  statut: StatutContrat;
  chantier_id?: number;
  devis_id?: number;
  objet?: string;
  conditions_paiement?: string;
  date_signature?: string;
  garantie_mois: number;
  notes?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Facture {
  id: number;
  entreprise_id: number;
  contrat_id?: number;
  client_id: number;
  numero: string;
  type: TypeFacture;
  lignes?: LigneFacture[];
  montant_ht: number;
  tva: number;
  montant_tva: number;
  montant_ttc: number;
  montant_acompte_deduit: number;
  montant_paye: number;
  reste_a_payer: number;
  date_creation: string;
  date_emission?: string;
  date_echeance?: string;
  statut: StatutFacture;
  conditions_paiement?: string;
  mode_paiement?: string;
  notes?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface LigneFacture {
  id: number;
  facture_id: number;
  type: string;
  article_id?: number;
  description: string;
  categorie?: string;
  quantite: number;
  unite?: string;
  prix_unitaire: number;
  remise: number;
  taux_tva: number;
  total_ht: number;
  total_ttc: number;
  ordre: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Paiement {
  id: number;
  entreprise_id: number;
  facture_id: number;
  montant: number;
  date_paiement: string;
  mode_paiement?: string;
  reference?: string;
  banque?: string;
  notes?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Avenant {
  id: number;
  entreprise_id: number;
  contrat_id: number;
  numero: string;
  description?: string;
  impact_montant: number;
  date_signature?: string;
  statut: string;
  fichier_url?: string;
  notes?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// FINANCE
// ============================================================

export type StatutDepense = "en_attente" | "validee" | "refusee";

export interface Depense {
  id: number;
  entreprise_id: number;
  chantier_id?: number;
  description: string;
  montant: number;
  date_depense: string;
  categorie?: string;
  statut: StatutDepense;
  fournisseur?: string;
  taux_tva: number;
  numero_facture?: string;
  mode_paiement?: string;
  validee_par?: number;
  notes?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface RapportFinancier {
  id: number;
  entreprise_id: number;
  chantier_id?: number;
  periode: string;
  chiffre_affaires: number;
  depenses_total: number;
  marge: number;
  date_generation: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// MATERIALS
// ============================================================

export type StatutMateriel =
  "disponible" | "en_utilisation" | "en_maintenance" | "hors_service";
export type TypeMateriel = "engin" | "outil" | "vehicule";

export interface Materiel {
  id: number;
  entreprise_id: number;
  nom: string;
  designation?: string;
  type?: TypeMateriel;
  marque?: string;
  modele?: string;
  numero_serie?: string;
  date_acquisition?: string;
  valeur_achat: number;
  description?: string;
  statut: StatutMateriel;
  maintenances?: Maintenance[];
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Maintenance {
  id: number;
  entreprise_id: number;
  materiel_id: number;
  date_maintenance: string;
  type?: string;
  cout: number;
  description?: string;
  prochaine_date_echeance?: string;
  technicien?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlerteMateriel {
  id: number;
  entreprise_id: number;
  materiel_id: number;
  type?: string;
  message: string;
  date_alerte: string;
  statut: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// ALERTES
// ============================================================

export type NiveauGravite =
  "info" | "faible" | "moyenne" | "elevee" | "critique";
export type StatutAlerte = "non_lue" | "lue";

export interface Alerte {
  id: number;
  entreprise_id: number;
  titre: string;
  message: string;
  type_entite?: string;
  entite_id?: number;
  niveau_gravite: NiveauGravite;
  statut: StatutAlerte;
  lue: boolean;
  date_lecture?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// HISTORIQUE CONNEXIONS
// ============================================================

export interface HistoriqueConnexion {
  id: number;
  utilisateur_id: number;
  ip_address?: string;
  user_agent?: string;
  reussi: boolean;
  date_connexion: string;
}

// ============================================================
// DASHBOARD / STATS
// ============================================================

export interface DashboardStats {
  ca_total: number;
  ca_mois: number;
  depenses_mois: number;
  margin_net: number;
  factures_en_retard: number;
  factures_retard: number;
  devis_pending_dg: number;
  nb_chantiers_actifs: number;
  nb_employes: number;
  nb_articles: number;
  nb_clients: number;
  nb_devis: number;
  nb_materiels: number;
  stocks_alerte: number;
  attendance_rate: number;
  maintenance_due: number;
  top_chantiers: TopChantier[];
  ca_evolution: CAEvolution[];
  alertes_recentes: Alerte[];
  activite_recente: ActiviteRecent[];
  nb_utilisateurs?: number;
  utilisateurs_inactifs?: number;
  uptime?: number;
  alertes_critiques?: number;
  marge_brute?: number;
  marge_nette?: number;
  taux_avancement_physique?: number;
  taux_avancement_financier?: number;
  rentabilite_chantiers?: Array<{
    id: number;
    nom: string;
    ca: number;
    depenses: number;
    budget_prevu: number;
    marge: number;
    taux_marge: number;
    taux_avancement?: number;
  }>;
  depassements_budgetaires?: number;
  delai_moyen_paiement?: number;
  tresorerie_par_client?: Array<{
    client_id: number;
    nom: string;
    entreprise: string;
    encours: number;
  }>;
  rapports_disponibles?: number;
  nb_incidents?: number;
  incidents_non_resolus?: number;
  retard_jours?: number;
  consommation_stock?: number;
  ecart_stock?: number;
  nb_alertes_chantier?: number;
}

export interface TopChantier {
  id: number;
  nom: string;
  ca_total: number;
  budget_prevu: number;
  budget_reel: number;
  marge: number;
}

export interface CAEvolution {
  mois: string;
  ca: number;
  depenses: number;
}

export interface ActiviteRecent {
  id: number;
  type: string;
  description: string;
  date: string;
  utilisateur?: string;
}

export interface SuperAdminStats {
  total_entreprises: number;
  total_utilisateurs: number;
  total_chantiers: number;
  ca_total: number;
  entreprises_actives: number;
  abonnements: Record<string, number>;
  nouveaux_utilisateurs_mois?: number;
  uptime?: number;
  revenu_mensuel?: number;
  incidents_critiques?: number;
  demandes_support?: number;
  entreprises_inactives?: number;
  factures_en_retard?: number;
  total_paiements?: number;
}

// ============================================================
// API GENERIQUES
// ============================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: Utilisateur;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

export type TypeContratEmploye =
  | "CDI"
  | "CDD"
  | "INTERIM"
  | "STAGE"
  | "APPRENTISSAGE"
  | "JOURNALIER"
  | "SAISONNIER";

export type User = Utilisateur;

// ============================================================
// DASHBOARD CHARTS
// ============================================================

export interface ChartSeries {
  labels: string[];
  data: number[];
}

export interface ChartMultiSeries {
  labels: string[];
  datasets: Array<Record<string, unknown>>;
}

export interface TenantsEvolutionResponse {
  labels: string[];
  data: number[];
  croissance: number;
}

export interface DashboardChartsResponse {
  ca_evolution?: { labels: string[]; ca: number[]; depenses: number[] };
  connexions_par_jour?: { labels: string[]; data: number[] };
  depenses_par_poste?: { labels: string[]; data: number[] };
  top_chantiers?: { labels: string[]; avancement: number[]; budget: number[] };
  presence_hebdo?: { labels: string[]; data: number[] };
  effectif_par_poste?: { labels: string[]; data: number[] };
  parc_utilisation?: { labels: string[]; data: number[] };
  stock_par_categorie?: { labels: string[]; data: number[] };
  pipeline_commercial?: { labels: string[]; data: number[] };
}

// ============================================================
// SUBSCRIPTIONS
// ============================================================

export interface Plan {
  id: number;
  nom: string;
  code: string;
  description?: string;
  prix_mensuel: number;
  prix_annuel: number;
  utilisateurs_max: number;
  chantiers_max: number;
  stockage_go: number;
  duree_essai_jours: number;
  actif: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Subscription {
  id: number;
  entreprise_id: number;
  plan_id: number;
  date_debut?: string;
  date_fin?: string;
  date_prochain_renouvellement?: string;
  statut: string;
  mode_paiement?: string;
  prix_paye?: number;
  periode?: string;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SubscriptionWithPlan extends Subscription {
  plan?: Plan;
}
