"""Tests du système d'abonnement : essai 30j, expiration (lecture seule), quotas.

Le garde est implémenté dans app/services/subscription_state.py et branché sur :
- register_entreprise (essai automatique)
- create_employe (quota utilisateurs)
- create_chantier (quota chantiers)
Les entreprises SANS subscription ne sont jamais bloquées (état `sans`).
"""
from datetime import datetime, timedelta

import pytest

from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.entreprise import Entreprise
from app.services.subscription_state import (
    get_entreprise_state,
    demarrer_essai,
    a_deja_fait_essai,
    marquer_expirations,
)


async def _seed_plan(db, code="essai", users_max=20, chantiers_max=5, actif=True) -> Plan:
    plan = Plan(
        nom=f"Plan {code}",
        code=code,
        description="test",
        prix_mensuel=0,
        prix_annuel=0,
        utilisateurs_max=users_max,
        chantiers_max=chantiers_max,
        stockage_go=5,
        duree_essai_jours=30,
        actif=actif,
    )
    db.add(plan)
    await db.flush()
    return plan


async def _seed_entreprise(db, nom="Test SARL") -> Entreprise:
    ent = Entreprise(nom=nom)
    db.add(ent)
    await db.flush()
    return ent


# ---------------------------------------------------------------------------
# Unitaires du service
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_etat_sans_subscription_autorise(db_session):
    """Entreprise sans subscription : état `sans` = rien n'est bloqué."""
    ent = await _seed_entreprise(db_session)
    state = await get_entreprise_state(db_session, ent.id)
    assert state["state"] == "sans"
    # La garde d'écriture ne doit PAS lever
    from app.services.subscription_state import assert_can_write
    await assert_can_write(db_session, {"role_code": "admin_entreprise", "entreprise_id": ent.id})


@pytest.mark.asyncio
async def test_essai_30_jours_puis_anti_reessai(db_session):
    """demarrer_essai crée un essai 30j ; un 2e appel est refusé."""
    ent = await _seed_entreprise(db_session)
    await _seed_plan(db_session, "essai")

    sub = await demarrer_essai(db_session, ent.id)
    assert sub is not None
    assert sub.statut == "essai"
    reste = (sub.date_fin - sub.date_debut).days
    assert 29 <= reste <= 30

    assert await a_deja_fait_essai(db_session, ent.id) is True
    assert await demarrer_essai(db_session, ent.id) is None  # anti-essai infini


@pytest.mark.asyncio
async def test_essai_expire_passe_en_lecture_seule(db_session):
    """Essai dont date_fin est passée : écritures 403, état `expire`."""
    ent = await _seed_entreprise(db_session)
    plan = await _seed_plan(db_session, "essai")
    db_session.add(
        Subscription(
            entreprise_id=ent.id,
            plan_id=plan.id,
            date_debut=datetime.now() - timedelta(days=40),
            date_fin=datetime.now() - timedelta(days=10),
            statut="essai",
        )
    )
    await db_session.flush()

    state = await get_entreprise_state(db_session, ent.id)
    assert state["state"] == "expire"

    from app.services.subscription_state import assert_can_write
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await assert_can_write(db_session, {"role_code": "admin_entreprise", "entreprise_id": ent.id})
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["code"] == "subscription_expired"


@pytest.mark.asyncio
async def test_marquer_expirations_au_boot(db_session):
    """Le marquage au démarrage passe statut actif/essai -> expire."""
    ent = await _seed_entreprise(db_session)
    plan = await _seed_plan(db_session, "starter")
    db_session.add(
        Subscription(
            entreprise_id=ent.id,
            plan_id=plan.id,
            date_debut=datetime.now() - timedelta(days=60),
            date_fin=datetime.now() - timedelta(days=1),
            statut="actif",
        )
    )
    await db_session.flush()

    n = await marquer_expirations(db_session)
    assert n >= 1
    await db_session.refresh(plan)  # noop, juste vérifier la session vit
    subs = (await db_session.execute(
        Subscription.__table__.select().where(Subscription.entreprise_id == ent.id)
    )).first()
    # La ligne renvoyée avant modification contient l'ancien statut ; on relit via l'ORM
    from sqlalchemy import select as _sel
    sub_orm = (await db_session.execute(_sel(Subscription).where(Subscription.entreprise_id == ent.id))).scalar_one()
    assert sub_orm.statut == "expire"


# ---------------------------------------------------------------------------
# End-to-end via l'API (conftest client_factory)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_chantier_quota_depasse(db_session, client_factory):
    """Plan starter 5 chantiers actifs : la 6e création est bloquée en 403."""
    plan = await _seed_plan(db_session, "starter", users_max=15, chantiers_max=2)
    ent = await _seed_entreprise(db_session)
    db_session.add(
        Subscription(
            entreprise_id=ent.id,
            plan_id=plan.id,
            date_debut=datetime.now(),
            date_fin=datetime.now() + timedelta(days=300),
            statut="actif",
        )
    )
    from app.models.chantier import Chantier
    for i in range(2):
        db_session.add(
            Chantier(entreprise_id=ent.id, nom=f"Chantier {i}", statut="en_cours")
        )
    await db_session.flush()

    async with await client_factory(role_code="chef_projet", entreprise_id=ent.id) as client:
        resp = await client.post(
            "/api/chantiers",
            json={"nom": "Chantier en trop"},
        )
    assert resp.status_code == 403
    detail = resp.json()["detail"]
    if isinstance(detail, dict):
        assert detail["code"] == "subscription_quota"
    else:
        assert "Limite du plan" in str(detail)


@pytest.mark.asyncio
async def test_create_employe_ok_pendant_essai(db_session, client_factory):
    """Pendant l'essai (accès complet) : création d'employé OK."""
    plan = await _seed_plan(db_session, "essai", users_max=20, chantiers_max=5)
    ent = await _seed_entreprise(db_session)
    db_session.add(
        Subscription(
            entreprise_id=ent.id,
            plan_id=plan.id,
            date_debut=datetime.now(),
            date_fin=datetime.now() + timedelta(days=30),
            statut="essai",
        )
    )
    await db_session.flush()

    async with await client_factory(role_code="rh", entreprise_id=ent.id) as client:
        resp = await client.post(
            "/api/rh/employes",
            json={"nom": "Rakoto", "prenom": "Jean", "poste": "Maçon"},
        )
    assert resp.status_code == 201, resp.text
