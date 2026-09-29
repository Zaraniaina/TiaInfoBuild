"""Migration 028 - Add missing photo and branding columns to clients, entreprises, utilisateurs."""
from alembic import op
import sqlalchemy as sa


revision = "028_add_branding_and_photos"
down_revision = "027_add_email_verified"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Adding photo column to clients if missing
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    clients_cols = [c["name"] for c in inspector.get_columns("clients")]
    if "photo" not in clients_cols:
        op.add_column("clients", sa.Column("photo", sa.Text(), nullable=True))

    utilisateurs_cols = [c["name"] for c in inspector.get_columns("utilisateurs")]
    if "photo" not in utilisateurs_cols:
        op.add_column("utilisateurs", sa.Column("photo", sa.Text(), nullable=True))

    entreprises_cols = [c["name"] for c in inspector.get_columns("entreprises")]
    if "couleurs_roles" not in entreprises_cols:
        op.add_column("entreprises", sa.Column("couleurs_roles", sa.Text(), nullable=True))
    if "entete_badge" not in entreprises_cols:
        op.add_column("entreprises", sa.Column("entete_badge", sa.String(255), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    clients_cols = [c["name"] for c in inspector.get_columns("clients")]
    if "photo" in clients_cols:
        op.drop_column("clients", "photo")

    utilisateurs_cols = [c["name"] for c in inspector.get_columns("utilisateurs")]
    if "photo" in utilisateurs_cols:
        op.drop_column("utilisateurs", "photo")

    entreprises_cols = [c["name"] for c in inspector.get_columns("entreprises")]
    if "couleurs_roles" in entreprises_cols:
        op.drop_column("entreprises", "couleurs_roles")
    if "entete_badge" in entreprises_cols:
        op.drop_column("entreprises", "entete_badge")
