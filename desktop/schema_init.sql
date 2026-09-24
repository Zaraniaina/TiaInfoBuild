-- Généré par tools/gen_sqlite_schema.py — source de vérité : Web/backend app/models. Ne pas éditer à la main.
-- Date de génération : 24/09/2026 09:09
-- Tables backend : 65 · Tables sync desktop : 4 (UNION manuelle, voir la fin du fichier)
-- Régénérer : python tools/gen_sqlite_schema.py --out desktop/schema_init.sql --force
-- Note : cycles de FK non ordonnables (clients ↔ utilisateurs) — sans impact sous SQLite, qui ne valide les FK qu'à l'INSERT.

-- Table « clients »
CREATE TABLE IF NOT EXISTS "clients" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'particulier',
    "civilite" TEXT,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "entreprise" TEXT,
    "siret" TEXT,
    "numero_tva" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "portable" TEXT,
    "site_web" TEXT,
    "photo" TEXT,
    "adresse" TEXT,
    "adresse_complement" TEXT,
    "code_postal" TEXT,
    "ville" TEXT,
    "pays" TEXT NOT NULL DEFAULT 'Madagascar',
    "conditions_paiement" TEXT,
    "mode_paiement" TEXT,
    "encours_max" TEXT NOT NULL DEFAULT '0',
    "encours_actuel" TEXT NOT NULL DEFAULT '0',
    "commercial_id" INTEGER,
    "origine" TEXT,
    "rib" TEXT,
    "notes" TEXT,
    "ca_total" TEXT NOT NULL DEFAULT '0',
    "dernier_contact" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("commercial_id") REFERENCES "utilisateurs" ("id"),
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_clients_commercial_id" ON "clients" ("commercial_id");
CREATE INDEX IF NOT EXISTS "idx_clients_entreprise_id" ON "clients" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_clients_entreprise_id_is_deleted" ON "clients" ("entreprise_id", "is_deleted");
CREATE INDEX IF NOT EXISTS "idx_clients_type" ON "clients" ("type");

-- Table « entreprises »
CREATE TABLE IF NOT EXISTS "entreprises" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL,
    "nom_commercial" TEXT,
    "adresse" TEXT,
    "code_postal" TEXT,
    "ville" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "logo" TEXT,
    "abonnement" TEXT NOT NULL DEFAULT 'gratuit',
    "devise" TEXT NOT NULL DEFAULT 'MGA',
    "siret" TEXT,
    "numero_tva" TEXT,
    "code_ape" TEXT,
    "site_web" TEXT,
    "prefixe_devis" TEXT NOT NULL DEFAULT 'DEV',
    "prefixe_facture" TEXT NOT NULL DEFAULT 'FAC',
    "prefixe_contrat" TEXT NOT NULL DEFAULT 'CTR',
    "prefixe_employe" TEXT NOT NULL DEFAULT 'EMP',
    "prefixe_employe_journalier" TEXT NOT NULL DEFAULT 'JRN',
    "tva_defaut" TEXT NOT NULL DEFAULT '20.00',
    "delai_paiement_defaut" INTEGER NOT NULL DEFAULT 30,
    "validite_devis" INTEGER NOT NULL DEFAULT 30,
    "mentions_legales" TEXT,
    "couleurs_roles" TEXT,
    "entete_badge" TEXT,
    "actif" INTEGER NOT NULL DEFAULT 1,
    "date_creation" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_entreprise_nom" ON "entreprises" ("nom");

-- Table « mail_settings »
CREATE TABLE IF NOT EXISTS "mail_settings" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "provider" TEXT NOT NULL,
    "smtp_host" TEXT NOT NULL,
    "smtp_port" INTEGER NOT NULL,
    "smtp_user" TEXT,
    "smtp_password_encrypted" TEXT,
    "smtp_tls" INTEGER NOT NULL,
    "smtp_ssl" INTEGER NOT NULL,
    "smtp_from_email" TEXT NOT NULL,
    "smtp_from_name" TEXT NOT NULL,
    "frontend_url" TEXT NOT NULL,
    "is_active" INTEGER NOT NULL,
    "last_test_at" TEXT,
    "last_test_status" TEXT,
    "last_test_message" TEXT,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table « parametres_paiement »
CREATE TABLE IF NOT EXISTS "parametres_paiement" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "api_key" TEXT,
    "webhook_secret" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "providers_actifs" TEXT,
    "notification_url" TEXT,
    "success_url" TEXT,
    "failure_url" TEXT,
    "is_test_mode" INTEGER NOT NULL DEFAULT 1,
    "dernier_test_at" TEXT,
    "dernier_test_ok" INTEGER,
    "dernier_test_message" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table « plans »
CREATE TABLE IF NOT EXISTS "plans" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL,
    "code" TEXT NOT NULL UNIQUE,
    "description" TEXT,
    "prix_mensuel" TEXT NOT NULL,
    "prix_annuel" TEXT NOT NULL,
    "utilisateurs_max" INTEGER,
    "chantiers_max" INTEGER,
    "stockage_go" INTEGER DEFAULT 5,
    "duree_essai_jours" INTEGER NOT NULL DEFAULT 30,
    "actif" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_plan_code" ON "plans" ("code");

-- Table « platform_settings »
CREATE TABLE IF NOT EXISTS "platform_settings" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "cle" TEXT NOT NULL UNIQUE,
    "valeur" TEXT,
    "description" TEXT,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table « roles »
CREATE TABLE IF NOT EXISTS "roles" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL UNIQUE,
    "permissions" TEXT DEFAULT '{}',
    "is_system" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_roles_code" ON "roles" ("code");

-- Table « sync_queue »
CREATE TABLE IF NOT EXISTS "sync_queue" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "table_name" TEXT NOT NULL,
    "record_id" INTEGER NOT NULL,
    "server_id" INTEGER,
    "operation" TEXT NOT NULL,
    "payload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_sync_queue_status" ON "sync_queue" ("status");

-- Table « utilisateurs »
CREATE TABLE IF NOT EXISTS "utilisateurs" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER,
    "role_id" INTEGER,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "email" TEXT NOT NULL UNIQUE,
    "telephone" TEXT,
    "mot_de_passe_hash" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "date_creation" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "derniere_connexion" TEXT,
    "must_change_password" INTEGER NOT NULL DEFAULT 0,
    "photo" TEXT,
    "client_id" INTEGER,
    "is_email_verified" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("role_id") REFERENCES "roles" ("id"),
    FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE SET NULL,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_utilisateurs_client_id" ON "utilisateurs" ("client_id");
