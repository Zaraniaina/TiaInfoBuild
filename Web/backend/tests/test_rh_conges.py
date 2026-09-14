"""Tests API des endpoints RH de congés (Task 5)."""
from app.models.employe import Employe
from app.models.entreprise import Entreprise


async def _setup(db_session):
    ent = Entreprise(nom="BTP Test")
    db_session.add(ent)
    await db_session.flush()
    emp = Employe(entreprise_id=ent.id, nom="Rabe", mode_remuneration="mensuel",
                  salaire_base=900000, solde_conges_annuel=30)
    db_session.add(emp)
    await db_session.flush()
    return ent, emp


BODY = {"type": "annuel", "date_debut": "2026-10-05",
        "date_fin": "2026-10-09", "nb_jours": 5, "motif": "Repos annuel"}


async def test_rh_cree_et_valide_un_conge(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.post("/api/rh/conges", json=dict(BODY, employe_id=emp.id))
        assert r.status_code == 201, r.text
        assert r.json()["statut"] == "en_attente"
        assert r.json()["employe_nom"] == "Rabe"
        cid = r.json()["id"]

        r = await client.post(f"/api/rh/conges/{cid}/valider", json={})
        assert r.status_code == 200 and r.json()["statut"] == "valide"

        r = await client.get(f"/api/rh/conges/{emp.id}/solde")
        assert r.json() == {"solde_restant": 25.0, "solde_annuel": 30.0}


async def test_rh_refuse_avec_commentaire(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.post("/api/rh/conges", json=dict(BODY, employe_id=emp.id))
        cid = r.json()["id"]
        r = await client.post(f"/api/rh/conges/{cid}/refuser",
                              json={"commentaire": "Effectif insuffisant"})
        assert r.status_code == 200 and r.json()["statut"] == "refuse"
        assert r.json()["commentaire_refus"] == "Effectif insuffisant"


async def test_double_validation_409(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.post("/api/rh/conges", json=dict(BODY, employe_id=emp.id))
        cid = r.json()["id"]
        await client.post(f"/api/rh/conges/{cid}/valider", json={})
        r = await client.post(f"/api/rh/conges/{cid}/valider", json={})
        assert r.status_code == 409


async def test_rh_employe_autre_entreprise_404(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("rh", entreprise_id=ent.id + 999) as client:
        r = await client.post("/api/rh/conges", json=dict(BODY, employe_id=emp.id))
        assert r.status_code == 404


async def test_client_n_a_pas_le_droit_rang(db_session, client_factory):
    # NB: le rôle 'employe' possède déjà 'rh:read' (RBAC existant pour qu'il lise
    # ses propres données) ; le 403 doit donc être vérifié avec un rôle sans accès RH.
    ent, _ = await _setup(db_session)
    async with await client_factory("client", entreprise_id=ent.id) as client:
        r = await client.get("/api/rh/conges")
        assert r.status_code == 403


async def test_liste_filtre_par_statut(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.post("/api/rh/conges", json=dict(BODY, employe_id=emp.id))
        await client.post(f"/api/rh/conges/{r.json()['id']}/valider", json={})
        r = await client.get("/api/rh/conges", params={"statut": "valide"})
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 1 and data["items"][0]["statut"] == "valide"
