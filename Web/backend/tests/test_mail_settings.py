"""Tests API de l'interface dédiée SMTP (super admin) — mise en production.

Couvre : masquage du mot de passe, enregistrement à chaud, presets
fournisseurs, test d'envoi (effectif + brouillon avant sauvegarde), diagnostic
de mise en production, retour au `.env`, chiffrement Fernet du mot de passe et
contrôle du rôle super_admin.
"""
import pytest
from sqlalchemy import select

from app.models.mail_settings import MailSettings
from app.routers import super_admin_mail
from app.services.mail_config import (
    FERNET_PREFIX,
    LEGACY_PREFIX,
    decrypt_password,
    encrypt_password,
    get_effective_smtp_config,
)

BASE = "/api/super-admin/mail-settings"

CONFIG_PROD = {
    "provider": "gmail",
    "smtp_user": "no-reply@tiainfobuild.com",
    "smtp_password": "mot-de-passe-application",
    "smtp_from_email": "no-reply@tiainfobuild.com",
    "smtp_from_name": "TIA INFO BUILD",
    "frontend_url": "https://app.tiainfobuild.com/",
}


class _FakeSend:
    """Doublet de `_send_via_config` : capture la config testée, sans réseau."""

    def __init__(self, raise_error: Exception | None = None) -> None:
        self.calls: list[tuple] = []
        self.raise_error = raise_error

    def __call__(self, cfg, to_email, subject, html_content, text_content=""):
        self.calls.append((cfg, to_email, subject))
        if self.raise_error:
            raise self.raise_error
        return True


def test_chiffrement_mot_de_passe_est_authentifie():
    """Le mot de passe SMTP est chiffré (Fernet) et jamais stocké lisible."""
    token = encrypt_password("mot-de-passe-application")
    assert token.startswith(FERNET_PREFIX)
    assert "mot-de-passe-application" not in token
    assert decrypt_password(token) == "mot-de-passe-application"


def test_chiffrement_detecte_une_alteration():
    """Fernet est authentifié : un token modifié ne restitue pas de secret."""
    token = encrypt_password("secret-smtp")
    altere = token[:-3] + ("aaa" if not token.endswith("aaa") else "bbb")
    assert decrypt_password(altere) == ""


def test_dechiffrement_compat_anciens_formats():
    """Migration douce : formats hérités (XOR « enc: » et clair) toujours lus."""
    import base64

    from app.config import settings

    key = (settings.secret_key or "tia-mail-key").encode()
    data = "ancien-secret".encode("utf-8")
    legacy = LEGACY_PREFIX + base64.b64encode(
        bytes(b ^ key[i % len(key)] for i, b in enumerate(data))
    ).decode()

    assert decrypt_password(legacy) == "ancien-secret"
    assert decrypt_password("mot-de-passe-en-clair") == "mot-de-passe-en-clair"
    assert decrypt_password("") == ""
    assert decrypt_password(None) == ""


async def test_get_mail_settings_masque_le_mot_de_passe(client_factory):
    async with await client_factory("super_admin") as client:
        r = await client.get(BASE)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["effective_source"] == "env"
        assert data["has_password"] is False
        # security-reviewer : le secret SMTP n'est jamais renvoyé au frontend.
        assert "smtp_password" not in data
        assert "smtp_password_encrypted" not in data


async def test_put_enregistre_et_active_a_chaud(db_session, client_factory):
    async with await client_factory("super_admin") as client:
        r = await client.put(BASE, json=CONFIG_PROD)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["effective_source"] == "database"
        assert data["smtp_host"] == "smtp.gmail.com"  # preset Gmail appliqué
        assert data["smtp_port"] == 587
        assert data["smtp_tls"] is True
        assert data["smtp_ssl"] is False
        assert data["has_password"] is True
        assert data["is_active"] is True
        assert data["frontend_url"] == "https://app.tiainfobuild.com"  # slash final retiré
        assert "smtp_password" not in data

    # La config est effective immédiatement (aucun redéploiement nécessaire).
    cfg = await get_effective_smtp_config(db_session)
    assert cfg.source == "database"
    assert cfg.host == "smtp.gmail.com"
    assert cfg.password == "mot-de-passe-application"

    # Le mot de passe est bien chiffré en base (pas de stockage en clair).
    row = (await db_session.execute(select(MailSettings))).scalar_one()
    assert row.smtp_password_encrypted.startswith("fernet:")
    assert "mot-de-passe-application" not in row.smtp_password_encrypted
    assert "mot-de-passe-application" not in row.smtp_password_encrypted


async def test_put_premiere_configuration_exige_host_et_expediteur(client_factory):
    async with await client_factory("super_admin") as client:
        r = await client.put(BASE, json={"smtp_user": "admin@example.com"})
        assert r.status_code == 422, r.text


async def test_presets_providers(client_factory):
    async with await client_factory("super_admin") as client:
        r = await client.get(f"{BASE}/providers")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["providers"]["gmail"]["smtp_host"] == "smtp.gmail.com"
        assert data["providers"]["mailpit"]["smtp_port"] == 1025
        assert "custom" in data["providers"]
        assert data["labels"]["gmail"].startswith("Gmail")


async def test_status_reflete_la_source_effective(client_factory):
    async with await client_factory("super_admin") as client:
        await client.put(BASE, json=CONFIG_PROD)
        r = await client.get(f"{BASE}/status")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["effective_source"] == "database"
        assert data["auth_configured"] is True
        assert data["host"] == "smtp.gmail.com"
        assert data["from_email"] == "no-reply@tiainfobuild.com"