CREATE INDEX IF NOT EXISTS "idx_utilisateurs_entreprise_id" ON "utilisateurs" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_utilisateurs_role_id" ON "utilisateurs" ("role_id");

-- Table « alertes »
CREATE TABLE IF NOT EXISTS "alertes" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT,
    "type_entite" TEXT,
    "entite_id" INTEGER,
    "niveau_gravite" TEXT NOT NULL DEFAULT 'info',
    "statut" TEXT NOT NULL DEFAULT 'non_lue',
    "lue" INTEGER NOT NULL DEFAULT 0,
    "date_lecture" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_alertes_entreprise_id" ON "alertes" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_alertes_entreprise_id_is_deleted" ON "alertes" ("entreprise_id", "is_deleted");
CREATE INDEX IF NOT EXISTS "idx_alertes_lue" ON "alertes" ("lue");
CREATE INDEX IF NOT EXISTS "idx_alertes_statut" ON "alertes" ("statut");

-- Table « client_adresses »
CREATE TABLE IF NOT EXISTS "client_adresses" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "client_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "defaut" INTEGER NOT NULL DEFAULT 0,
    "ligne1" TEXT NOT NULL,
    "ligne2" TEXT,
    "code_postal" TEXT,
    "ville" TEXT,
    "pays" TEXT NOT NULL DEFAULT 'Madagascar',
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE,
    CONSTRAINT "uq_client_adresses_client_type" UNIQUE ("client_id", "type")
);
CREATE INDEX IF NOT EXISTS "idx_client_adresses_client_id" ON "client_adresses" ("client_id");

-- Table « demandes_travaux »
CREATE TABLE IF NOT EXISTS "demandes_travaux" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER,
    "client_id" INTEGER,
    "commercial_id" INTEGER,
    "numero" TEXT UNIQUE,
    "objet" TEXT NOT NULL,
    "type_projet" TEXT,
    "description" TEXT,
    "localisation" TEXT,
    "date_demande" TEXT,
    "date_souhaitee" TEXT,
    "documents_fournis" TEXT,
    "plans_disponibles" INTEGER,
    "observations" TEXT,
    "statut" TEXT,
    "is_deleted" INTEGER,
    "created_at" TEXT,
    "updated_at" TEXT,
    FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE SET NULL,
    FOREIGN KEY ("commercial_id") REFERENCES "utilisateurs" ("id") ON DELETE SET NULL,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);

-- Table « depots »
CREATE TABLE IF NOT EXISTS "depots" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "responsable" TEXT,
    "telephone" TEXT,
    "capacite_m2" TEXT,
    "type" TEXT NOT NULL DEFAULT 'magasin_principal',
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_depots_code" ON "depots" ("code");
CREATE INDEX IF NOT EXISTS "idx_depots_entreprise_id" ON "depots" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_depots_entreprise_id_is_deleted" ON "depots" ("entreprise_id", "is_deleted");

-- Table « employes »
CREATE TABLE IF NOT EXISTS "employes" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "matricule" TEXT,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "poste" TEXT,
    "photo" TEXT,
    "date_embauche" TEXT,
    "type_contrat" TEXT NOT NULL DEFAULT 'CDI',
    "date_debut_contrat" TEXT,
    "date_fin_contrat" TEXT,
    "salaire_base" TEXT NOT NULL DEFAULT '0',
    "telephone" TEXT,
    "email" TEXT,
    "adresse" TEXT,
    "mode_remuneration" TEXT NOT NULL DEFAULT 'mensuel',
    "taux_journalier" TEXT,
    "taux_horaire" TEXT,
    "prix_tache" TEXT,
    "numero_cnaps" TEXT,
    "numero_ostie" TEXT,
    "statut_declaration" TEXT NOT NULL DEFAULT 'non_declare',
    "solde_conges_annuel" TEXT NOT NULL DEFAULT '30',
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "code_qr_badge" TEXT UNIQUE,
    "badge_statut" TEXT NOT NULL DEFAULT 'actif',
    "badge_date_creation" TEXT,
    "badge_date_desactivation" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_employes_entreprise_id" ON "employes" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_employes_entreprise_id_is_deleted" ON "employes" ("entreprise_id", "is_deleted");
CREATE INDEX IF NOT EXISTS "idx_employes_nom_prenom" ON "employes" ("nom", "prenom");

-- Table « fournisseurs »
CREATE TABLE IF NOT EXISTS "fournisseurs" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "code_postal" TEXT,
    "ville" TEXT,
    "pays" TEXT NOT NULL DEFAULT 'Madagascar',
    "siret" TEXT,
    "conditions_paiement" TEXT,
    "notes" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_fournisseurs_entreprise_id" ON "fournisseurs" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_fournisseurs_entreprise_id_is_deleted" ON "fournisseurs" ("entreprise_id", "is_deleted");

-- Table « historique_connexions »
CREATE TABLE IF NOT EXISTS "historique_connexions" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "utilisateur_id" INTEGER,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "reussi" INTEGER NOT NULL DEFAULT 1,
    "date_connexion" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "idx_historique_connexions_utilisateur_id" ON "historique_connexions" ("utilisateur_id");

-- Table « materiaux »
CREATE TABLE IF NOT EXISTS "materiaux" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "designation" TEXT,
    "type" TEXT,
    "marque" TEXT,
    "modele" TEXT,
    "numero_serie" TEXT,
    "date_acquisition" TEXT,
    "valeur_achat" TEXT NOT NULL DEFAULT '0',
    "description" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'disponible',
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photo_url" TEXT,
    "manuel_url" TEXT,
    "normes" TEXT,
    "categorie_btp" TEXT DEFAULT 'engin_lourd',
    "immatriculation" TEXT,
    "heures_moteur" TEXT NOT NULL DEFAULT '0',
    "kilometrage" TEXT NOT NULL DEFAULT '0',
    "frequence_entretien_heures" TEXT,
    "statut_vgp" TEXT NOT NULL DEFAULT 'conforme',
    "date_derniere_vgp" TEXT,
    "date_prochaine_vgp" TEXT,
    "organisme_vgp" TEXT,
    "certificat_vgp_url" TEXT,
    "qr_code_key" TEXT,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_materiaux_entreprise_id" ON "materiaux" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_materiaux_statut" ON "materiaux" ("statut");
CREATE INDEX IF NOT EXISTS "idx_materiaux_statut_vgp" ON "materiaux" ("statut_vgp");

