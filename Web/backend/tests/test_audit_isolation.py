"""Tests d'isolation de l'audit des connexions.

Un admin d'entreprise ne doit voir que les connexions des comptes de SA
propre entreprise — jamais celles des autres entreprises ni les tentatives
anonymes (utilisateur_id = NULL : échecs sans compte identifié, ex. mauvais
email).
"""
from datetime import datetime

import pytest

from app.models.historique_connexion import HistoriqueConnexion
from app.models.entreprise import Entreprise
from app.models.utilisateur import Utilisateur
from tests.test_subscription_guard import _seed_plan, _seed_entreprise


async def _seed_user(db, email: str, entreprise_id: int | None, role_id: int | None = None, nom: str = "User") -> Utilisateur:
    from app.security import hash_password

    user = Utilisateur(
        email=email,
        nom=nom,
        mot_de_passe_hash=hash_password("Admin123!"),
        entreprise_id=entreprise_id,
        role_id=role_id,
    )
    db.add(user)
    await db.flush()
    return user


async def _seed_log(db, utilisateur_id: int | None, reussi: bool = True) -> None:
    db.add(
        HistoriqueConnexion(
            utilisateur_id=utilisateur_id,
            ip_address="127.0.0.1",
            reussi=reussi,
            date_connexion=datetime.now(),
        )
    )
    await db.flush()


@pytest.mark.asyncio
async def test_audit_ne_voit_que_son_entreprise(db_session, client_factory):
    """L'admin d'entreprise A ne voit AUCUNE connexion des entreprises B/C ni les logs anonymes."""
    plan = await _seed_plan(db_session, "essai")
    ent_a = await _seed_entreprise(db_session, "Entreprise A")
    ent_b = await _seed_entreprise(db_session, "Entreprise B")

    admin_a = await _seed_user(db_session, "admin.a@x.mg", ent_a.id)
    employe_a = await _seed_user(db_session, "emp.a@x.mg", ent_a.id, nom="EmployeA")
    employe_b = await _seed_user(db_session, "emp.b@x.mg", ent_b.id, nom="EmployeB")

    await _seed_log(db_session, admin_a.id)
    await _seed_log(db_session, employe_a.id)
    await _seed_log(db_session, employe_b.id)   # autre entreprise
    await _seed_log(db_session, None)           # tentative anonyme (échec)

    async with await client_factory(role_code="admin_entreprise", entreprise_id=ent_a.id, user_id=admin_a.id, user_email=admin_a.email) as client:
        resp = await client.get("/api/parametres/audit-logs")

    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    ids_vus = {it["utilisateur_id"] for it in items}
    assert ids_vus == {admin_a.id, employe_a.id}  # ni employe_b ni None
    # Identité réelle exposée
    first = items[0]
    assert first["nom"] and first["email"]


@pytest.mark.asyncio
async def test_audit_super_admin_voit_tout(db_session, client_factory):
    """Le super admin (sans entreprise) voit toutes les connexions."""
    ent = await _seed_entreprise(db_session, "Solo")
    u1 = await _seed_user(db_session, "a@x.mg", ent.id, nom="A")
    u2 = await _seed_user(db_session, "b@x.mg", None, nom="B")
    await _seed_log(db_session, u1.id)
    await _seed_log(db_session, u2.id)

    async with await client_factory(role_code="super_admin", entreprise_id=None, user_id=u2.id, user_email=u2.email) as client:
        resp = await client.get("/api/parametres/audit-logs")

    assert resp.status_code == 200
    assert resp.json()["total"] >= 2
