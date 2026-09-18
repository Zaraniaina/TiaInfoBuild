"""Migration 031 - Aleas climatiques : dimension climatique des incidents.

- `incidents.type_alea` : type d'alea climatique (cyclone, inondation,
  pluies_intenses, secheresse, route_coupee, coupure_electricite, autre).
- `incidents.date_fin` : fin de la periode d'alea (complete `date_incident`).
- `incidents.impact_arret_jours` : nombre de jours d'arret de chantier.
- `incidents.imputabilite` : climatique | entreprise | client | indetermine —
  sert au calcul du retard "negociable" vs imputable a l'entreprise
  (penalites de retard contractuelles, contexte Madagascar).
- Table `periodes_risque_climatique` : periodes a risque pre-marquees par
  entreprise/region (saison cyclonique dec.-mars, saison des pluies nov.-mars).
- `chantiers.region` : rattache le chantier a sa zone geographique.
Idempotent (verifie l'existence avant creation), convention des migrations
029/030.
"""
from alembic import op
import sqlalchemy as sa

revision = "031_add_aleas_climatiques"
down_revision = "030_prefixe_employe"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    cols_incidents = {c["name"] for c in inspector.get_columns("incidents")}
    if "type_alea" not in cols_incidents:
        op.add_column("incidents", sa.Column("type_alea", sa.String(30), nullable=True))
    if "date_fin" not in cols_incidents:
        op.add_column("incidents", sa.Column("date_fin", sa.Date(), nullable=True))
    if "impact_arret_jours" not in cols_incidents:
        op.add_column(
            "incidents",
            sa.Column("impact_arret_jours", sa.Integer(), nullable=True),
        )
    if "imputabilite" not in cols_incidents:
        op.add_column("incidents", sa.Column("imputabilite", sa.String(20), nullable=True))

    if "periodes_risque_climatique" not in inspector.get_table_names():
        # FK entreprise_id en INT(11) : les PK réels en base sont INT (les
        # colonnes n'ont jamais été converties en BIGINT — voir 007 qui
        # échouait silencieusement). Convention SQL brut de la migration 026.
        op.execute(sa.text("""
            CREATE TABLE periodes_risque_climatique (
                id            BIGINT NOT NULL AUTO_INCREMENT,
                entreprise_id INT(11) NOT NULL,
                region        VARCHAR(80) NOT NULL,
                type_risque   VARCHAR(30) NOT NULL,
                date_debut    DATE NOT NULL,
                date_fin      DATE NOT NULL,
                description   TEXT,
                is_deleted    TINYINT(1) NOT NULL DEFAULT 0,
                created_at    DATETIME NOT NULL DEFAULT NOW(),
                updated_at    DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
                PRIMARY KEY (id),
                CONSTRAINT fk_prc_entreprise
                    FOREIGN KEY (entreprise_id)
                    REFERENCES entreprises (id)
                    ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """))
        op.execute(sa.text("CREATE INDEX idx_prc_entreprise_id ON periodes_risque_climatique (entreprise_id)"))

    cols_chantiers = {c["name"] for c in inspector.get_columns("chantiers")}
    if "region" not in cols_chantiers:
        op.add_column("chantiers", sa.Column("region", sa.String(80), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols_chantiers = {c["name"] for c in inspector.get_columns("chantiers")}
    if "region" in cols_chantiers:
        op.drop_column("chantiers", "region")
    if "periodes_risque_climatique" in inspector.get_table_names():
        op.drop_table("periodes_risque_climatique")
    cols_incidents = {c["name"] for c in inspector.get_columns("incidents")}
    for col in ("imputabilite", "impact_arret_jours", "date_fin", "type_alea"):
        if col in cols_incidents:
            op.drop_column("incidents", col)