-- Table « notifications »
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER,
    "utilisateur_id" INTEGER,
    "client_id" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'info',
    "titre" TEXT NOT NULL,
    "message" TEXT,
    "entite_type" TEXT,
    "entite_id" INTEGER,
    "canal" TEXT NOT NULL DEFAULT 'application',
    "envoye_email" INTEGER NOT NULL DEFAULT 0,
    "lu" INTEGER NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_notifications_client_id" ON "notifications" ("client_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_lu" ON "notifications" ("lu");
CREATE INDEX IF NOT EXISTS "idx_notifications_utilisateur_id" ON "notifications" ("utilisateur_id");

-- Table « periodes_risque_climatique »
CREATE TABLE IF NOT EXISTS "periodes_risque_climatique" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "region" TEXT NOT NULL,
    "type_risque" TEXT NOT NULL,
    "date_debut" TEXT NOT NULL,
    "date_fin" TEXT NOT NULL,
    "description" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_prc_entreprise_id" ON "periodes_risque_climatique" ("entreprise_id");

-- Table « preferences »
CREATE TABLE IF NOT EXISTS "preferences" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL UNIQUE,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "date_format" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "devise" TEXT NOT NULL DEFAULT 'MGA',
    "notif_email" INTEGER NOT NULL DEFAULT 1,
    "notif_push" INTEGER NOT NULL DEFAULT 1,
    "notif_factures_retard" INTEGER NOT NULL DEFAULT 1,
    "notif_stock_bas" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("user_id") REFERENCES "utilisateurs" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_preferences_user_id" ON "preferences" ("user_id");

-- Table « refresh_tokens »
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "utilisateur_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL UNIQUE,
    "expires_at" TEXT NOT NULL,
    "revoked" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_utilisateur_id" ON "refresh_tokens" ("utilisateur_id");

-- Table « subscriptions »
CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "date_debut" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_fin" TEXT,
    "date_prochain_renouvellement" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "mode_paiement" TEXT,
    "prix_paye" TEXT,
    "periode" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("plan_id") REFERENCES "plans" ("id")
);
CREATE INDEX IF NOT EXISTS "idx_subscription_entreprise" ON "subscriptions" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_subscription_plan" ON "subscriptions" ("plan_id");

-- Table « alertes_materiel »
CREATE TABLE IF NOT EXISTS "alertes_materiel" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "materiel_id" INTEGER NOT NULL,
    "type" TEXT,
    "message" TEXT,
    "date_alerte" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" TEXT NOT NULL DEFAULT 'ouverte',
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("materiel_id") REFERENCES "materiaux" ("id"),
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_alertes_materiel_entreprise_id" ON "alertes_materiel" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_alertes_materiel_entreprise_id_is_deleted" ON "alertes_materiel" ("entreprise_id", "is_deleted");
CREATE INDEX IF NOT EXISTS "idx_alertes_materiel_materiel_id" ON "alertes_materiel" ("materiel_id");

-- Table « articles »
CREATE TABLE IF NOT EXISTS "articles" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "reference" TEXT UNIQUE,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "categorie" TEXT,
    "unite" TEXT NOT NULL DEFAULT 'unite',
    "stock_actuel" TEXT NOT NULL DEFAULT '0',
    "seuil_alerte" TEXT NOT NULL DEFAULT '0',
    "stock_mini" TEXT NOT NULL DEFAULT '0',
    "prix_achat" TEXT NOT NULL DEFAULT '0',
    "prix_vente" TEXT NOT NULL DEFAULT '0',
    "marge" TEXT NOT NULL DEFAULT '0',
    "tva" TEXT NOT NULL DEFAULT '20.00',
    "poids" TEXT,
    "fournisseur_id" INTEGER,
    "code_barre" TEXT,
    "emplacement" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("fournisseur_id") REFERENCES "fournisseurs" ("id")
);
CREATE INDEX IF NOT EXISTS "idx_articles_categorie" ON "articles" ("categorie");
CREATE INDEX IF NOT EXISTS "idx_articles_entreprise_id" ON "articles" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_articles_entreprise_id_is_deleted" ON "articles" ("entreprise_id", "is_deleted");

-- Table « conges »
CREATE TABLE IF NOT EXISTS "conges" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER,
    "employe_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'annuel',
    "date_debut" TEXT NOT NULL,
    "date_fin" TEXT NOT NULL,
    "nb_jours" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "motif" TEXT,
    "valide_par" INTEGER,
    "date_validation" TEXT,
    "commentaire_refus" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("valide_par") REFERENCES "utilisateurs" ("id") ON DELETE SET NULL,
    FOREIGN KEY ("employe_id") REFERENCES "employes" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_conges_employe_id" ON "conges" ("employe_id");
CREATE INDEX IF NOT EXISTS "idx_conges_entreprise_id" ON "conges" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_conges_statut" ON "conges" ("statut");

-- Table « equipes »
CREATE TABLE IF NOT EXISTS "equipes" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "chef_equipe_id" INTEGER,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "specialite" TEXT,
    "date_creation" TEXT NOT NULL DEFAULT CURRENT_DATE,
    "statut" TEXT NOT NULL DEFAULT 'active',
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("chef_equipe_id") REFERENCES "employes" ("id")
);
CREATE INDEX IF NOT EXISTS "idx_equipes_entreprise_id" ON "equipes" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_equipes_entreprise_id_is_deleted" ON "equipes" ("entreprise_id", "is_deleted");

-- Table « historique_postes »
CREATE TABLE IF NOT EXISTS "historique_postes" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "employe_id" INTEGER NOT NULL,
    "poste" TEXT NOT NULL,
    "type_contrat" TEXT,
    "salaire_base" TEXT NOT NULL DEFAULT '0',
    "date_debut" TEXT NOT NULL,
    "date_fin" TEXT,
    "motif_changement" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("employe_id") REFERENCES "employes" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_historique_postes_employe_id" ON "historique_postes" ("employe_id");

-- Table « maintenances »
CREATE TABLE IF NOT EXISTS "maintenances" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "materiel_id" INTEGER NOT NULL,
    "date_maintenance" TEXT NOT NULL,
    "type" TEXT,
    "cout" TEXT NOT NULL DEFAULT '0',
    "description" TEXT,
    "prochaine_date_echeance" TEXT,
    "technicien" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("materiel_id") REFERENCES "materiaux" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_maintenances_entreprise_id_is_deleted" ON "maintenances" ("entreprise_id", "is_deleted");
CREATE INDEX IF NOT EXISTS "idx_maintenances_materiel_id" ON "maintenances" ("materiel_id");