async def test_diagnostics_pret_apres_configuration_complete(client_factory):
    async with await client_factory("super_admin") as client:
        avant = await client.get(f"{BASE}/diagnostics")
        assert avant.status_code == 200, avant.text
        assert avant.json()["ready"] is False  # source encore = .env

        await client.put(BASE, json=CONFIG_PROD)
        apres = await client.get(f"{BASE}/diagnostics")
        assert apres.status_code == 200, apres.text
        data = apres.json()
        assert data["ready"] is True, data
        assert data["effective_source"] == "database"
        codes = {c["code"]: c for c in data["checks"]}
        assert codes["source"]["ok"] is True
        assert codes["smtp_host"]["ok"] is True
        assert codes["frontend_url"]["ok"] is True
        # Le test d'envoi n'est pas bloquant mais reste suivi.
        assert codes["last_test"]["required"] is False
        assert codes["last_test"]["ok"] is False


async def test_test_envoi_effectif_historise_le_resultat(client_factory, monkeypatch):
    fake = _FakeSend()
    monkeypatch.setattr(super_admin_mail, "_send_via_config", fake)
    async with await client_factory("super_admin") as client:
        await client.put(BASE, json=CONFIG_PROD)
        r = await client.post(f"{BASE}/test", json={"to_email": "direction@example.com"})
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True
        assert fake.calls[0][0].host == "smtp.gmail.com"
        assert fake.calls[0][1] == "direction@example.com"

        detail = (await client.get(BASE)).json()
        assert detail["last_test_status"] == "success"
        assert detail["last_test_at"] is not None


async def test_test_envoi_echec_remonte_le_detail(client_factory, monkeypatch):
    fake = _FakeSend(raise_error=RuntimeError("535 Authentication failed"))
    monkeypatch.setattr(super_admin_mail, "_send_via_config", fake)
    async with await client_factory("super_admin") as client:
        await client.put(BASE, json=CONFIG_PROD)
        r = await client.post(f"{BASE}/test", json={"to_email": "direction@example.com"})
        assert r.status_code == 502, r.text
        assert "535 Authentication failed" in r.json()["detail"]

        detail = (await client.get(BASE)).json()
        assert detail["last_test_status"] == "error"


async def test_test_draft_ne_sauvegarde_pas_et_reutilise_le_mot_de_passe(
    db_session, client_factory, monkeypatch
):
    fake = _FakeSend()
    monkeypatch.setattr(super_admin_mail, "_send_via_config", fake)
    async with await client_factory("super_admin") as client:
        await client.put(BASE, json=CONFIG_PROD)
        nb_rows = len((await db_session.execute(select(MailSettings))).scalars().all())

        # Valeurs saisies (Outlook), sans ressaisir le mot de passe.
        r = await client.post(
            f"{BASE}/test-draft",
            json={
                "provider": "outlook",
                "smtp_host": "smtp.office365.com",
                "smtp_port": 587,
                "smtp_tls": True,
                "smtp_from_email": "no-reply@tiainfobuild.com",
                "frontend_url": "https://app.tiainfobuild.com",
                "to_email": "direction@example.com",
            },
        )
        assert r.status_code == 200, r.text
        assert "non enregistrées" in r.json()["message"]

        cfg = fake.calls[0][0]
        assert cfg.host == "smtp.office365.com"
        assert cfg.source == "draft"
        # Le mot de passe stocké est réutilisé : testable avant mise en service.
        assert cfg.password == "mot-de-passe-application"
        assert cfg.user == "no-reply@tiainfobuild.com"

        # Aucune ligne supplémentaire : le test à chaud n'active rien.
        nb_apres = len((await db_session.execute(select(MailSettings))).scalars().all())
        assert nb_apres == nb_rows
        assert (await get_effective_smtp_config(db_session)).host == "smtp.gmail.com"


async def test_test_draft_echec_retourne_502(client_factory, monkeypatch):
    fake = _FakeSend(raise_error=RuntimeError("timeout SMTP"))
    monkeypatch.setattr(super_admin_mail, "_send_via_config", fake)
    async with await client_factory("super_admin") as client:
        r = await client.post(
            f"{BASE}/test-draft",
            json={
                "smtp_host": "smtp.gmail.com",
                "smtp_port": 587,
                "smtp_from_email": "no-reply@tiainfobuild.com",
                "to_email": "direction@example.com",
            },
        )
        assert r.status_code == 502, r.text
        assert "timeout SMTP" in r.json()["detail"]


async def test_reset_revient_au_env(db_session, client_factory):
    async with await client_factory("super_admin") as client:
        await client.put(BASE, json=CONFIG_PROD)
        assert (await get_effective_smtp_config(db_session)).source == "database"

        r = await client.post(f"{BASE}/reset")
        assert r.status_code == 200, r.text
        assert r.json()["effective_source"] == "env"

    cfg = await get_effective_smtp_config(db_session)
    assert cfg.source == "env"
    # Les valeurs restent en base (is_active=False) : réactivation en un clic.
    row = (await db_session.execute(select(MailSettings))).scalar_one()
    assert row.is_active is False
    assert row.smtp_host == "smtp.gmail.com"


@pytest.mark.parametrize(
    ("methode", "url", "payload"),
    [
        ("get", BASE, None),
        ("put", BASE, CONFIG_PROD),
        ("post", f"{BASE}/test", {"to_email": "x@example.com"}),
        ("post", f"{BASE}/reset", None),
        ("get", f"{BASE}/diagnostics", None),
        ("get", f"{BASE}/providers", None),
    ],
)
async def test_acces_reserve_au_super_admin(client_factory, methode, url, payload):
    async with await client_factory("admin_entreprise", entreprise_id=1) as client:
        call = getattr(client, methode)
        r = await call(url, json=payload) if payload else await call(url)
        assert r.status_code == 403, r.text