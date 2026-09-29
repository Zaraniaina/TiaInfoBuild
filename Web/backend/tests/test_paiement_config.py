"""Tests du module de paiement Papi.mg.

Couvre :
- Vérification de signature X-Papi-Signature (HMAC-SHA256, t.v1) :
  valide / invalide / expirée (replay)
- Masquage des secrets côté GET /paiement-config
- 403 : l'admin d'entreprise ne lit ni ne modifie JAMAIS la configuration
- 403 : le super admin ne peut pas initier un paiement d'abonnement
"""
import hashlib
import hmac
import time

import pytest

from app.main import app
from app.database import get_db
from app.security import get_current_user
from app.models.parametre_paiement import ParametrePaiement
from app.routers.paiements import _verifier_signature

SECRET = "pwhsec_" + "a" * 64
SuperAdminPayload = {"role_code": "super_admin", "entreprise_id": None}
EntreprisePayload = {"role_code": "admin_entreprise", "entreprise_id": 6}


# ---------------------------------------------------------------------------
# Signature HMAC (unitaire)
# ---------------------------------------------------------------------------

def _signer(body: bytes, secret: str = SECRET, t: int | None = None) -> str:
    ts = t if t is not None else int(time.time())
    v1 = hmac.new(secret.encode(), f"{ts}.".encode() + body, hashlib.sha256).hexdigest()
    return f"t={ts},v1={v1}"


def test_signature_valide():
    body = b'{"merchantPaymentReference": "SUB-1-123"}'
    assert _verifier_signature(SECRET, body, _signer(body)) is True


def test_signature_invalide():
    body = b'{"x": 1}'
    assert _verifier_signature(SECRET, body, _signer(body, secret="pwhsec_" + "b" * 64)) is False


def test_signature_body_modifie():
    header = _signer(b'{"x": 1}')
    assert _verifier_signature(SECRET, b'{"x": 2}', header) is False


def test_signature_expiree_replay():
    body = b'{"x": 1}'
    vieux = int(time.time()) - 301  # tolérance : 300 s
    assert _verifier_signature(SECRET, body, _signer(body, t=vieux)) is False


def test_signature_header_malforme():
    body = b'{"x": 1}'
    assert _verifier_signature(SECRET, body, "garbage") is False
    assert _verifier_signature(SECRET, body, None) is False


# ---------------------------------------------------------------------------
# Isolation des accès à la configuration
# ---------------------------------------------------------------------------

async def _client(db_session, payload: dict):
    from httpx import AsyncClient, ASGITransport

    async def _override_get_db():
        yield db_session

    async def _override_user():
        return payload

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_user
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _seed_config(db_session, api_key: str = "pk_test") -> None:
    cfg = (await db_session.get(ParametrePaiement, 1))
    if not cfg:
        cfg = ParametrePaiement(id=1)
        db_session.add(cfg)
    cfg.api_key = api_key
    cfg.webhook_secret = SECRET
    await db_session.flush()


@pytest.mark.asyncio
async def test_admin_entreprise_ne_lit_pas_la_config(db_session):
    await _seed_config(db_session)

    client = await _client(db_session, EntreprisePayload)
    async with client:
        resp = await client.get("/api/paiement-config")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_entreprise_ne_modifie_pas_la_config(db_session):
    client = await _client(db_session, EntreprisePayload)
    async with client:
        resp = await client.put("/api/paiement-config", json={"environment": "production"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_super_admin_lit_config_secrets_masques(db_session):
    await _seed_config(db_session, api_key="pk_live_abcdefgh1234")

    client = await _client(db_session, SuperAdminPayload)
    async with client:
        resp = await client.get("/api/paiement-config")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["est_configure"] is True
    # Secrets JAMAIS en clair
    raw = resp.text
    assert "pk_live_abcdefgh1234" not in raw
    assert SECRET not in raw
    assert data["api_key_masquee"].startswith("pk_live_")
    assert "••••" in data["api_key_masquee"]


@pytest.mark.asyncio
async def test_super_admin_premiere_lecture_table_vide(db_session):
    """Table vide (déploiement initial) : le GET crée le singleton et répond 200.

    Régression : sans refresh après flush dans _get_config, la première
    ouverture de la page super admin levait MissingGreenlet (500).
    """
    client = await _client(db_session, SuperAdminPayload)
    async with client:
        resp = await client.get("/api/paiement-config")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["est_configure"] is False
    assert data["environment"] == "sandbox"
    assert data["api_key_masquee"] is None
    # Le singleton est bien persisté
    assert await db_session.get(ParametrePaiement, 1) is not None


@pytest.mark.asyncio
async def test_super_admin_ne_souscrit_pas_dabonnement(db_session):
    client = await _client(db_session, SuperAdminPayload)
    async with client:
        resp = await client.post("/api/paiements/abonnement/initier", json={"plan_id": 1, "periode": "mensuel"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_initier_sans_config_503(db_session, client_factory):
    """Papi non configuré : 503 structuré (le front bascule alors en activation directe)."""
    ent = await _seed_entreprise(db_session)
    async with await client_factory(role_code="admin_entreprise", entreprise_id=ent.id) as client:
        resp = await client.post("/api/paiements/abonnement/initier", json={"plan_id": 999, "periode": "mensuel"})
    assert resp.status_code == 503
    detail = resp.json()["detail"]
    assert isinstance(detail, dict) and detail["code"] == "paiement_non_configure"


from tests.test_subscription_guard import _seed_entreprise  # noqa: E402  (après les helpers)