-- Table « projets »
CREATE TABLE IF NOT EXISTS "projets" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER,
    "client_id" INTEGER,
    "demande_id" INTEGER,
    "responsable_id" INTEGER,
    "reference" TEXT UNIQUE,
    "nom" TEXT NOT NULL,
    "type_projet" TEXT,
    "description" TEXT,
    "localisation" TEXT,
    "adresse" TEXT,
    "longueur" TEXT,
    "largeur" TEXT,
    "hauteur" TEXT,
    "surface" TEXT,
    "volume" TEXT,
    "nombre_niveaux" INTEGER,
    "plans_documents" TEXT,
    "observations" TEXT,
    "statut" TEXT,
    "is_deleted" INTEGER,
    "created_at" TEXT,
    "updated_at" TEXT,
    FOREIGN KEY ("demande_id") REFERENCES "demandes_travaux" ("id") ON DELETE SET NULL,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("responsable_id") REFERENCES "utilisateurs" ("id") ON DELETE SET NULL,
    FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE SET NULL
);

-- Table « chantiers »
CREATE TABLE IF NOT EXISTS "chantiers" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "client_id" INTEGER,
    "chef_chantier_id" INTEGER,
    "projet_id" INTEGER,
    "numero" TEXT,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "code_postal" TEXT,
    "ville" TEXT,
    "date_debut" TEXT,
    "date_fin_prevue" TEXT,
    "date_fin_reelle" TEXT,
    "budget_prevu" TEXT NOT NULL DEFAULT '0',
    "budget_previsionnel" TEXT NOT NULL DEFAULT '0',
    "budget_reel" TEXT NOT NULL DEFAULT '0',
    "marge_cible" TEXT NOT NULL DEFAULT '0',
    "tva" TEXT NOT NULL DEFAULT '20.00',
    "statut" TEXT NOT NULL DEFAULT 'planification',
    "description" TEXT,
    "region" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("chef_chantier_id") REFERENCES "utilisateurs" ("id"),
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("projet_id") REFERENCES "projets" ("id") ON DELETE SET NULL,
    FOREIGN KEY ("client_id") REFERENCES "clients" ("id")
);
CREATE INDEX IF NOT EXISTS "idx_chantiers_chef_chantier_id" ON "chantiers" ("chef_chantier_id");
CREATE INDEX IF NOT EXISTS "idx_chantiers_client_id" ON "chantiers" ("client_id");
CREATE INDEX IF NOT EXISTS "idx_chantiers_entreprise_id" ON "chantiers" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_chantiers_entreprise_id_is_deleted" ON "chantiers" ("entreprise_id", "is_deleted");
CREATE INDEX IF NOT EXISTS "idx_chantiers_projet_id" ON "chantiers" ("projet_id");

-- Table « devis »
CREATE TABLE IF NOT EXISTS "devis" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "projet_id" INTEGER,
    "numero" TEXT NOT NULL UNIQUE,
    "objet" TEXT,
    "montant_ht" TEXT NOT NULL DEFAULT '0',
    "tva" TEXT NOT NULL DEFAULT '20.00',
    "montant_ttc" TEXT NOT NULL DEFAULT '0',
    "date_creation" TEXT NOT NULL DEFAULT CURRENT_DATE,
    "date_validite" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "conditions_paiement" TEXT,
    "mode_paiement" TEXT,
    "notes" TEXT,
    "reponse_le" TEXT,
    "reponse_par_id" INTEGER,
    "reponse_motif" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("projet_id") REFERENCES "projets" ("id") ON DELETE SET NULL,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("reponse_par_id") REFERENCES "utilisateurs" ("id") ON DELETE SET NULL,
    FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_devis_entreprise_id" ON "devis" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_devis_entreprise_id_is_deleted" ON "devis" ("entreprise_id", "is_deleted");
CREATE INDEX IF NOT EXISTS "idx_devis_statut" ON "devis" ("statut");

-- Table « membres_equipe »
CREATE TABLE IF NOT EXISTS "membres_equipe" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "equipe_id" INTEGER NOT NULL,
    "employe_id" INTEGER NOT NULL,
    "date_debut" TEXT NOT NULL DEFAULT CURRENT_DATE,
    "date_fin" TEXT,
    "role" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("employe_id") REFERENCES "employes" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("equipe_id") REFERENCES "equipes" ("id") ON DELETE CASCADE,
    CONSTRAINT "uq_membres_equipe" UNIQUE ("equipe_id", "employe_id", "date_debut")
);
CREATE INDEX IF NOT EXISTS "idx_membres_equipe_employe_id" ON "membres_equipe" ("employe_id");
CREATE INDEX IF NOT EXISTS "idx_membres_equipe_equipe_id" ON "membres_equipe" ("equipe_id");

-- Table « metres »
CREATE TABLE IF NOT EXISTS "metres" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER,
    "projet_id" INTEGER,
    "ouvrage" TEXT NOT NULL,
    "designation" TEXT,
    "formule" TEXT,
    "dimensions" TEXT,
    "unite" TEXT,
    "quantite" TEXT,
    "observations" TEXT,
    "document_reference" TEXT,
    "ordre" INTEGER,
    "is_deleted" INTEGER,
    "created_at" TEXT,
    "updated_at" TEXT,
    FOREIGN KEY ("projet_id") REFERENCES "projets" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);

-- Table « affectation_chantiers »
CREATE TABLE IF NOT EXISTS "affectation_chantiers" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "employe_id" INTEGER NOT NULL,
    "chantier_id" INTEGER NOT NULL,
    "date_debut" TEXT,
    "date_fin" TEXT,
    "role" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("employe_id") REFERENCES "employes" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_affectation_chantiers_chantier_id" ON "affectation_chantiers" ("chantier_id");
CREATE INDEX IF NOT EXISTS "idx_affectation_chantiers_employe_id" ON "affectation_chantiers" ("employe_id");

-- Table « affectation_materiaux »
CREATE TABLE IF NOT EXISTS "affectation_materiaux" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "materiel_id" INTEGER NOT NULL,
    "chantier_id" INTEGER NOT NULL,
    "date_debut" TEXT,
    "date_fin" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("materiel_id") REFERENCES "materiaux" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_affectation_materiaux_chantier_id" ON "affectation_materiaux" ("chantier_id");
CREATE INDEX IF NOT EXISTS "idx_affectation_materiaux_materiel_id" ON "affectation_materiaux" ("materiel_id");

