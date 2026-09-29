"""Migration 029 - Table mail_settings (SMTP configurable super admin).

Permet la mise en production sans toucher au .env : le super admin
configure le SMTP depuis l'interface → stocké en BDD → effectif à chaud.
Idempotent (vérifie l'existence avant création).
"""
from alembic import op
import sqlalchemy as sa


revision = "029_mail_settings"
down_revision = "028_add_branding_and_photos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "mail_settings" in inspector.get_table_names():
        return
    op.create_table(
        "mail_settings",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("provider", sa.String(50), nullable=False, server_default="custom"),
        sa.Column("smtp_host", sa.String(255), nullable=False, server_default="localhost"),
        sa.Column("smtp_port", sa.Integer, nullable=False, server_default="1025"),
        sa.Column("smtp_user", sa.String(255), nullable=True, server_default=""),
        sa.Column("smtp_password_encrypted", sa.Text, nullable=True),
        sa.Column("smtp_tls", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("smtp_ssl", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("smtp_from_email", sa.String(255), nullable=False, server_default="no-reply@tiainfobuild.com"),
        sa.Column("smtp_from_name", sa.String(255), nullable=False, server_default="TIA INFO BUILD"),
        sa.Column("frontend_url", sa.String(255), nullable=False, server_default="http://localhost:5173"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("last_test_at", sa.DateTime, nullable=True),
        sa.Column("last_test_status", sa.String(20), nullable=True),
        sa.Column("last_test_message", sa.String(500), nullable=True),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "mail_settings" in inspector.get_table_names():
        op.drop_table("mail_settings")
