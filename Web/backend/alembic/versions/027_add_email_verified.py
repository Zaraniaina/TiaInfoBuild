"""Migration 027 - Add is_email_verified to utilisateurs table."""
from alembic import op
import sqlalchemy as sa


revision = "027_add_email_verified"
down_revision = "026_add_depots_btp"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ajouter is_email_verified (défaut True pour comptes existants, False pour nouveaux)
    op.add_column(
        "utilisateurs",
        sa.Column(
            "is_email_verified",
            sa.Boolean(),
            nullable=False,
            server_default="1",  # Comptes existants = vérifiés
        ),
    )


def downgrade() -> None:
    op.drop_column("utilisateurs", "is_email_verified")