-- Table « affectation_ressources »
CREATE TABLE IF NOT EXISTS "affectation_ressources" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "chantier_id" INTEGER NOT NULL,
    "type_ressource" TEXT NOT NULL,
    "ressource_id" INTEGER NOT NULL,
    "date_debut" TEXT,
    "date_fin" TEXT,
    "role" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_affectation_ressources_chantier_id" ON "affectation_ressources" ("chantier_id");

-- Table « commandes_fournisseur »
CREATE TABLE IF NOT EXISTS "commandes_fournisseur" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "fournisseur_id" INTEGER NOT NULL,
    "numero" TEXT NOT NULL UNIQUE,
    "chantier_id" INTEGER,
    "date_commande" TEXT NOT NULL DEFAULT CURRENT_DATE,
    "date_livraison_prevue" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "montant_ht" TEXT NOT NULL DEFAULT '0',
    "taux_tva" TEXT NOT NULL DEFAULT '20.00',
    "montant_tva" TEXT NOT NULL DEFAULT '0',
    "montant_ttc" TEXT NOT NULL DEFAULT '0',
    "notes" TEXT,
    "created_by" INTEGER,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id"),
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("created_by") REFERENCES "utilisateurs" ("id"),
    FOREIGN KEY ("fournisseur_id") REFERENCES "fournisseurs" ("id")
);
CREATE INDEX IF NOT EXISTS "idx_cf_chantier_id" ON "commandes_fournisseur" ("chantier_id");
CREATE INDEX IF NOT EXISTS "idx_cf_entreprise_id" ON "commandes_fournisseur" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_cf_entreprise_id_is_deleted" ON "commandes_fournisseur" ("entreprise_id", "is_deleted");
CREATE INDEX IF NOT EXISTS "idx_cf_fournisseur_id" ON "commandes_fournisseur" ("fournisseur_id");
CREATE INDEX IF NOT EXISTS "idx_cf_statut" ON "commandes_fournisseur" ("statut");

-- Table « commentaires »
CREATE TABLE IF NOT EXISTS "commentaires" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER,
    "chantier_id" INTEGER,
    "employe_id" INTEGER,
    "utilisateur_id" INTEGER,
    "objet_type" TEXT,
    "objet_id" INTEGER,
    "message" TEXT NOT NULL,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("employe_id") REFERENCES "employes" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_commentaires_employe_id" ON "commentaires" ("employe_id");
CREATE INDEX IF NOT EXISTS "idx_commentaires_objet" ON "commentaires" ("objet_type", "objet_id");

-- Table « contrats »
CREATE TABLE IF NOT EXISTS "contrats" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "reference" TEXT NOT NULL UNIQUE,
    "type_contrat" TEXT,
    "montant" TEXT NOT NULL DEFAULT '0',
    "date_debut" TEXT,
    "date_fin" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'en_cours',
    "chantier_id" INTEGER,
    "devis_id" INTEGER,
    "objet" TEXT,
    "conditions_paiement" TEXT,
    "date_signature" TEXT,
    "garantie_mois" INTEGER NOT NULL DEFAULT 12,
    "notes" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id"),
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("devis_id") REFERENCES "devis" ("id"),
    FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_contrats_client_id" ON "contrats" ("client_id");
CREATE INDEX IF NOT EXISTS "idx_contrats_entreprise_id" ON "contrats" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_contrats_entreprise_id_is_deleted" ON "contrats" ("entreprise_id", "is_deleted");

-- Table « depenses »
CREATE TABLE IF NOT EXISTS "depenses" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "chantier_id" INTEGER,
    "description" TEXT NOT NULL,
    "montant" TEXT NOT NULL,
    "date_depense" TEXT NOT NULL DEFAULT CURRENT_DATE,
    "categorie" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "fournisseur" TEXT,
    "taux_tva" TEXT NOT NULL DEFAULT '20.00',
    "numero_facture" TEXT,
    "mode_paiement" TEXT,
    "validee_par" INTEGER,
    "notes" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("validee_par") REFERENCES "utilisateurs" ("id"),
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id"),
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_depenses_chantier_id" ON "depenses" ("chantier_id");
CREATE INDEX IF NOT EXISTS "idx_depenses_date_depense" ON "depenses" ("date_depense");
CREATE INDEX IF NOT EXISTS "idx_depenses_entreprise_id" ON "depenses" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_depenses_entreprise_id_is_deleted" ON "depenses" ("entreprise_id", "is_deleted");

-- Table « documents »
CREATE TABLE IF NOT EXISTS "documents" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER,
    "client_id" INTEGER,
    "chantier_id" INTEGER,
    "projet_id" INTEGER,
    "employe_id" INTEGER,
    "categorie" TEXT NOT NULL DEFAULT 'autre',
    "nom" TEXT NOT NULL,
    "fichier_url" TEXT,
    "mime_type" TEXT,
    "taille_octets" INTEGER,
    "description" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("projet_id") REFERENCES "projets" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("employe_id") REFERENCES "employes" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_documents_client_id" ON "documents" ("client_id");
CREATE INDEX IF NOT EXISTS "idx_documents_employe_id" ON "documents" ("employe_id");
CREATE INDEX IF NOT EXISTS "idx_documents_entreprise_id" ON "documents" ("entreprise_id");

-- Table « heures_supplementaires »
CREATE TABLE IF NOT EXISTS "heures_supplementaires" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "employe_id" INTEGER NOT NULL,
    "chantier_id" INTEGER,
    "date_hs" TEXT NOT NULL,
    "nb_heures" TEXT NOT NULL DEFAULT '0',
    "taux_majoration" TEXT NOT NULL DEFAULT '1.5',
    "motif" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "type_compensation" TEXT NOT NULL DEFAULT 'paiement',
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id"),
    FOREIGN KEY ("employe_id") REFERENCES "employes" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_heures_supplementaires_employe_id" ON "heures_supplementaires" ("employe_id");

-- Table « incidents »
CREATE TABLE IF NOT EXISTS "incidents" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "chantier_id" INTEGER NOT NULL,
    "declare_par" INTEGER,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "date_incident" TEXT NOT NULL DEFAULT CURRENT_DATE,
    "type_alea" TEXT,
    "date_fin" TEXT,
    "gravite" TEXT NOT NULL DEFAULT 'moyenne',
    "statut" TEXT NOT NULL DEFAULT 'signale',
    "impact_arret_jours" INTEGER,
    "imputabilite" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("declare_par") REFERENCES "utilisateurs" ("id"),
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_incidents_chantier_id" ON "incidents" ("chantier_id");

