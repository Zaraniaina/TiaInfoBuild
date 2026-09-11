"""Tests API des documents RH par employé (Task 12)."""
from app.models.employe import Employe
from app.models.entreprise import Entreprise


async def _setup(db_session):
    ent = Entreprise(nom="BTP Test")
    db_session.add(ent)
    await db_session.flush()
    emp = Employe(entreprise_id=ent.id, nom="Rakoto", email="r@btp.mg")
    db_session.add(emp)
    await db_session.flush()
    return ent, emp


async def test_rh_cree_et_liste_documents(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.post(f"/api/rh/employes/{emp.id}/documents", json={
            "nom": "Contrat de travail",
            "categorie": "contrat_travail",
            "fichier_url": "https://storage/dossier/contrat.pdf",
            "description": "CDI signé",
        })
        assert r.status_code == 201, r.text
        assert r.json()["employe_id"] == emp.id
        assert r.json()["categorie"] == "contrat_travail"

        r = await client.get(f"/api/rh/employes/{emp.id}/documents")
        assert r.status_code == 200
        data = r.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["nom"] == "Contrat de travail"


async def test_rh_categorie_invalide_422(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.post(f"/api/rh/employes/{emp.id}/documents", json={
            "nom": "Doc",
            "categorie": "inconnue",
        })
        assert r.status_code == 422


async def test_employe_autre_entreprise_404(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("rh", entreprise_id=ent.id + 999) as client:
        r = await client.post(f"/api/rh/employes/{emp.id}/documents", json={
            "nom": "Doc", "categorie": "autre",
        })
        assert r.status_code == 404


async def test_client_pas_le_droit(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("client", entreprise_id=ent.id) as client:
        r = await client.get(f"/api/rh/employes/{emp.id}/documents")
        assert r.status_code == 403