"""dix-septieme migration: espace employe terrain

Revision ID: 017_espace_terrain
Revises: 016_espace_client
Create Date: 2026-09-07

- pointages.heure_pause_debut / heure_pause_fin : gestion des pauses
- employes.badge_statut / badge_date_creation / badge_date_desactivation :
  cycle de vie du badge QR (desactive -> regenere)
- table taches : taches attribuees a un employe sur un chantier
- table travaux_realises : declaration de travail effectue par l'employe
- table rapports_journaliers : rapport journalier de l'employe
- table photos_chantier : photos transmises depuis le terrain
- table signalements : signalements (incident, securite, materiel...)
- table commentaires : communication simple (tache/rapport/signalement)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "017_espace_terrain"
down_revision: Union[str, None] = "016_espace_client"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(insp, name: str) -> bool:
    try:
        return name in insp.get_table_names()
    except Exception:
        # Fallback: use raw SQL
        conn = insp.bind
        if conn is None:
            return False
        try:
            result = conn.exec_driver_sql(f"SHOW TABLES LIKE '{name}'")
            return result.fetchall().__len__() > 0
        except Exception:
            return True  # Safety: assume exists to avoid duplicate create



def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # 1. Colonnes pauses sur pointages
    cols_pt = {c["name"] for c in insp.get_columns("pointages")}
    if "heure_pause_debut" not in cols_pt:
        op.add_column("pointages", sa.Column("heure_pause_debut", sa.Time(), nullable=True))
    if "heure_pause_fin" not in cols_pt:
        op.add_column("pointages", sa.Column("heure_pause_fin", sa.Time(), nullable=True))

    # 2. Cycle de vie du badge sur employes
    cols_emp = {c["name"] for c in insp.get_columns("employes")}
    if "badge_statut" not in cols_emp:
        op.add_column("employes", sa.Column("badge_statut", sa.String(20), server_default="actif"))
    if "badge_date_creation" not in cols_emp:
        op.add_column("employes", sa.Column("badge_date_creation", sa.DateTime(), nullable=True))
    if "badge_date_desactivation" not in cols_emp:
        op.add_column("employes", sa.Column("badge_date_desactivation", sa.DateTime(), nullable=True))

    # 3. table taches
    if not _table_exists(insp, "taches"):
        op.create_table(
            "taches",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column("entreprise_id", sa.Integer(), sa.ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True),
            sa.Column("chantier_id", sa.Integer(), sa.ForeignKey("chantiers.id", ondelete="CASCADE"), nullable=True),
            sa.Column("employe_id", sa.Integer(), sa.ForeignKey("employes.id", ondelete="CASCADE"), nullable=True),
            sa.Column("ouvrage", sa.String(255), nullable=True),
            sa.Column("titre", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("date_prevue", sa.Date(), nullable=True),
            sa.Column("priorite", sa.String(20), server_default="normale"),
            sa.Column("statut", sa.String(20), server_default="a_faire"),
            sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        )
        op.create_index("idx_taches_employe_id", "taches", ["employe_id"])
        op.create_index("idx_taches_chantier_id", "taches", ["chantier_id"])
        op.create_index("idx_taches_entreprise_id", "taches", ["entreprise_id"])

        # 4. table travaux_realises (table taches creee avant, FK possible)
    if not _table_exists(insp, "travaux_realises"):
        op.create_table(
            "travaux_realises",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column("entreprise_id", sa.Integer(), sa.ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True),
            sa.Column("chantier_id", sa.Integer(), sa.ForeignKey("chantiers.id", ondelete="CASCADE"), nullable=True),
            sa.Column("employe_id", sa.Integer(), sa.ForeignKey("employes.id", ondelete="CASCADE"), nullable=True),
            sa.Column("tache_id", sa.BigInteger(), sa.ForeignKey("taches.id", ondelete="SET NULL"), nullable=True),
            sa.Column("date_travail", sa.Date(), nullable=True),
            sa.Column("ouvrage", sa.String(255), nullable=True),
            sa.Column("travail", sa.String(255), nullable=False),
            sa.Column("quantite", sa.Numeric(12, 2), server_default="0"),
            sa.Column("unite", sa.String(20), nullable=True),
            sa.Column("duree_heures", sa.Numeric(5, 2), server_default="0"),
            sa.Column("observations", sa.Text(), nullable=True),
            sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        )
        op.create_index("idx_travaux_realises_employe_id", "travaux_realises", ["employe_id"])
        op.create_index("idx_travaux_realises_chantier_id", "travaux_realises", ["chantier_id"])

    # 5. table rapports_journaliers
    if not _table_exists(insp, "rapports_journaliers"):
        op.create_table(
            "rapports_journaliers",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column("entreprise_id", sa.Integer(), sa.ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True),
            sa.Column("chantier_id", sa.Integer(), sa.ForeignKey("chantiers.id", ondelete="CASCADE"), nullable=True),
            sa.Column("employe_id", sa.Integer(), sa.ForeignKey("employes.id", ondelete="CASCADE"), nullable=True),
            sa.Column("date_rapport", sa.Date(), nullable=True),
            sa.Column("travaux_realises", sa.Text(), nullable=True),
            sa.Column("quantites", sa.Text(), nullable=True),
            sa.Column("personnel_present", sa.String(255), nullable=True),
            sa.Column("materiel_utilise", sa.Text(), nullable=True),
            sa.Column("materiaux_utilises", sa.Text(), nullable=True),
            sa.Column("incidents", sa.Text(), nullable=True),
            sa.Column("difficultes", sa.Text(), nullable=True),
            sa.Column("observations", sa.Text(), nullable=True),
            sa.Column("nb_photos", sa.Integer(), server_default="0"),
            sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        )
        op.create_index("idx_rapports_journaliers_employe_id", "rapports_journaliers", ["employe_id"])
        op.create_index("idx_rapports_journaliers_chantier_id", "rapports_journaliers", ["chantier_id"])

    # 6. table photos_chantier
    if not _table_exists(insp, "photos_chantier"):
        op.create_table(
            "photos_chantier",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column("entreprise_id", sa.Integer(), sa.ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True),
            sa.Column("chantier_id", sa.Integer(), sa.ForeignKey("chantiers.id", ondelete="CASCADE"), nullable=True),
            sa.Column("employe_id", sa.Integer(), sa.ForeignKey("employes.id", ondelete="CASCADE"), nullable=True),
            sa.Column("tache_id", sa.BigInteger(), sa.ForeignKey("taches.id", ondelete="SET NULL"), nullable=True),
            sa.Column("fichier_url", sa.String(500), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("zone", sa.String(255), nullable=True),
            sa.Column("date_prise", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        )
        op.create_index("idx_photos_chantier_employe_id", "photos_chantier", ["employe_id"])
        op.create_index("idx_photos_chantier_chantier_id", "photos_chantier", ["chantier_id"])

    # 7. table signalements
    if not _table_exists(insp, "signalements"):
        op.create_table(
            "signalements",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column("entreprise_id", sa.Integer(), sa.ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True),
            sa.Column("chantier_id", sa.Integer(), sa.ForeignKey("chantiers.id", ondelete="CASCADE"), nullable=True),
            sa.Column("employe_id", sa.Integer(), sa.ForeignKey("employes.id", ondelete="CASCADE"), nullable=True),
            sa.Column("type", sa.String(50), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("zone", sa.String(255), nullable=True),
            sa.Column("priorite", sa.String(10), server_default="normale"),
            sa.Column("photo_url", sa.String(500), nullable=True),
            sa.Column("statut", sa.String(20), server_default="signale"),
            sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        )
        op.create_index("idx_signalements_employe_id", "signalements", ["employe_id"])
        op.create_index("idx_signalements_chantier_id", "signalements", ["chantier_id"])

    # 8. table commentaires
    if not _table_exists(insp, "commentaires"):
        op.create_table(
            "commentaires",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column("entreprise_id", sa.Integer(), sa.ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True),
            sa.Column("chantier_id", sa.Integer(), sa.ForeignKey("chantiers.id", ondelete="CASCADE"), nullable=True),
            sa.Column("employe_id", sa.Integer(), sa.ForeignKey("employes.id", ondelete="CASCADE"), nullable=True),
            sa.Column("utilisateur_id", sa.Integer(), sa.ForeignKey("utilisateurs.id", ondelete="CASCADE"), nullable=True),
            sa.Column("objet_type", sa.String(30), nullable=True),
            sa.Column("objet_id", sa.Integer(), nullable=True),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        )
        op.create_index("idx_commentaires_employe_id", "commentaires", ["employe_id"])
        op.create_index("idx_commentaires_objet", "commentaires", ["objet_type", "objet_id"])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    for tab in ["commentaires", "signalements", "photos_chantier", "rapports_journaliers",
                "travaux_realises", "taches"]:
        if tab in insp.get_table_names():
            op.drop_table(tab)

    cols_emp = {c["name"] for c in insp.get_columns("employes")}
    for col in ("badge_date_desactivation", "badge_date_creation", "badge_statut"):
        if col in cols_emp:
            op.drop_column("employes", col)

    cols_pt = {c["name"] for c in insp.get_columns("pointages")}
    for col in ("heure_pause_fin", "heure_pause_debut"):
        if col in cols_pt:
            op.drop_column("pointages", col)