-- Table « lignes_devis »
CREATE TABLE IF NOT EXISTS "lignes_devis" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "devis_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'article',
    "article_id" INTEGER,
    "description" TEXT NOT NULL,
    "categorie" TEXT,
    "quantite" TEXT NOT NULL DEFAULT '0',
    "unite" TEXT,
    "prix_unitaire" TEXT NOT NULL DEFAULT '0',
    "remise" TEXT NOT NULL DEFAULT '0',
    "taux_tva" TEXT NOT NULL DEFAULT '20.00',
    "total_ht" TEXT NOT NULL DEFAULT '0',
    "total_ttc" TEXT NOT NULL DEFAULT '0',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("article_id") REFERENCES "articles" ("id"),
    FOREIGN KEY ("devis_id") REFERENCES "devis" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_lignes_devis_article_id" ON "lignes_devis" ("article_id");
CREATE INDEX IF NOT EXISTS "idx_lignes_devis_devis_id" ON "lignes_devis" ("devis_id");

-- Table « mouvements_materiel »
CREATE TABLE IF NOT EXISTS "mouvements_materiel" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "materiel_id" INTEGER NOT NULL,
    "chantier_origine_id" INTEGER,
    "chantier_destination_id" INTEGER,
    "date_depart" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_reception" TEXT,
    "transporteur" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'en_transit',
    "notes" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("chantier_destination_id") REFERENCES "chantiers" ("id") ON DELETE SET NULL,
    FOREIGN KEY ("materiel_id") REFERENCES "materiaux" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("chantier_origine_id") REFERENCES "chantiers" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "idx_mouvements_materiel_entreprise" ON "mouvements_materiel" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_mouvements_materiel_materiel" ON "mouvements_materiel" ("materiel_id");
CREATE INDEX IF NOT EXISTS "idx_mouvements_materiel_statut" ON "mouvements_materiel" ("statut");

-- Table « mouvements_stock »
CREATE TABLE IF NOT EXISTS "mouvements_stock" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "article_id" INTEGER NOT NULL,
    "type_mouvement" TEXT NOT NULL,
    "date_mouvement" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantite" TEXT NOT NULL,
    "prix_unitaire" TEXT NOT NULL DEFAULT '0',
    "chantier_id" INTEGER,
    "fournisseur_id" INTEGER,
    "reference" TEXT,
    "notes" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("fournisseur_id") REFERENCES "fournisseurs" ("id"),
    FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id"),
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_mouvements_stock_article_id" ON "mouvements_stock" ("article_id");
CREATE INDEX IF NOT EXISTS "idx_mouvements_stock_date_mouvement" ON "mouvements_stock" ("date_mouvement");
CREATE INDEX IF NOT EXISTS "idx_mouvements_stock_entreprise_id_is_deleted" ON "mouvements_stock" ("entreprise_id", "is_deleted");

-- Table « phases »
CREATE TABLE IF NOT EXISTS "phases" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "chantier_id" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "date_debut" TEXT,
    "date_fin" TEXT,
    "budget" TEXT NOT NULL DEFAULT '0',
    "avancement_pct" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'non_commencee',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_phases_chantier_id" ON "phases" ("chantier_id");

-- Table « pointages »
CREATE TABLE IF NOT EXISTS "pointages" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "employe_id" INTEGER NOT NULL,
    "chantier_id" INTEGER,
    "date_jour" TEXT NOT NULL,
    "heure_debut" TEXT,
    "heure_fin" TEXT,
    "heure_pause_debut" TEXT,
    "heure_pause_fin" TEXT,
    "heures_total" TEXT NOT NULL DEFAULT '0',
    "type" TEXT NOT NULL DEFAULT 'present',
    "methode_pointage" TEXT NOT NULL DEFAULT 'manuel',
    "scanne_par_id" INTEGER,
    "latitude" TEXT,
    "longitude" TEXT,
    "statut_validation" TEXT NOT NULL DEFAULT 'valide',
    "notes" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("employe_id") REFERENCES "employes" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id"),
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("scanne_par_id") REFERENCES "utilisateurs" ("id"),
    CONSTRAINT "uq_pointages_employe_date_jour" UNIQUE ("employe_id", "date_jour")
);
CREATE INDEX IF NOT EXISTS "idx_pointages_chantier_id" ON "pointages" ("chantier_id");
CREATE INDEX IF NOT EXISTS "idx_pointages_date_jour" ON "pointages" ("date_jour");
CREATE INDEX IF NOT EXISTS "idx_pointages_employe_id" ON "pointages" ("employe_id");
CREATE INDEX IF NOT EXISTS "idx_pointages_entreprise_id_is_deleted" ON "pointages" ("entreprise_id", "is_deleted");

-- Table « rapports_financiers »
CREATE TABLE IF NOT EXISTS "rapports_financiers" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "chantier_id" INTEGER,
    "periode" TEXT,
    "chiffre_affaires" TEXT NOT NULL DEFAULT '0',
    "depenses_total" TEXT NOT NULL DEFAULT '0',
    "marge" TEXT NOT NULL DEFAULT '0',
    "date_generation" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id"),
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_rapports_entreprise_id" ON "rapports_financiers" ("entreprise_id");

-- Table « rapports_journaliers »
CREATE TABLE IF NOT EXISTS "rapports_journaliers" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER,
    "chantier_id" INTEGER,
    "employe_id" INTEGER,
    "date_rapport" TEXT,
    "travaux_realises" TEXT,
    "quantites" TEXT,
    "personnel_present" TEXT,
    "materiel_utilise" TEXT,
    "materiaux_utilises" TEXT,
    "incidents" TEXT,
    "difficultes" TEXT,
    "observations" TEXT,
    "nb_photos" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("employe_id") REFERENCES "employes" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_rapports_journaliers_chantier_id" ON "rapports_journaliers" ("chantier_id");
CREATE INDEX IF NOT EXISTS "idx_rapports_journaliers_employe_id" ON "rapports_journaliers" ("employe_id");

-- Table « signalements »
CREATE TABLE IF NOT EXISTS "signalements" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER,
    "chantier_id" INTEGER,
    "employe_id" INTEGER,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "zone" TEXT,
    "priorite" TEXT NOT NULL DEFAULT 'normale',
    "photo_url" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'signale',
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("employe_id") REFERENCES "employes" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_signalements_chantier_id" ON "signalements" ("chantier_id");
CREATE INDEX IF NOT EXISTS "idx_signalements_employe_id" ON "signalements" ("employe_id");

