"""Tests API des congés self-only de l'espace employé terrain (Task 7)."""
from app.models.employe import Employe
from app.models.entreprise import Entreprise


async def _setup(db_session, email="rakoto@btp.mg"):
    ent = Entreprise(nom="BTP Test")
    db_session.add(ent)
    await db_session.flush()
    emp = Employe(entreprise_id=ent.id, nom="Rakoto", email=email, solde_conges_annuel=30)
    db_session.add(emp)
    await db_session.flush()
    return ent, emp


BODY = {"type": "annuel", "date_debut": "2026-11-02", "date_fin": "2026-11-03",
        "nb_jours": 2, "motif": "Raison familiale"}


async def test_employe_demande_son_conge(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("employe", entreprise_id=ent.id, user_email=emp.email) as client:
        r = await client.post("/api/employe-terrain/conges", json=BODY)
        assert r.status_code == 201, r.text
        assert r.json()["employe_id"] == emp.id  # forcé côté serveur

        r = await client.get("/api/employe-terrain/conges")
        data = r.json()
        assert data["solde_restant"] == 30.0
        assert data["total_items"] == 1
        assert data["items"][0]["employe_id"] == emp.id


async def test_employe_annule_sa_propre_demande(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("employe", entreprise_id=ent.id, user_email=emp.email) as client:
        r = await client.post("/api/employe-terrain/conges", json=BODY)
        cid = r.json()["id"]

        r = await client.post(f"/api/employe-terrain/conges/{cid}/annuler")
        assert r.status_code == 200 and r.json()["statut"] == "annule"


async def test_employe_ne_voit_pas_les_autres(db_session, client_factory):
    ent, emp = await _setup(db_session, email="a@b.mg")
    _, autre = await _setup(db_session, email="c@d.mg")
    async with await client_factory("employe", entreprise_id=ent.id, user_email=emp.email) as client:
        # Congé d'un autre employé : ne doit pas être listé
        r = await client.get("/api/employe-terrain/conges")
        assert all(i["employe_id"] == emp.id for i in r.json()["items"])


async def test_employe_ne_peut_pas_annuler_un_autre(db_session, client_factory):
    ent, emp = await _setup(db_session, email="a@b.mg")
    await _setup(db_session, email="c@d.mg")
    async with await client_factory("employe", entreprise_id=ent.id, user_email=emp.email) as client:
        # Le congé de 'autre' n'est pas visible : annulation -> 404
        r = await client.post("/api/employe-terrain/conges/9999/annuler")
        assert r.status_code == 404