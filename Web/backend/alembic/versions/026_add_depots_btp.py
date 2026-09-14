"""Migration 026: table depots BTP (dépôts, entrepôts, zones de stockage)

Revision ID: 026_add_depots_btp
Revises: 025_materiel_btp_vgp_mouvements
Create Date: 2026-09-14

- Crée la table `depots` : dépôts, entrepôts, zones extérieures, armoires outillage
  - Types BTP : magasin_principal | depot_chantier | zone_exterieure | armoire_outillage
  - Lié à l'entreprise (multi-tenant), soft-delete via is_deleted
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "026_add_depots_btp"
down_revision: Union[str, None] = "025_materiel_btp_vgp_mouvements"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing_tables = insp.get_table_names()

    if "depots" not in existing_tables:
        op.execute(sa.text("""
            CREATE TABLE depots (
                id          INT NOT NULL AUTO_INCREMENT,
                entreprise_id INT(11) NOT NULL,
                code        VARCHAR(50)  NOT NULL,
                nom         VARCHAR(255) NOT NULL,
                adresse     TEXT,
                responsable VARCHAR(255),
                telephone   VARCHAR(50),
                capacite_m2 DECIMAL(10,2),
                type        VARCHAR(50)  NOT NULL DEFAULT 'magasin_principal',
                is_deleted  TINYINT(1)   NOT NULL DEFAULT 0,
                created_at  DATETIME     NOT NULL DEFAULT NOW(),
                updated_at  DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
                PRIMARY KEY (id),
                CONSTRAINT fk_depots_entreprise
                    FOREIGN KEY (entreprise_id)
                    REFERENCES entreprises (id)
                    ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """))
        op.execute(sa.text("CREATE INDEX idx_depots_entreprise_id ON depots (entreprise_id)"))
        op.execute(sa.text("CREATE INDEX idx_depots_entreprise_id_is_deleted ON depots (entreprise_id, is_deleted)"))
        op.execute(sa.text("CREATE INDEX idx_depots_code ON depots (code)"))


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if "depots" in insp.get_table_names():
        op.execute(sa.text("DROP TABLE depots"))

