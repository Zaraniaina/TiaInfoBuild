"""Migration 035 - Colonnes de sync étendues aux 13 entités métier (PHASE 4).

Suite directe de 034 : mêmes colonnes et mêmes index sur les 13 tables
désormais synchronisées desktop ↔ web via POST /api/sync/push et
GET /api/sync/pull :

  articles, mouvements_stock, commandes_fournisseur, depenses, clients,
  devis, factures, conges, heures_supplementaires, materiaux, maintenances,
  taches, incidents.

- client_ref TEXT NULL + index : identité desktop (UUID généré côté client),
  le serveur mappe ce UUID sur la PK autoincrement ;
- sync_version INTEGER NOT NULL DEFAULT 1 : version serveur incrémentée à
  chaque écriture (hook app.core.sync_cols) → détection de conflit « le web gagne » ;
- sync_updated_at / sync_created_at DATETIME NULL (server_default + remplissage
  initial depuis updated_at/created_at) : curseur du GET /api/sync/pull.

Cas particulier `incidents` : la table n'avait PAS de colonne entreprise_id,
pourtant indispensable au scoping multi-tenant du moteur sync
(`_trouve_ligne` et `sync_pull` filtrent sur `model.entreprise_id`).
Ajoutée ici (nullable, BIGINT = type de entreprises.id) + index, backfillée
depuis le chantier parent. Les incidents créés ensuite côté web par
`add_incident()` restent à entreprise_id NULL tant que ce router ne la
renseigne pas (hors périmètre de cette migration).

Idempotent : existence des colonnes / index / FK vérifiée avant chaque
opération (convention 029→034) ; down_revision = 034 (head réelle).
"""
from alembic import op
import sqlalchemy as sa

revision = "035_sync_cols_ext"
down_revision = "034_sync_cols"
branch_labels = None
depends_on = None

# Les 13 tables synchronisées en PHASE 4 (mêmes colonnes que dans les modèles
# SQLAlchemy). PHASE 5 : les ajouter ici quand de nouvelles entités sont
# branchées à la sync.
TABLES_SYNC = (
    "articles",
    "mouvements_stock",
    "commandes_fournisseur",
    "depenses",
    "clients",
    "devis",
    "factures",
    "conges",
    "heures_supplementaires",
    "materiaux",
    "maintenances",
    "taches",
    "incidents",
)


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # --- incidents : colonne manquante requise par le scoping tenant sync ---
    # NOTE type : entreprises.id est INTEGER (display_width 11) — la FK doit
    # matcher EXACTEMENT ce type (errno 150 sinon, règle AGENTS.md).
    if "incidents" in tables:
        cols_inc = {c["name"]: c for c in inspector.get_columns("incidents")}
        if "entreprise_id" not in cols_inc:
            op.add_column(
                "incidents",
                sa.Column("entreprise_id", sa.Integer(), nullable=True),
            )
        else:
            # Auto-réparation idempotente : une tentative antérieure a pu créer
            # la colonne en BIGINT (DDL non transactionnel) → MODIFY vers INTEGER
            # pour que la FK corresponde au type de `entreprises.id`.
            type_courant = str(cols_inc["entreprise_id"]["type"])
            if "BIGINT" in type_courant.upper():
                op.alter_column(
                    "incidents",
                    "entreprise_id",
                    type_=sa.Integer(),
                    existing_type=sa.BigInteger(),
                    existing_nullable=True,
                )
        fks_inc = inspector.get_foreign_keys("incidents")
        if not any(fk.get("constrained_columns") == ["entreprise_id"] for fk in fks_inc):
            op.create_foreign_key(
                "fk_incidents_entreprise_id",
                "incidents",
                "entreprises",
                ["entreprise_id"],
                ["id"],
                ondelete="CASCADE",
            )
        idx_inc = {ix["name"] for ix in inspector.get_indexes("incidents")}
        if "idx_incidents_entreprise_id" not in idx_inc:
            op.create_index("idx_incidents_entreprise_id", "incidents", ["entreprise_id"])
        # Backfill tenant depuis le chantier parent (idempotent).
        op.execute(
            sa.text(
                "UPDATE incidents "
                "SET entreprise_id = ("
                "  SELECT chantiers.entreprise_id FROM chantiers"
                "  WHERE chantiers.id = incidents.chantier_id) "
                "WHERE entreprise_id IS NULL AND chantier_id IS NOT NULL"
            )
        )

    # --- Colonnes de sync + index (identique à 034) ---
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


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

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

    # incidents : on retire ce que 035 a ajouté (index → FK → colonne).
    if "incidents" in tables:
        cols_inc = {c["name"] for c in inspector.get_columns("incidents")}
        idx_inc = {ix["name"] for ix in inspector.get_indexes("incidents")}
        fks_inc = inspector.get_foreign_keys("incidents")
        if "idx_incidents_entreprise_id" in idx_inc:
            op.drop_index("idx_incidents_entreprise_id", table_name="incidents")
        if any(fk.get("constrained_columns") == ["entreprise_id"] for fk in fks_inc):
            op.drop_constraint("fk_incidents_entreprise_id", "incidents", type_="foreignkey")
        if "entreprise_id" in cols_inc:
            op.drop_column("incidents", "entreprise_id")