-- Table « taches »
CREATE TABLE IF NOT EXISTS "taches" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER,
    "chantier_id" INTEGER,
    "employe_id" INTEGER,
    "ouvrage" TEXT,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "date_prevue" TEXT,
    "priorite" TEXT NOT NULL DEFAULT 'normale',
    "statut" TEXT NOT NULL DEFAULT 'a_faire',
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("employe_id") REFERENCES "employes" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_taches_chantier_id" ON "taches" ("chantier_id");
CREATE INDEX IF NOT EXISTS "idx_taches_employe_id" ON "taches" ("employe_id");
CREATE INDEX IF NOT EXISTS "idx_taches_entreprise_id" ON "taches" ("entreprise_id");

-- Table « avenants »
CREATE TABLE IF NOT EXISTS "avenants" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "contrat_id" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "description" TEXT,
    "impact_montant" TEXT NOT NULL DEFAULT '0',
    "date_signature" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'propose',
    "fichier_url" TEXT,
    "notes" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("contrat_id") REFERENCES "contrats" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_avenants_contrat_id" ON "avenants" ("contrat_id");
CREATE INDEX IF NOT EXISTS "idx_avenants_entreprise_id" ON "avenants" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_avenants_numero" ON "avenants" ("numero");

-- Table « factures_fournisseur »
CREATE TABLE IF NOT EXISTS "factures_fournisseur" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "fournisseur_id" INTEGER NOT NULL,
    "commande_id" INTEGER,
    "chantier_id" INTEGER,
    "numero" TEXT NOT NULL,
    "date_facture" TEXT NOT NULL DEFAULT CURRENT_DATE,
    "date_echeance" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'a_payer',
    "montant_ht" TEXT NOT NULL DEFAULT '0',
    "taux_tva" TEXT NOT NULL DEFAULT '20.00',
    "montant_tva" TEXT NOT NULL DEFAULT '0',
    "montant_ttc" TEXT NOT NULL DEFAULT '0',
    "montant_paye" TEXT NOT NULL DEFAULT '0',
    "notes" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("commande_id") REFERENCES "commandes_fournisseur" ("id"),
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id"),
    FOREIGN KEY ("fournisseur_id") REFERENCES "fournisseurs" ("id")
);
CREATE INDEX IF NOT EXISTS "idx_ff_date_echeance" ON "factures_fournisseur" ("date_echeance");
CREATE INDEX IF NOT EXISTS "idx_ff_entreprise_id" ON "factures_fournisseur" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_ff_entreprise_id_is_deleted" ON "factures_fournisseur" ("entreprise_id", "is_deleted");
CREATE INDEX IF NOT EXISTS "idx_ff_fournisseur_id" ON "factures_fournisseur" ("fournisseur_id");
CREATE INDEX IF NOT EXISTS "idx_ff_statut" ON "factures_fournisseur" ("statut");

-- Table « lignes_commande_fournisseur »
CREATE TABLE IF NOT EXISTS "lignes_commande_fournisseur" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "commande_id" INTEGER NOT NULL,
    "article_id" INTEGER,
    "designation" TEXT NOT NULL,
    "quantite" TEXT NOT NULL,
    "quantite_recue" TEXT NOT NULL DEFAULT '0',
    "prix_unitaire" TEXT NOT NULL DEFAULT '0',
    "montant_ht" TEXT NOT NULL DEFAULT '0',
    "notes" TEXT,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("article_id") REFERENCES "articles" ("id"),
    FOREIGN KEY ("commande_id") REFERENCES "commandes_fournisseur" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_lcf_article_id" ON "lignes_commande_fournisseur" ("article_id");
CREATE INDEX IF NOT EXISTS "idx_lcf_commande_id" ON "lignes_commande_fournisseur" ("commande_id");

-- Table « photos_chantier »
CREATE TABLE IF NOT EXISTS "photos_chantier" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER,
    "chantier_id" INTEGER,
    "employe_id" INTEGER,
    "tache_id" INTEGER,
    "fichier_url" TEXT NOT NULL,
    "description" TEXT,
    "zone" TEXT,
    "date_prise" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("employe_id") REFERENCES "employes" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("tache_id") REFERENCES "taches" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "idx_photos_chantier_chantier_id" ON "photos_chantier" ("chantier_id");
CREATE INDEX IF NOT EXISTS "idx_photos_chantier_employe_id" ON "photos_chantier" ("employe_id");

-- Table « receptions_fournisseur »
CREATE TABLE IF NOT EXISTS "receptions_fournisseur" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "commande_id" INTEGER NOT NULL,
    "numero" TEXT,
    "date_reception" TEXT NOT NULL DEFAULT CURRENT_DATE,
    "depot_id" INTEGER,
    "chantier_id" INTEGER,
    "complete" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "received_by" INTEGER,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("received_by") REFERENCES "utilisateurs" ("id"),
    FOREIGN KEY ("depot_id") REFERENCES "depots" ("id"),
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id"),
    FOREIGN KEY ("commande_id") REFERENCES "commandes_fournisseur" ("id")
);
CREATE INDEX IF NOT EXISTS "idx_rf_commande_id" ON "receptions_fournisseur" ("commande_id");
CREATE INDEX IF NOT EXISTS "idx_rf_entreprise_id" ON "receptions_fournisseur" ("entreprise_id");

-- Table « situations_travaux »
CREATE TABLE IF NOT EXISTS "situations_travaux" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER,
    "chantier_id" INTEGER,
    "contrat_id" INTEGER,
    "numero" TEXT,
    "periode" TEXT,
    "date_etablissement" TEXT,
    "avancement" TEXT,
    "montant" TEXT,
    "observations" TEXT,
    "statut" TEXT,
    "is_deleted" INTEGER,
    "created_at" TEXT,
    "updated_at" TEXT,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("contrat_id") REFERENCES "contrats" ("id") ON DELETE SET NULL,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id") ON DELETE CASCADE
);

-- Table « travaux_realises »
CREATE TABLE IF NOT EXISTS "travaux_realises" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER,
    "chantier_id" INTEGER,
    "employe_id" INTEGER,
    "tache_id" INTEGER,
    "date_travail" TEXT,
    "ouvrage" TEXT,
    "travail" TEXT NOT NULL,
    "quantite" TEXT NOT NULL DEFAULT '0',
    "unite" TEXT,
    "duree_heures" TEXT NOT NULL DEFAULT '0',
    "observations" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("tache_id") REFERENCES "taches" ("id") ON DELETE SET NULL,
    FOREIGN KEY ("chantier_id") REFERENCES "chantiers" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("employe_id") REFERENCES "employes" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_travaux_realises_chantier_id" ON "travaux_realises" ("chantier_id");
