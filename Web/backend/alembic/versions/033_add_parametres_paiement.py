"""Migration 033 - Configuration passerelle de paiement Papi.mg (super admin).

Table :
- parametres_paiement : singleton id=1 stockant les clés de la boutique Papi
  (api_key = header "Token", webhook_secret = signature X-Papi-Signature),
  l'environnement (sandbox|production), les providers actifs (CSV), les URLs
  de callback et la traçabilité du dernier test de connexion.

Sans cette table, la page Super Admin « Passerelle de Paiement » renvoie une
erreur 500 (1146 Table doesn't exist).
Idempotent (vérifie l'existence avant création), convention 029/030/031/032.
"""
from alembic import op
import sqlalchemy as sa

revision = "033_add_parametres_paiement"
down_revision = "032_add_achats"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "parametres_paiement" not in tables:
        # Pas de FK : table de configuration singleton (id=1), sans rattachement.
        op.execute(sa.text("""
            CREATE TABLE parametres_paiement (
                id                    BIGINT NOT NULL AUTO_INCREMENT,
                api_key               VARCHAR(255),
                webhook_secret        VARCHAR(255),
                environment           VARCHAR(20) NOT NULL DEFAULT 'sandbox',
                providers_actifs      VARCHAR(255),
                notification_url      VARCHAR(500),
                success_url           VARCHAR(500),
                failure_url           VARCHAR(500),
                is_test_mode          TINYINT(1) NOT NULL DEFAULT 1,
                dernier_test_at       DATETIME,
                dernier_test_ok       TINYINT(1),
                dernier_test_message  TEXT,
                is_deleted            TINYINT(1) NOT NULL DEFAULT 0,
                created_at            DATETIME NOT NULL DEFAULT NOW(),
                updated_at            DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
                PRIMARY KEY (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "parametres_paiement" in inspector.get_table_names():
        op.execute(sa.text("DROP TABLE parametres_paiement"))
