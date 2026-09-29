"""Schémas Pydantic — paramètres SMTP dédiés (super admin).

fastapi-expert pattern : Pydantic V2, EmailStr, field_validator.
security-reviewer : le mot de passe n'est JAMAIS retourné au frontend.
"""
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


MAIL_PROVIDERS_PRESETS: dict[str, dict] = {
    "gmail": {"smtp_host": "smtp.gmail.com", "smtp_port": 587, "smtp_tls": True, "smtp_ssl": False},
    "outlook": {"smtp_host": "smtp.office365.com", "smtp_port": 587, "smtp_tls": True, "smtp_ssl": False},
    "yahoo": {"smtp_host": "smtp.mail.yahoo.com", "smtp_port": 587, "smtp_tls": True, "smtp_ssl": False},
    "mailpit": {"smtp_host": "localhost", "smtp_port": 1025, "smtp_tls": False, "smtp_ssl": False},
    "custom": {},
}


class MailSettingsUpdate(BaseModel):
    """Payload d'écriture — tous les champs optionnels sauf validation croisée."""

    model_config = ConfigDict(str_strip_whitespace=True)

    provider: str | None = Field(default=None, max_length=50)
    smtp_host: str | None = Field(default=None, max_length=255)
    smtp_port: int | None = Field(default=None, ge=1, le=65535)
    smtp_user: str | None = Field(default=None, max_length=255)
    smtp_password: str | None = Field(default=None, max_length=500)
    smtp_tls: bool | None = None
    smtp_ssl: bool | None = None
    smtp_from_email: EmailStr | None = None
    smtp_from_name: str | None = Field(default=None, max_length=255)
    frontend_url: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None

    @field_validator("smtp_port")
    @classmethod
    def _check_port(cls, v: int | None) -> int | None:
        if v is not None and not (1 <= v <= 65535):
            raise ValueError("Port SMTP invalide (1-65535)")
        return v

    @field_validator("frontend_url")
    @classmethod
    def _check_url(cls, v: str | None) -> str | None:
        if v is not None and not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("frontend_url doit commencer par http:// ou https://")
        return v.rstrip("/") if v else v


class MailSettingsResponse(BaseModel):
    """Lecture — mot de passe masqué (has_password flag uniquement)."""

    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    provider: str = "custom"
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_user: str = ""
    has_password: bool = False
    smtp_tls: bool = False
    smtp_ssl: bool = False
    smtp_from_email: str = "no-reply@tiainfobuild.com"
    smtp_from_name: str = "TIA INFO BUILD"
    frontend_url: str = "http://localhost:5173"
    is_active: bool = True
    last_test_at: str | None = None
    last_test_status: str | None = None
    last_test_message: str | None = None
    effective_source: str = "database"  # database | env (fallback si table vide)
    updated_at: str | None = None


class MailTestRequest(BaseModel):
    """Envoi d'un email de test vers une adresse cible."""

    model_config = ConfigDict(str_strip_whitespace=True)

    to_email: EmailStr


class MailDraftTestRequest(MailSettingsUpdate):
    """Test de connexion AVANT sauvegarde (mise en production guidée).

    Permet au super admin de valider un serveur SMTP sans l'enregistrer :
    les champs non fournis sont complétés par la config effective existante
    (notamment le mot de passe déjà stocké).
    """

    to_email: EmailStr


class MailCheckItem(BaseModel):
    """Étape du diagnostic de mise en production."""

    code: str
    label: str
    ok: bool
    required: bool = True
    hint: str = ""


class MailDiagnosticsResponse(BaseModel):
    """Checklist « prêt pour la production » affichée dans l'interface dédiée."""

    ready: bool = False
    effective_source: str = "env"
    provider: str = "custom"
    checks: list[MailCheckItem] = Field(default_factory=list)


class MailTestResponse(BaseModel):
    success: bool
    message: str
    detail: str | None = None
    tested_at: str | None = None