CREATE INDEX IF NOT EXISTS "idx_travaux_realises_employe_id" ON "travaux_realises" ("employe_id");

-- Table « factures »
CREATE TABLE IF NOT EXISTS "factures" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "contrat_id" INTEGER,
    "client_id" INTEGER NOT NULL,
    "situation_id" INTEGER,
    "numero" TEXT NOT NULL UNIQUE,
    "type" TEXT NOT NULL DEFAULT 'standard',
    "montant_ht" TEXT NOT NULL DEFAULT '0',
    "tva" TEXT NOT NULL DEFAULT '20.00',
    "montant_tva" TEXT NOT NULL DEFAULT '0',
    "montant_ttc" TEXT NOT NULL DEFAULT '0',
    "montant_acompte_deduit" TEXT NOT NULL DEFAULT '0',
    "montant_paye" TEXT NOT NULL DEFAULT '0',
    "reste_a_payer" TEXT NOT NULL DEFAULT '0',
    "date_creation" TEXT NOT NULL DEFAULT CURRENT_DATE,
    "date_emission" TEXT,
    "date_echeance" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'emis',
    "conditions_paiement" TEXT,
    "mode_paiement" TEXT,
    "notes" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("situation_id") REFERENCES "situations_travaux" ("id") ON DELETE SET NULL,
    FOREIGN KEY ("contrat_id") REFERENCES "contrats" ("id"),
    FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_factures_client_id" ON "factures" ("client_id");
CREATE INDEX IF NOT EXISTS "idx_factures_entreprise_id" ON "factures" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_factures_entreprise_id_is_deleted" ON "factures" ("entreprise_id", "is_deleted");
CREATE INDEX IF NOT EXISTS "idx_factures_numero" ON "factures" ("numero");

-- Table « lignes_reception_fournisseur »
CREATE TABLE IF NOT EXISTS "lignes_reception_fournisseur" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "reception_id" INTEGER NOT NULL,
    "ligne_commande_id" INTEGER NOT NULL,
    "quantite_recue" TEXT NOT NULL,
    "conforme" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("reception_id") REFERENCES "receptions_fournisseur" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("ligne_commande_id") REFERENCES "lignes_commande_fournisseur" ("id")
);
CREATE INDEX IF NOT EXISTS "idx_lrf_reception_id" ON "lignes_reception_fournisseur" ("reception_id");

-- Table « lignes_situation »
CREATE TABLE IF NOT EXISTS "lignes_situation" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "situation_id" INTEGER,
    "ouvrage" TEXT NOT NULL,
    "quantite_periode" TEXT,
    "quantite_cumulee" TEXT,
    "unite" TEXT,
    "prix_unitaire" TEXT,
    "montant" TEXT,
    "observations" TEXT,
    "is_deleted" INTEGER,
    "created_at" TEXT,
    "updated_at" TEXT,
    FOREIGN KEY ("situation_id") REFERENCES "situations_travaux" ("id") ON DELETE CASCADE
);

-- Table « paiements_fournisseur »
CREATE TABLE IF NOT EXISTS "paiements_fournisseur" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "facture_id" INTEGER NOT NULL,
    "montant" TEXT NOT NULL,
    "date_paiement" TEXT NOT NULL DEFAULT CURRENT_DATE,
    "mode_paiement" TEXT NOT NULL DEFAULT 'virement',
    "reference" TEXT,
    "notes" TEXT,
    "created_by" INTEGER,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("created_by") REFERENCES "utilisateurs" ("id"),
    FOREIGN KEY ("facture_id") REFERENCES "factures_fournisseur" ("id"),
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_pf_entreprise_id" ON "paiements_fournisseur" ("entreprise_id");
CREATE INDEX IF NOT EXISTS "idx_pf_facture_id" ON "paiements_fournisseur" ("facture_id");

-- Table « lignes_factures »
CREATE TABLE IF NOT EXISTS "lignes_factures" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "facture_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'article',
    "article_id" INTEGER,
    "description" TEXT NOT NULL,
    "categorie" TEXT,
    "quantite" TEXT NOT NULL DEFAULT '0',
    "unite" TEXT,
    "prix_unitaire" TEXT NOT NULL DEFAULT '0',
    "remise" TEXT NOT NULL DEFAULT '0',
    "taux_tva" TEXT NOT NULL DEFAULT '20.00',
    "total_ht" TEXT NOT NULL DEFAULT '0',
    "total_ttc" TEXT NOT NULL DEFAULT '0',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("facture_id") REFERENCES "factures" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("article_id") REFERENCES "articles" ("id")
);
CREATE INDEX IF NOT EXISTS "idx_lignes_factures_article_id" ON "lignes_factures" ("article_id");
CREATE INDEX IF NOT EXISTS "idx_lignes_factures_facture_id" ON "lignes_factures" ("facture_id");

-- Table « paiements »
CREATE TABLE IF NOT EXISTS "paiements" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "entreprise_id" INTEGER NOT NULL,
    "facture_id" INTEGER NOT NULL,
    "montant" TEXT NOT NULL,
    "date_paiement" TEXT NOT NULL DEFAULT CURRENT_DATE,
    "mode_paiement" TEXT,
    "reference" TEXT,
    "banque" TEXT,
    "notes" TEXT,
    "is_deleted" INTEGER NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entreprise_id") REFERENCES "entreprises" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("facture_id") REFERENCES "factures" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_paiements_entreprise_id_is_deleted" ON "paiements" ("entreprise_id", "is_deleted");
CREATE INDEX IF NOT EXISTS "idx_paiements_facture_id" ON "paiements" ("facture_id");

-- ---------------------------------------------------------------------------
-- Tables de synchronisation desktop — UNION MANUELLE
-- (hors modèles backend — source : docs/plan-desktop-tauri.md §6.1 / §5.1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS _sync_outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT NOT NULL, entity_id TEXT NOT NULL, op TEXT NOT NULL, payload TEXT NOT NULL, client_ts TEXT NOT NULL, pushed INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS _sync_state (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS _sync_conflicts (id INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT NOT NULL, entity_id TEXT NOT NULL, local_payload TEXT, server_payload TEXT, detected_at TEXT);
CREATE TABLE IF NOT EXISTS local_session (email TEXT PRIMARY KEY, entreprise_id INTEGER, user_json TEXT, password_hash TEXT, activated_at TEXT);
