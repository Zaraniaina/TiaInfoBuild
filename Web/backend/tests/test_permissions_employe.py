"""Tests de non-régression des permissions : l'EMPLOYE n'a plus rh:read.

Contexte : le rôle EMPLOYE avait `rh:read`, ce qui exposait la liste du
personnel et les paies de tous les employés via /rh/*. Le portail employé
passe par le routeur dédié /employe-terrain/*, donc rh:read doit être refusé.
"""
from datetime import date

from app.models.employe import Employe
from app.models.entreprise import Entreprise


async def _setup(db_session):
    ent = Entreprise(nom="BTP Test")
    db_session.add(ent)
    await db_session.flush()
    emp = Employe(entreprise_id=ent.id, nom="Rabe", mode_remuneration="mensuel",
                  salaire_base=900000)
    db_session.add(emp)
    await db_session.flush()
    return ent, emp


async def test_employe_bloque_sur_liste_personnel(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("employe", entreprise_id=ent.id) as client:
        r = await client.get("/api/rh/employes")
        assert r.status_code == 403, f"Fuite : /rh/employes accessible à l'employé ({r.status_code})"


async def test_employe_bloque_sur_paie(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("employe", entreprise_id=ent.id) as client:
        r = await client.get("/api/rh/paie", params={"mois": 9, "annee": 2026})
        assert r.status_code == 403, f"Fuite : /rh/paie accessible à l'employé ({r.status_code})"


async def test_employe_bloque_sur_heures_sup(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("employe", entreprise_id=ent.id) as client:
        r = await client.get("/api/rh/heures-sup")
        assert r.status_code == 403, f"Fuite : /rh/heures-sup accessible à l'employé ({r.status_code})"


async def test_employe_accede_encore_a_son_espace_terrain(db_session, client_factory):
    """Le retrait de rh:read ne doit pas casser le portail employé."""
    ent, emp = await _setup(db_session)
    async with await client_factory(
        "employe", entreprise_id=ent.id, user_email="gerard@btppro.mg"
    ) as client:
        r = await client.get("/api/employe-terrain/mon-badge")
        assert r.status_code in (200, 404), r.text  # 200 si une fiche existe, 404 sinon — jamais 403


async def test_rh_conserve_l_acces_personnel(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.get("/api/rh/employes")
        assert r.status_code == 200, r.text
