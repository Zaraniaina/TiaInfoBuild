"""Migration 032 - Module Achats fournisseurs (cycle complet).

Tables :
- commandes_fournisseur + lignes_commande_fournisseur : bons de commande
  (statuts: brouillon, envoyee, confirmee, partiellement_recue, recue,
  annulee ; lignes rattachees a un article et un chantier optionnel).
- receptions_fournisseur : réceptions (totales/partielles) d'une commande ;
  l'entree en stock est generee par le router (MouvementStock 'entree').
- factures_fournisseur + paiements_fournisseur : factures d'achat
  (statuts: a_payer, partiellement_payee, payee, litige, annulee),
  rattachees a une commande optionnelle ; paiement de la plateforme
  PaiementFournisseur (MVola/Orange Money/Airtel/virement/especes).
Idempotent (verifie l'existence avant creation), convention 029/030/031.
"""
from alembic import op
import sqlalchemy as sa

revision = "032_add_achats"
down_revision = "031_add_aleas_climatiques"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "commandes_fournisseur" not in tables:
        # Convention SQL brut (migration 026) : FK en INT(11) vers les PK INT
        # réels en base (entreprises/fournisseurs/chantiers/utilisateurs).
        op.execute(sa.text("""
            CREATE TABLE commandes_fournisseur (
                id            BIGINT NOT NULL AUTO_INCREMENT,
                entreprise_id INT(11) NOT NULL,
                fournisseur_id INT(11) NOT NULL,
                numero        VARCHAR(50) NOT NULL UNIQUE,
                chantier_id   INT(11),
                date_commande DATE NOT NULL DEFAULT (CURRENT_DATE),
                date_livraison_prevue DATE,
                statut        VARCHAR(30) NOT NULL DEFAULT 'brouillon',
                montant_ht    DECIMAL(14,2) NOT NULL DEFAULT 0,
                taux_tva      DECIMAL(5,2)  NOT NULL DEFAULT 20.00,
                montant_tva   DECIMAL(14,2) NOT NULL DEFAULT 0,
                montant_ttc   DECIMAL(14,2) NOT NULL DEFAULT 0,
                notes         TEXT,
                created_by    INT(11),
                is_deleted    TINYINT(1) NOT NULL DEFAULT 0,
                created_at    DATETIME NOT NULL DEFAULT NOW(),
                updated_at    DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
                PRIMARY KEY (id),
                CONSTRAINT fk_cf_entreprise  FOREIGN KEY (entreprise_id)  REFERENCES entreprises (id)  ON DELETE CASCADE,
                CONSTRAINT fk_cf_fournisseur FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs (id),
                CONSTRAINT fk_cf_chantier    FOREIGN KEY (chantier_id)    REFERENCES chantiers (id),
                CONSTRAINT fk_cf_user        FOREIGN KEY (created_by)     REFERENCES utilisateurs (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """))
        op.execute(sa.text("CREATE INDEX idx_cf_entreprise_id ON commandes_fournisseur (entreprise_id)"))
        op.execute(sa.text("CREATE INDEX idx_cf_entreprise_id_is_deleted ON commandes_fournisseur (entreprise_id, is_deleted)"))
        op.execute(sa.text("CREATE INDEX idx_cf_fournisseur_id ON commandes_fournisseur (fournisseur_id)"))
        op.execute(sa.text("CREATE INDEX idx_cf_chantier_id ON commandes_fournisseur (chantier_id)"))
        op.execute(sa.text("CREATE INDEX idx_cf_statut ON commandes_fournisseur (statut)"))

    if "lignes_commande_fournisseur" not in tables:
        op.execute(sa.text("""
            CREATE TABLE lignes_commande_fournisseur (
                id            BIGINT NOT NULL AUTO_INCREMENT,
                commande_id   BIGINT NOT NULL,
                article_id    INT(11),
                designation   VARCHAR(255) NOT NULL,
                quantite      DECIMAL(12,2) NOT NULL,
                quantite_recue DECIMAL(12,2) NOT NULL DEFAULT 0,
                prix_unitaire DECIMAL(12,2) NOT NULL DEFAULT 0,
                montant_ht    DECIMAL(14,2) NOT NULL DEFAULT 0,
                notes         TEXT,
                created_at    DATETIME NOT NULL DEFAULT NOW(),
                updated_at    DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
                PRIMARY KEY (id),
                CONSTRAINT fk_lcf_commande FOREIGN KEY (commande_id) REFERENCES commandes_fournisseur (id) ON DELETE CASCADE,
                CONSTRAINT fk_lcf_article  FOREIGN KEY (article_id)  REFERENCES articles (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """))
        op.execute(sa.text("CREATE INDEX idx_lcf_commande_id ON lignes_commande_fournisseur (commande_id)"))
        op.execute(sa.text("CREATE INDEX idx_lcf_article_id ON lignes_commande_fournisseur (article_id)"))

    if "receptions_fournisseur" not in tables:
        op.execute(sa.text("""
            CREATE TABLE receptions_fournisseur (
                id            BIGINT NOT NULL AUTO_INCREMENT,
                entreprise_id INT(11) NOT NULL,
                commande_id   BIGINT NOT NULL,
                numero        VARCHAR(50),
                date_reception DATE NOT NULL DEFAULT (CURRENT_DATE),
                depot_id      INT(11),
                chantier_id   INT(11),
                complete      TINYINT(1) NOT NULL DEFAULT 0,
                notes         TEXT,
                received_by   INT(11),
                is_deleted    TINYINT(1) NOT NULL DEFAULT 0,
                created_at    DATETIME NOT NULL DEFAULT NOW(),
                updated_at    DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
                PRIMARY KEY (id),
                CONSTRAINT fk_rf_entreprise FOREIGN KEY (entreprise_id) REFERENCES entreprises (id) ON DELETE CASCADE,
                CONSTRAINT fk_rf_commande   FOREIGN KEY (commande_id)   REFERENCES commandes_fournisseur (id),
                CONSTRAINT fk_rf_depot      FOREIGN KEY (depot_id)      REFERENCES depots (id),
                CONSTRAINT fk_rf_chantier   FOREIGN KEY (chantier_id)   REFERENCES chantiers (id),
                CONSTRAINT fk_rf_user       FOREIGN KEY (received_by)   REFERENCES utilisateurs (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """))
        op.execute(sa.text("CREATE INDEX idx_rf_commande_id ON receptions_fournisseur (commande_id)"))
        op.execute(sa.text("CREATE INDEX idx_rf_entreprise_id ON receptions_fournisseur (entreprise_id)"))

    if "lignes_reception_fournisseur" not in tables:
        op.execute(sa.text("""
            CREATE TABLE lignes_reception_fournisseur (
                id               BIGINT NOT NULL AUTO_INCREMENT,
                reception_id     BIGINT NOT NULL,
                ligne_commande_id BIGINT NOT NULL,
                quantite_recue   DECIMAL(12,2) NOT NULL,
                conforme         TINYINT(1) NOT NULL DEFAULT 1,
                notes            TEXT,
                created_at       DATETIME NOT NULL DEFAULT NOW(),
                PRIMARY KEY (id),
                CONSTRAINT fk_lrf_reception FOREIGN KEY (reception_id) REFERENCES receptions_fournisseur (id) ON DELETE CASCADE,
                CONSTRAINT fk_lrf_ligne     FOREIGN KEY (ligne_commande_id) REFERENCES lignes_commande_fournisseur (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """))
        op.execute(sa.text("CREATE INDEX idx_lrf_reception_id ON lignes_reception_fournisseur (reception_id)"))

    if "factures_fournisseur" not in tables:
        op.execute(sa.text("""
            CREATE TABLE factures_fournisseur (
                id            BIGINT NOT NULL AUTO_INCREMENT,
                entreprise_id INT(11) NOT NULL,
                fournisseur_id INT(11) NOT NULL,
                commande_id   BIGINT,
                chantier_id   INT(11),
                numero        VARCHAR(100) NOT NULL,
                date_facture  DATE NOT NULL DEFAULT (CURRENT_DATE),
                date_echeance DATE,
                statut        VARCHAR(30) NOT NULL DEFAULT 'a_payer',
                montant_ht    DECIMAL(14,2) NOT NULL DEFAULT 0,
                taux_tva      DECIMAL(5,2)  NOT NULL DEFAULT 20.00,
                montant_tva   DECIMAL(14,2) NOT NULL DEFAULT 0,
                montant_ttc   DECIMAL(14,2) NOT NULL DEFAULT 0,
                montant_paye  DECIMAL(14,2) NOT NULL DEFAULT 0,
                notes         TEXT,
                is_deleted    TINYINT(1) NOT NULL DEFAULT 0,
                created_at    DATETIME NOT NULL DEFAULT NOW(),
                updated_at    DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
                PRIMARY KEY (id),
                CONSTRAINT fk_ff_entreprise  FOREIGN KEY (entreprise_id)  REFERENCES entreprises (id)  ON DELETE CASCADE,
                CONSTRAINT fk_ff_fournisseur FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs (id),
                CONSTRAINT fk_ff_commande    FOREIGN KEY (commande_id)    REFERENCES commandes_fournisseur (id),
                CONSTRAINT fk_ff_chantier    FOREIGN KEY (chantier_id)    REFERENCES chantiers (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """))
        op.execute(sa.text("CREATE INDEX idx_ff_entreprise_id ON factures_fournisseur (entreprise_id)"))
        op.execute(sa.text("CREATE INDEX idx_ff_entreprise_id_is_deleted ON factures_fournisseur (entreprise_id, is_deleted)"))
        op.execute(sa.text("CREATE INDEX idx_ff_fournisseur_id ON factures_fournisseur (fournisseur_id)"))
        op.execute(sa.text("CREATE INDEX idx_ff_statut ON factures_fournisseur (statut)"))
        op.execute(sa.text("CREATE INDEX idx_ff_date_echeance ON factures_fournisseur (date_echeance)"))

    if "paiements_fournisseur" not in tables:
        op.execute(sa.text("""
            CREATE TABLE paiements_fournisseur (
                id            BIGINT NOT NULL AUTO_INCREMENT,
                entreprise_id INT(11) NOT NULL,
                facture_id    BIGINT NOT NULL,
                montant       DECIMAL(14,2) NOT NULL,
                date_paiement DATE NOT NULL DEFAULT (CURRENT_DATE),
                mode_paiement VARCHAR(30) NOT NULL DEFAULT 'virement',
                reference     VARCHAR(100),
                notes         TEXT,
                created_by    INT(11),
                is_deleted    TINYINT(1) NOT NULL DEFAULT 0,
                created_at    DATETIME NOT NULL DEFAULT NOW(),
                updated_at    DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
                PRIMARY KEY (id),
                CONSTRAINT fk_pf_entreprise FOREIGN KEY (entreprise_id) REFERENCES entreprises (id) ON DELETE CASCADE,
                CONSTRAINT fk_pf_facture    FOREIGN KEY (facture_id)    REFERENCES factures_fournisseur (id),
                CONSTRAINT fk_pf_user       FOREIGN KEY (created_by)    REFERENCES utilisateurs (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """))
        op.execute(sa.text("CREATE INDEX idx_pf_facture_id ON paiements_fournisseur (facture_id)"))
        op.execute(sa.text("CREATE INDEX idx_pf_entreprise_id ON paiements_fournisseur (entreprise_id)"))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    for t in (
        "paiements_fournisseur",
        "factures_fournisseur",
        "lignes_reception_fournisseur",
        "receptions_fournisseur",
        "lignes_commande_fournisseur",
        "commandes_fournisseur",
    ):
        if t in tables:
            op.drop_table(t)
