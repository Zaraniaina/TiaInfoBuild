"""Tests du CRUD plans Super Admin (stratégie employés).

Couvre :
- Protection des plans système (essai/gratuit) : suppression et désactivation 409
- GET /plans admin : compteur d'entreprises abonnées (entreprises_actives)
- Quota employés illimité (utilisateurs_max = NULL) : jamais bloqué
- Refus d'un code de plan dupliqué (400)
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.database import get_db
from app.security import get_current_user
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.entreprise import Entreprise
from tests.test_subscription_guard import _seed_plan, _seed_entreprise
from datetime import datetime, timedelta

SuperAdminPayload = {"role_code": "super_admin", "entreprise_id": None}


async def _admin_client(db_session) -> AsyncClient:
    async def _override_get_db():
        yield db_session

    async def _override_user():
        return SuperAdminPayload

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_user
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


# ---------------------------------------------------------------------------
# Protection des plans système
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_plan_essai_refuse_409(db_session):
    """Supprimer le plan « essai » est refusé : il porte l'essai automatique."""
    plan = await _seed_plan(db_session, "essai")
    client = await _admin_client(db_session)
    async with client:
        resp = await client.delete("/api/subscriptions/plans/1")
    assert resp.status_code == 409, resp.text
    detail = resp.json()["detail"]
    code = detail["code"] if isinstance(detail, dict) else str(detail)
    assert code == "plan_systeme_protege"


@pytest.mark.asyncio
async def test_delete_plan_gratuit_refuse_409(db_session):
    plan = await _seed_plan(db_session, "gratuit")
    client = await _admin_client(db_session)
    async with client:
        resp = await client.delete("/api/subscriptions/plans/1")
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_toggle_plan_essai_refuse_409(db_session):
    """Désactiver « essai » tuerait l'essai automatique des nouvelles inscriptions."""
    await _seed_plan(db_session, "essai")
    client = await _admin_client(db_session)
    async with client:
        resp = await client.post("/api/subscriptions/plans/1/toggle")
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_toggle_plan_normal_autorise(db_session):
    """Un plan non-système reste togglable."""
    await _seed_plan(db_session, "promo_2026", actif=True)
    client = await _admin_client(db_session)
    async with client:
        resp = await client.post("/api/subscriptions/plans/1/toggle")
    assert resp.status_code == 200
    assert resp.json()["actif"] is False


@pytest.mark.asyncio
async def test_delete_plan_normal_autorise(db_session):
    plan = await _seed_plan(db_session, "promo_2026")
    client = await _admin_client(db_session)
    async with client:
        resp = await client.delete("/api/subscriptions/plans/1")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_create_plan_code_duplique_400(db_session):
    plan = await _seed_plan(db_session, "premium")
    client = await _admin_client(db_session)
    async with client:
        resp = await client.post("/api/subscriptions/plans", json={
            "nom": "Autre premium", "code": "premium",
            "prix_mensuel": 10000, "prix_annuel": 100000,
            "utilisateurs_max": 20, "chantiers_max": 5,
        })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_public_plans_exclut_essai(db_session):
    """GET /public/plans exclut le plan `essai` (mécanisme interne) : sinon
    /pricing affiche deux cartes « Gratuit » trompeuses."""
    await _seed_plan(db_session, "essai")
    await _seed_plan(db_session, "gratuit")
    await _seed_plan(db_session, "premium", users_max=50, chantiers_max=20)
    client = await _admin_client(db_session)  # overrides sans auth requise ici
    async with client:
        resp = await client.get("/api/subscriptions/public/plans")
    assert resp.status_code == 200
    codes = [p["code"] for p in resp.json()]
    assert "essai" not in codes
    assert "gratuit" in codes
    assert "premium" in codes


@pytest.mark.asyncio
async def test_list_plans_admin_avec_compteur(db_session):
    """GET /plans admin renvoie entreprises_actives = nb abonnements actifs+essai."""
    plan = await _seed_plan(db_session, "pro")
    ent1 = await _seed_entreprise(db_session, "A")
    ent2 = await _seed_entreprise(db_session, "B")
    ent3 = await _seed_entreprise(db_session, "C")
    for ent, statut in ((ent1, "actif"), (ent2, "essai"), (ent3, "expire")):
        db_session.add(Subscription(
            entreprise_id=ent.id, plan_id=plan.id,
            date_debut=datetime.now(), date_fin=datetime.now() + timedelta(days=30),
            statut=statut,
        ))
    await db_session.flush()

    client = await _admin_client(db_session)
    async with client:
        resp = await client.get("/api/subscriptions/plans")
    assert resp.status_code == 200
    plans = resp.json()
    target = next(p for p in plans if p["code"] == "pro")
    # actif + essai comptent, expire ne compte pas
    assert target["entreprises_actives"] == 2


# ---------------------------------------------------------------------------
# Quota employés illimité (utilisateurs_max = NULL)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_quota_employes_illimite_null(db_session, client_factory):
    """utilisateurs_max = NULL (illimité) : créer 12 employés passe sans blocage."""
    plan = await _seed_plan(db_session, "essai", users_max=None, chantiers_max=5)
    ent = await _seed_entreprise(db_session)
    db_session.add(Subscription(
        entreprise_id=ent.id, plan_id=plan.id,
        date_debut=datetime.now(), date_fin=datetime.now() + timedelta(days=30),
        statut="essai",
    ))
    await db_session.flush()

    async with await client_factory(role_code="rh", entreprise_id=ent.id) as client:
        for i in range(12):
            resp = await client.post("/api/rh/employes", json={
                "nom": f"Employe{i}", "prenom": "Test", "poste": "Maçon",
            })
            assert resp.status_code == 201, resp.text


@pytest.mark.asyncio
async def test_quota_employes_limite_atteinte(db_session, client_factory):
    """utilisateurs_max = 1 : la 2e création d'employé est bloquée 403."""
    plan = await _seed_plan(db_session, "gratuit", users_max=1, chantiers_max=3)
    ent = await _seed_entreprise(db_session)
    db_session.add(Subscription(
        entreprise_id=ent.id, plan_id=plan.id,
        date_debut=datetime.now(), date_fin=datetime.now() + timedelta(days=300),
        statut="actif",
    ))
    from app.models.employe import Employe
    db_session.add(Employe(entreprise_id=ent.id, nom="Deja", prenom="La", poste="Maçon"))
    await db_session.flush()

    async with await client_factory(role_code="rh", entreprise_id=ent.id) as test_client:
        resp = await test_client.post("/api/rh/employes", json={
            "nom": "En", "prenom": "Trop", "poste": "Maçon",
        })
    assert resp.status_code == 403
    detail = resp.json()["detail"]
    assert isinstance(detail, dict) and detail["code"] == "subscription_quota"
