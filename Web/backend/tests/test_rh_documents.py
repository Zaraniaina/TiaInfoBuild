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


async def test_upload_document_rh(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.post(
            f"/api/rh/employes/{emp.id}/documents/upload",
            data={"categorie": "cv", "nom": "CV Rakoto"},
            files={"fichier": ("cv.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["categorie"] == "cv"
        assert data["nom"] == "CV Rakoto"
        assert data["fichier_url"].startswith("/api/uploads/documents-rh/")
        assert data["fichier_url"].endswith(".pdf")

        # Le fichier est réellement sur disque et la fiche listée.
        r = await client.get(f"/api/rh/employes/{emp.id}/documents")
        assert r.status_code == 200
        assert len(r.json()["items"]) == 1


async def test_upload_categorie_embauche_acceptee(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        for cat, fname, mime in [
            ("lettre_motivation", "lm.pdf", "application/pdf"),
            ("diplome", "diplome.png", "image/png"),
            ("cni", "cni.jpg", "image/jpeg"),
        ]:
            r = await client.post(
                f"/api/rh/employes/{emp.id}/documents/upload",
                data={"categorie": cat},
                files={"fichier": (fname, b"fake-bytes", mime)},
            )
            assert r.status_code == 201, r.text
            assert r.json()["categorie"] == cat


async def test_upload_categorie_invalide_422(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.post(
            f"/api/rh/employes/{emp.id}/documents/upload",
            data={"categorie": "passeport_bidon"},
            files={"fichier": ("f.pdf", b"fake", "application/pdf")},
        )
        assert r.status_code == 422


async def test_upload_extension_non_autorisee_400(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.post(
            f"/api/rh/employes/{emp.id}/documents/upload",
            data={"categorie": "cv"},
            files={"fichier": ("malware.exe", b"MZ...", "application/octet-stream")},
        )
        assert r.status_code == 400


async def test_badge_qr_renvoie_entreprise_nom_et_logo(db_session, client_factory):
    ent, emp = await _setup(db_session)
    ent.logo = "/api/uploads/logos/btp-test.png"
    await db_session.flush()
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.get(f"/api/rh/employes/{emp.id}/badge-qr")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["entreprise_nom"] == "BTP Test"
        assert data["entreprise_logo"] == "/api/uploads/logos/btp-test.png"
        assert data["code_qr_badge"].startswith("TIA-EMP-")


async def test_mon_badge_renvoie_entreprise(db_session, client_factory):
    ent, emp = await _setup(db_session)
    ent.logo = "/api/uploads/logos/btp.png"
    async with await client_factory("rh", entreprise_id=ent.id, user_email="r@btp.mg") as client:
        r = await client.get("/api/rh/mon-badge")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["entreprise_nom"] == "BTP Test"
        assert data["entreprise_logo"] == "/api/uploads/logos/btp.png"