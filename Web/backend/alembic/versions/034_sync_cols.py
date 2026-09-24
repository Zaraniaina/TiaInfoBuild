"""Migration 034 - Colonnes de synchronisation desktop (offline-first).

Sur les 3 tables synchronisées (pointages, chantiers, employes) :
- client_ref TEXT NULL + index : identité desktop (UUID généré côté client),
  le serveur mappe ce UUID sur la PK BIGINT autoincrement ;
- sync_version INTEGER NOT NULL DEFAULT 1 : version serveur incrémentée à
  chaque écriture (hook app.core.sync_cols) → détection de conflit « le web gagne » ;
- sync_updated_at / sync_created_at DATETIME NULL (server_default + remplissage
  initial depuis updated_at/created_at) : curseur du GET /api/sync/pull.

Plus la table de déduplication du push :
- sync_applied(device_id VARCHAR(128), seq, applied_at, PK(device_id, seq)).

Pathempotent : existence des colonnes/index/table vérifiée avant chaque opération.
Convention 029/030/031/032/033 ; down_revision = head réelle (033).
Note : device_id est VARCHAR(128) et non TEXT — MySQL/MariaDB refusent une
colonne TEXT en PK sans longueur de préfixe (erreur 1170).
"""
from alembic import op
import sqlalchemy as sa

revision = "034_sync_cols"
down_revision = "033_add_parametres_paiement"
branch_labels = None
depends_on = None

# Tables synchronisées — PHASE 4 : les ajouter ici quand de nouvelles entités
# sont branchées à la sync (mêmes colonnes que dans les modèles SQLAlchemy).
TABLES_SYNC = ("pointages", "chantiers", "employes")


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    for table in TABLES_SYNC:
        if table not in tables:
            continue
        cols = {c["name"] for c in inspector.get_columns(table)}

        if "client_ref" not in cols:
            op.add_column(table, sa.Column("client_ref", sa.Text(), nullable=True))
        if "sync_version" not in cols:
            op.add_column(
                table,
                sa.Column("sync_version", sa.Integer(), nullable=False, server_default="1"),
            )
        if "sync_updated_at" not in cols:
            op.add_column(
                table,
                sa.Column("sync_updated_at", sa.DateTime(), nullable=True, server_default=sa.func.now()),
            )
        if "sync_created_at" not in cols:
            op.add_column(
                table,
                sa.Column("sync_created_at", sa.DateTime(), nullable=True, server_default=sa.func.now()),
            )

        # Remplissage initial des lignes existantes (idempotent : ne touche que
        # les lignes dont sync_updated_at est encore NULL).
        op.execute(
            sa.text(
                f"UPDATE {table} "
                "SET sync_created_at = COALESCE(created_at, NOW()), "
                "    sync_updated_at = COALESCE(updated_at, NOW()) "
                "WHERE sync_updated_at IS NULL OR sync_created_at IS NULL"
            )
        )

        existing_idx = {ix["name"] for ix in inspector.get_indexes(table)}
        idx_ref = f"idx_{table}_client_ref"
        if idx_ref not in existing_idx:
            op.create_index(idx_ref, table, ["client_ref"])
        idx_sync = f"idx_{table}_sync_updated_at"
        if idx_sync not in existing_idx:
            op.create_index(idx_sync, table, ["sync_updated_at"])

    # Table de déduplication du push (idempotence par couple device_id + seq).
    if "sync_applied" not in tables:
        op.create_table(
            "sync_applied",
            sa.Column("device_id", sa.String(128), nullable=False),
            sa.Column("seq", sa.Integer(), nullable=False),
            sa.Column("applied_at", sa.Text(), nullable=False),
            sa.PrimaryKeyConstraint("device_id", "seq", name="pk_sync_applied"),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "sync_applied" in tables:
        op.drop_table("sync_applied")

    for table in TABLES_SYNC:
        if table not in tables:
            continue
        cols = {c["name"] for c in inspector.get_columns(table)}
        existing_idx = {ix["name"] for ix in inspector.get_indexes(table)}
        for idx_name in (f"idx_{table}_client_ref", f"idx_{table}_sync_updated_at"):
            if idx_name in existing_idx:
                op.drop_index(idx_name, table_name=table)
        for col_name in ("sync_created_at", "sync_updated_at", "sync_version", "client_ref"):
            if col_name in cols:
                op.drop_column(table, col_name)
