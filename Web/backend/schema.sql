-- Schema SQL complet pour TIA INFO BUILD Web
-- MySQL 8.0 compatible
-- 35 tables: 11 tables transversales + 24 tables mÃ©tier
-- Convention: snake_case, soft delete (is_deleted), multi-tenant (entreprise_id)

-- ============================================================================
-- MODULE TRANSVERSAL
-- ============================================================================

-- 1. Entreprise (multi-tenant)
CREATE TABLE IF NOT EXISTS entreprises (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    nom                 VARCHAR(255) NOT NULL,
    nom_commercial      VARCHAR(255),
    adresse             TEXT,
    code_postal         VARCHAR(20),
    ville               VARCHAR(100),
    telephone           VARCHAR(50),
    email               VARCHAR(255),
    logo                TEXT,
    abonnement          VARCHAR(50) DEFAULT 'gratuit',
    devise              VARCHAR(10) DEFAULT 'MGA',
    siret               VARCHAR(50),
    numero_tva          VARCHAR(50),
    code_ape            VARCHAR(20),
    site_web            VARCHAR(255),
    prefixe_devis       VARCHAR(10) DEFAULT 'DEV',
    prefixe_facture     VARCHAR(10) DEFAULT 'FAC',
    prefixe_contrat     VARCHAR(10) DEFAULT 'CTR',
    tva_defaut          NUMERIC(5,2) DEFAULT 20.00,
    delai_paiement_defaut INTEGER DEFAULT 30,
    validite_devis      INTEGER DEFAULT 30,
    mentions_legales    TEXT,
    actif               TINYINT(1) DEFAULT 1,
    date_creation       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Role (RBAC)
CREATE TABLE IF NOT EXISTS roles (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    nom         VARCHAR(100) NOT NULL,
    description TEXT,
    code        VARCHAR(50) UNIQUE NOT NULL,
    permissions JSON,
    is_system   TINYINT(1) DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Utilisateur (entreprise_id=NULL pour super_admin)
CREATE TABLE IF NOT EXISTS utilisateurs (
    id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id         BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    role_id               BIGINT REFERENCES roles(id),
    nom                   VARCHAR(100) NOT NULL,
    prenom                VARCHAR(100),
    email                 VARCHAR(255) UNIQUE NOT NULL,
    telephone             VARCHAR(50),
    mot_de_passe_hash     VARCHAR(255) NOT NULL,
    statut                VARCHAR(20) DEFAULT 'actif',
    date_creation         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    derniere_connexion    TIMESTAMP,
    must_change_password  TINYINT(1) DEFAULT 0,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Preference utilisateur
CREATE TABLE IF NOT EXISTS preferences (
    id                     BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id               INTEGER UNIQUE REFERENCES utilisateurs(id) ON DELETE CASCADE,
    theme                 VARCHAR(20) DEFAULT 'auto',
    langue                VARCHAR(10) DEFAULT 'fr',
    date_format           VARCHAR(20) DEFAULT 'DD/MM/YYYY',
    devise                VARCHAR(10) DEFAULT 'MGA',
    notif_email           TINYINT(1) DEFAULT 1,
    notif_push            TINYINT(1) DEFAULT 1,
    notif_factures_retard TINYINT(1) DEFAULT 1,
    notif_stock_bas       TINYINT(1) DEFAULT 1,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. HistoriqueConnexion (logs)
CREATE TABLE IF NOT EXISTS historique_connexions (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id BIGINT REFERENCES utilisateurs(id) ON DELETE SET NULL,
    ip_address    VARCHAR(45),
    user_agent    TEXT,
    reussi        TINYINT(1) DEFAULT 1,
    date_connexion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. RefreshToken (JWT refresh rotation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id BIGINT REFERENCES utilisateurs(id) ON DELETE CASCADE,
    token_hash     VARCHAR(255) UNIQUE NOT NULL,
    expires_at     TIMESTAMP NOT NULL,
    revoked        TINYINT(1) DEFAULT 0,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MODULE CHANTIERS
-- ============================================================================

-- 7. Chantier
CREATE TABLE IF NOT EXISTS chantiers (
    id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id      BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    client_id          BIGINT REFERENCES clients(id),
    chef_chantier_id   BIGINT REFERENCES utilisateurs(id),
    numero             VARCHAR(50),
    nom                VARCHAR(255) NOT NULL,
    adresse            TEXT,
    code_postal        VARCHAR(20),
    ville              VARCHAR(100),
    date_debut         DATE,
    date_fin_prevue      DATE,
    date_fin_reelle    DATE,
    budget_prevu       NUMERIC(12,2) DEFAULT 0,
    budget_previsionnel NUMERIC(12,2) DEFAULT 0,
    budget_reel        NUMERIC(12,2) DEFAULT 0,
    marge_cible        NUMERIC(5,2) DEFAULT 0,
    tva                NUMERIC(5,2) DEFAULT 20.00,
    statut             VARCHAR(20) DEFAULT 'planification',
    description        TEXT,
    is_deleted         TINYINT(1) DEFAULT 0,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Phase
CREATE TABLE IF NOT EXISTS phases (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    chantier_id   BIGINT REFERENCES chantiers(id) ON DELETE CASCADE,
    nom           VARCHAR(255) NOT NULL,
    description   TEXT,
    date_debut    DATE,
    date_fin      DATE,
    budget        NUMERIC(12,2) DEFAULT 0,
    avancement_pct INTEGER DEFAULT 0,
    statut        VARCHAR(20) DEFAULT 'non_commencee',
    ordre         INTEGER DEFAULT 0,
    is_deleted    TINYINT(1) DEFAULT 0,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Incident
CREATE TABLE IF NOT EXISTS incidents (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    chantier_id   BIGINT REFERENCES chantiers(id) ON DELETE CASCADE,
    declare_par   BIGINT REFERENCES utilisateurs(id),
    titre         VARCHAR(255) NOT NULL,
    description   TEXT,
    date_incident DATE DEFAULT CURRENT_DATE,
    gravite       VARCHAR(20) DEFAULT 'moyenne',
    statut        VARCHAR(20) DEFAULT 'signale',
    is_deleted    TINYINT(1) DEFAULT 0,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. AffectationRessource
CREATE TABLE IF NOT EXISTS affectation_ressources (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    chantier_id   BIGINT REFERENCES chantiers(id) ON DELETE CASCADE,
    type_ressource VARCHAR(20) NOT NULL,
    ressource_id   INTEGER NOT NULL,
    date_debut    DATE,
    date_fin      DATE,
    role          VARCHAR(100),
    is_deleted    TINYINT(1) DEFAULT 0,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MODULE RH
-- ============================================================================

-- 11. EmployÃ©
CREATE TABLE IF NOT EXISTS employes (
    id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id      BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    matricule          VARCHAR(50),
    nom                VARCHAR(100) NOT NULL,
    prenom             VARCHAR(100),
    poste              VARCHAR(100),
    photo              TEXT,
    date_embauche      DATE,
    type_contrat       VARCHAR(20) DEFAULT 'CDI',
    date_debut_contrat DATE,
    date_fin_contrat   DATE,
    salaire_base       NUMERIC(10,2) DEFAULT 0,
    telephone          VARCHAR(50),
    email              VARCHAR(255),
    adresse            TEXT,
    statut             VARCHAR(20) DEFAULT 'actif',
    code_qr_badge      VARCHAR(100) UNIQUE,
    is_deleted         TINYINT(1) DEFAULT 0,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Ã‰quipe
CREATE TABLE IF NOT EXISTS equipes (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id  BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    chef_equipe_id BIGINT REFERENCES employes(id),
    nom            VARCHAR(255) NOT NULL,
    description    TEXT,
    specialite     VARCHAR(100),
    date_creation  DATE DEFAULT CURRENT_DATE,
    statut         VARCHAR(20) DEFAULT 'active',
    is_deleted     TINYINT(1) DEFAULT 0,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. MembreEquipe
CREATE TABLE IF NOT EXISTS membres_equipe (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    equipe_id     BIGINT REFERENCES equipes(id) ON DELETE CASCADE,
    employe_id    BIGINT REFERENCES employes(id) ON DELETE CASCADE,
    date_debut    DATE DEFAULT CURRENT_DATE,
    date_fin      DATE,
    role          VARCHAR(100),
    is_deleted    TINYINT(1) DEFAULT 0,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(equipe_id, employe_id, date_debut)
);

-- 14. AffectationChantier (employÃ©s â†’ chantier)
CREATE TABLE IF NOT EXISTS affectation_chantiers (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    employe_id  BIGINT REFERENCES employes(id) ON DELETE CASCADE,
    chantier_id BIGINT REFERENCES chantiers(id) ON DELETE CASCADE,
    date_debut  DATE,
    date_fin    DATE,
    role        VARCHAR(100),
    is_deleted  TINYINT(1) DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Pointage
CREATE TABLE IF NOT EXISTS pointages (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id       BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    employe_id          BIGINT REFERENCES employes(id) ON DELETE CASCADE,
    chantier_id         BIGINT REFERENCES chantiers(id),
    date_jour           DATE NOT NULL,
    heure_debut         TIME,
    heure_fin           TIME,
    heures_total        NUMERIC(4,2) DEFAULT 0,
    type                VARCHAR(20) DEFAULT 'present',
    methode_pointage    VARCHAR(50) DEFAULT 'manuel',
    scanne_par_id       BIGINT REFERENCES utilisateurs(id) ON DELETE SET NULL,
    latitude            NUMERIC(10,8),
    longitude           NUMERIC(11,8),
    statut_validation   VARCHAR(20) DEFAULT 'valide',
    notes               TEXT,
    is_deleted          TINYINT(1) DEFAULT 0,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employe_id, date_jour)
);

-- 16. HeureSupplementaire
CREATE TABLE IF NOT EXISTS heures_supplementaires (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id    BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    employe_id       BIGINT REFERENCES employes(id) ON DELETE CASCADE,
    chantier_id      BIGINT REFERENCES chantiers(id),
    date_hs          DATE NOT NULL,
    nb_heures        NUMERIC(4,2) DEFAULT 0,
    taux_majoration  NUMERIC(4,2) DEFAULT 1.5,
    motif            TEXT,
    statut           VARCHAR(20) DEFAULT 'en_attente',
    type_compensation VARCHAR(20) DEFAULT 'paiement',
    is_deleted       TINYINT(1) DEFAULT 0,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 17. HistoriquePoste
CREATE TABLE IF NOT EXISTS historique_postes (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id    BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    employe_id       BIGINT REFERENCES employes(id) ON DELETE CASCADE,
    poste            VARCHAR(100) NOT NULL,
    type_contrat     VARCHAR(20),
    salaire_base     NUMERIC(10,2) DEFAULT 0,
    date_debut       DATE NOT NULL,
    date_fin         DATE,
    motif_changement TEXT,
    is_deleted       TINYINT(1) DEFAULT 0,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MODULE MATÃ‰RIELS
-- ============================================================================

-- 18. Materiel
CREATE TABLE IF NOT EXISTS materiaux (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id    BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    nom              VARCHAR(255) NOT NULL,
    designation      VARCHAR(255),
    type             VARCHAR(100),
    marque           VARCHAR(100),
    modele           VARCHAR(100),
    numero_serie     VARCHAR(100),
    date_acquisition DATE,
    valeur_achat     NUMERIC(12,2) DEFAULT 0,
    description      TEXT,
    statut           VARCHAR(20) DEFAULT 'disponible',
    is_deleted       TINYINT(1) DEFAULT 0,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 19. AffectationMateriel
CREATE TABLE IF NOT EXISTS affectation_materiaux (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    materiel_id BIGINT REFERENCES materiaux(id) ON DELETE CASCADE,
    chantier_id BIGINT REFERENCES chantiers(id) ON DELETE CASCADE,
    date_debut  DATE,
    date_fin    DATE,
    is_deleted  TINYINT(1) DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 20. Maintenance
CREATE TABLE IF NOT EXISTS maintenances (
    id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id         BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    materiel_id           BIGINT REFERENCES materiaux(id) ON DELETE CASCADE,
    date_maintenance      DATE NOT NULL,
    type                  VARCHAR(50),
    cout                  NUMERIC(10,2) DEFAULT 0,
    description           TEXT,
    prochaine_date_echeance DATE,
    technicien            VARCHAR(255),
    is_deleted            TINYINT(1) DEFAULT 0,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 21. AlerteMateriel
CREATE TABLE IF NOT EXISTS alertes_materiel (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    materiel_id BIGINT REFERENCES materiaux(id),
    type        VARCHAR(50),
    message     TEXT,
    date_alerte TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    statut      VARCHAR(20) DEFAULT 'ouverte',
    is_deleted  TINYINT(1) DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MODULE STOCKS
-- ============================================================================

-- 22. Article
CREATE TABLE IF NOT EXISTS articles (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id   BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    reference       VARCHAR(100) UNIQUE,
    nom             VARCHAR(255) NOT NULL,
    description     TEXT,
    categorie       VARCHAR(100),
    unite           VARCHAR(20) DEFAULT 'unite',
    stock_actuel    NUMERIC(10,2) DEFAULT 0,
    seuil_alerte    NUMERIC(10,2) DEFAULT 0,
    stock_mini      NUMERIC(10,2) DEFAULT 0,
    prix_achat      NUMERIC(10,2) DEFAULT 0,
    prix_vente      NUMERIC(10,2) DEFAULT 0,
    marge           NUMERIC(5,2) DEFAULT 0,
    tva             NUMERIC(5,2) DEFAULT 20.00,
    poids           NUMERIC(10,2),
    fournisseur_id  BIGINT REFERENCES fournisseurs(id),
    code_barre      VARCHAR(100),
    emplacement     VARCHAR(100),
    is_deleted      TINYINT(1) DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 23. Fournisseur
CREATE TABLE IF NOT EXISTS fournisseurs (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id     BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    nom               VARCHAR(255) NOT NULL,
    contact           VARCHAR(255),
    email             VARCHAR(255),
    telephone         VARCHAR(50),
    adresse           TEXT,
    code_postal       VARCHAR(20),
    ville             VARCHAR(100),
    pays              VARCHAR(100) DEFAULT 'Madagascar',
    siret             VARCHAR(50),
    conditions_paiement TEXT,
    notes             TEXT,
    is_deleted        TINYINT(1) DEFAULT 0,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 24. MouvementStock
CREATE TABLE IF NOT EXISTS mouvements_stock (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id   BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    article_id      BIGINT REFERENCES articles(id) ON DELETE CASCADE,
    type_mouvement  VARCHAR(20) NOT NULL,
    date_mouvement  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    quantite        NUMERIC(10,2) NOT NULL,
    prix_unitaire   NUMERIC(10,2) DEFAULT 0,
    chantier_id     BIGINT REFERENCES chantiers(id),
    fournisseur_id  BIGINT REFERENCES fournisseurs(id),
    reference       VARCHAR(100),
    notes           TEXT,
    is_deleted      TINYINT(1) DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MODULE COMMERCIAL
-- ============================================================================

-- 25. Client
CREATE TABLE IF NOT EXISTS clients (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id    BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    type             VARCHAR(20) DEFAULT 'particulier',
    civilite         VARCHAR(20),
    nom              VARCHAR(255) NOT NULL,
    prenom           VARCHAR(100),
    entreprise       VARCHAR(255),
    siret            VARCHAR(50),
    numero_tva       VARCHAR(50),
    email            VARCHAR(255),
    telephone        VARCHAR(50),
    portable         VARCHAR(50),
    site_web         VARCHAR(255),
    adresse          TEXT,
    adresse_complement TEXT,
    code_postal      VARCHAR(20),
    ville            VARCHAR(100),
    pays             VARCHAR(100) DEFAULT 'Madagascar',
    conditions_paiement TEXT,
    mode_paiement    VARCHAR(50),
    encours_max      NUMERIC(12,2) DEFAULT 0,
    encours_actuel   NUMERIC(12,2) DEFAULT 0,
    commercial_id    BIGINT REFERENCES utilisateurs(id),
    origine          VARCHAR(100),
    rib              TEXT,
    notes            TEXT,
    ca_total         NUMERIC(12,2) DEFAULT 0,
    dernier_contact  TIMESTAMP,
    is_deleted       TINYINT(1) DEFAULT 0,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 26. ClientAdresse
CREATE TABLE IF NOT EXISTS client_adresses (
    id        BIGINT AUTO_INCREMENT PRIMARY KEY,
    client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
    type      VARCHAR(20) NOT NULL,
    defaut    TINYINT(1) DEFAULT 0,
    ligne1    VARCHAR(255) NOT NULL,
    ligne2    VARCHAR(255),
    code_postal VARCHAR(20),
    ville     VARCHAR(100),
    pays      VARCHAR(100) DEFAULT 'Madagascar',
    is_deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 27. Devis
CREATE TABLE IF NOT EXISTS devis (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id   BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    client_id       BIGINT REFERENCES clients(id) ON DELETE CASCADE,
    numero          VARCHAR(50) UNIQUE NOT NULL,
    objet           TEXT,
    montant_ht      NUMERIC(12,2) DEFAULT 0,
    tva             NUMERIC(5,2) DEFAULT 20.00,
    montant_ttc     NUMERIC(12,2) DEFAULT 0,
    date_creation   DATE DEFAULT CURRENT_DATE,
    date_validite   DATE,
    statut          VARCHAR(20) DEFAULT 'brouillon',
    conditions_paiement TEXT,
    mode_paiement   VARCHAR(50),
    notes           TEXT,
    is_deleted      TINYINT(1) DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 28. LigneDevis
CREATE TABLE IF NOT EXISTS lignes_devis (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    devis_id      BIGINT REFERENCES devis(id) ON DELETE CASCADE,
    type          VARCHAR(20) DEFAULT 'article',
    article_id    BIGINT REFERENCES articles(id),
    description   TEXT NOT NULL,
    quantite      NUMERIC(10,2) DEFAULT 0,
    unite         VARCHAR(20),
    prix_unitaire NUMERIC(10,2) DEFAULT 0,
    remise        NUMERIC(5,2) DEFAULT 0,
    taux_tva      NUMERIC(5,2) DEFAULT 20.00,
    total_ht      NUMERIC(12,2) DEFAULT 0,
    total_ttc     NUMERIC(12,2) DEFAULT 0,
    ordre          INTEGER DEFAULT 0,
    is_deleted    TINYINT(1) DEFAULT 0,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 29. Contrat
CREATE TABLE IF NOT EXISTS contrats (
    id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id      BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    client_id          BIGINT REFERENCES clients(id) ON DELETE CASCADE,
    reference          VARCHAR(50) UNIQUE NOT NULL,
    type_contrat       VARCHAR(50),
    montant            NUMERIC(12,2) DEFAULT 0,
    date_debut         DATE,
    date_fin           DATE,
    statut             VARCHAR(20) DEFAULT 'en_cours',
    chantier_id        BIGINT REFERENCES chantiers(id),
    devis_id           BIGINT REFERENCES devis(id),
    objet              TEXT,
    conditions_paiement TEXT,
    date_signature     DATE,
    garantie_mois      INTEGER DEFAULT 12,
    notes              TEXT,
    is_deleted         TINYINT(1) DEFAULT 0,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 30. Facture
CREATE TABLE IF NOT EXISTS factures (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id   BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    contrat_id      BIGINT REFERENCES contrats(id),
    client_id       BIGINT REFERENCES clients(id) ON DELETE CASCADE,
    numero          VARCHAR(50) UNIQUE NOT NULL,
    type            VARCHAR(20) DEFAULT 'standard',
    montant_ht      NUMERIC(12,2) DEFAULT 0,
    tva             NUMERIC(5,2) DEFAULT 20.00,
    montant_ttc     NUMERIC(12,2) DEFAULT 0,
    date_creation   DATE DEFAULT CURRENT_DATE,
    date_emission   DATE,
    date_echeance   DATE,
    statut          VARCHAR(20) DEFAULT 'emis',
    conditions_paiement TEXT,
    mode_paiement   VARCHAR(50),
    notes           TEXT,
    montant_paye    NUMERIC(12,2) DEFAULT 0,
    is_deleted      TINYINT(1) DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 31. Paiement
CREATE TABLE IF NOT EXISTS paiements (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id   BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    facture_id      BIGINT REFERENCES factures(id) ON DELETE CASCADE,
    montant         NUMERIC(12,2) NOT NULL,
    date_paiement   DATE DEFAULT CURRENT_DATE,
    mode_paiement   VARCHAR(50),
    reference       VARCHAR(100),
    banque          VARCHAR(100),
    notes           TEXT,
    is_deleted      TINYINT(1) DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MODULE FINANCE
-- ============================================================================

-- 32. Depense
CREATE TABLE IF NOT EXISTS depenses (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id    BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    chantier_id      BIGINT REFERENCES chantiers(id),
    description      TEXT NOT NULL,
    montant          NUMERIC(12,2) NOT NULL,
    date_depense     DATE DEFAULT CURRENT_DATE,
    categorie        VARCHAR(100),
    statut           VARCHAR(20) DEFAULT 'en_attente',
    fournisseur      VARCHAR(255),
    taux_tva         NUMERIC(5,2) DEFAULT 20.00,
    numero_facture   VARCHAR(100),
    mode_paiement    VARCHAR(50),
    validee_par      BIGINT REFERENCES utilisateurs(id),
    notes            TEXT,
    is_deleted       TINYINT(1) DEFAULT 0,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 33. RapportFinancier
CREATE TABLE IF NOT EXISTS rapports_financiers (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id    BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    chantier_id      BIGINT REFERENCES chantiers(id),
    periode          VARCHAR(20),
    chiffre_affaires NUMERIC(12,2) DEFAULT 0,
    depenses_total   NUMERIC(12,2) DEFAULT 0,
    marge            NUMERIC(12,2) DEFAULT 0,
    date_generation  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted       TINYINT(1) DEFAULT 0,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 34. Alerte
CREATE TABLE IF NOT EXISTS alertes (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    entreprise_id   BIGINT REFERENCES entreprises(id) ON DELETE CASCADE,
    titre           VARCHAR(255) NOT NULL,
    message         TEXT,
    type_entite     VARCHAR(50),
    entite_id       INTEGER,
    niveau_gravite  VARCHAR(20) DEFAULT 'info',
    statut          VARCHAR(20) DEFAULT 'non_lue',
    lue             TINYINT(1) DEFAULT 0,
    date_lecture    TIMESTAMP,
    is_deleted      TINYINT(1) DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 35. SyncQueue
CREATE TABLE IF NOT EXISTS sync_queue (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    table_name    VARCHAR(100) NOT NULL,
    record_id     INTEGER NOT NULL,
    server_id     INTEGER,
    operation     VARCHAR(20) NOT NULL,
    payload       JSON,
    status        VARCHAR(20) DEFAULT 'pending',
    retry_count   INTEGER DEFAULT 0,
    error_message TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES POUR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_utilisateurs_entreprise ON utilisateurs(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_email ON utilisateurs(email);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_role ON utilisateurs(role_id);
CREATE INDEX IF NOT EXISTS idx_chantiers_entreprise ON chantiers(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_chantiers_client ON chantiers(client_id);
CREATE INDEX IF NOT EXISTS idx_chantiers_chef ON chantiers(chef_chantier_id);
CREATE INDEX IF NOT EXISTS idx_employes_entreprise ON employes(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_employes_nom ON employes(nom, prenom);
CREATE INDEX IF NOT EXISTS idx_articles_entreprise ON articles(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_articles_reference ON articles(reference);
CREATE INDEX IF NOT EXISTS idx_articles_categorie ON articles(categorie);
CREATE INDEX IF NOT EXISTS idx_mouvements_article ON mouvements_stock(article_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_date ON mouvements_stock(date_mouvement);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_entreprise ON fournisseurs(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_clients_entreprise ON clients(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_clients_commercial ON clients(commercial_id);
CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(type);
CREATE INDEX IF NOT EXISTS idx_devis_entreprise ON devis(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_devis_numero ON devis(numero);
CREATE INDEX IF NOT EXISTS idx_devis_statut ON devis(statut);
CREATE INDEX IF NOT EXISTS idx_factures_entreprise ON factures(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_factures_client ON factures(client_id);
CREATE INDEX IF NOT EXISTS idx_factures_date_echeance ON factures(date_echeance);
CREATE INDEX IF NOT EXISTS idx_factures_statut ON factures(statut);
CREATE INDEX IF NOT EXISTS idx_paiements_facture ON paiements(facture_id);
CREATE INDEX IF NOT EXISTS idx_depenses_entreprise ON depenses(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_depenses_chantier ON depenses(chantier_id);
CREATE INDEX IF NOT EXISTS idx_depenses_categorie ON depenses(categorie);
CREATE INDEX IF NOT EXISTS idx_depenses_date ON depenses(date_depense);
CREATE INDEX IF NOT EXISTS idx_pointages_employe ON pointages(employe_id);
CREATE INDEX IF NOT EXISTS idx_pointages_date ON pointages(date_jour);
CREATE INDEX IF NOT EXISTS idx_pointages_chantier ON pointages(chantier_id);
CREATE INDEX IF NOT EXISTS idx_heures_sup_employe ON heures_supplementaires(employe_id);
CREATE INDEX IF NOT EXISTS idx_historique_postes_employe ON historique_postes(employe_id);
CREATE INDEX IF NOT EXISTS idx_alertes_entreprise ON alertes(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_alertes_statut ON alertes(statut);
CREATE INDEX IF NOT EXISTS idx_alertes_lue ON alertes(lue);
CREATE INDEX IF NOT EXISTS idx_materiel_entreprise ON materiaux(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_materiel_statut ON materiaux(statut);
CREATE INDEX IF NOT EXISTS idx_maintenances_materiel ON maintenances(materiel_id);
CREATE INDEX IF NOT EXISTS idx_contrats_entreprise ON contrats(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_contrats_client ON contrats(client_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_histo_connexions_user ON historique_connexions(utilisateur_id);
