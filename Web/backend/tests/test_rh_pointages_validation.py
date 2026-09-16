"""Tests API de la validation des pointages par le RH (POST /rh/pointages/{id}/valider|refuser)."""
from datetime import date

from app.models.employe import Employe
from app.models.entreprise import Entreprise
from app.models.pointage import Pointage


async def _setup(db_session):
    ent = Entreprise(nom="BTP Test")
    db_session.add(ent)
    await db_session.flush()
    emp = Employe(entreprise_id=ent.id, nom="Rabe", mode_remuneration="mensuel",
                  salaire_base=900000)
    db_session.add(emp)
    await db_session.flush()
    pt = Pointage(entreprise_id=ent.id, employe_id=emp.id, date_jour=date(2026, 9, 16),
                  heures_total=8.0, type="present", methode_pointage="qr_site",
                  statut_validation="en_attente")
    db_session.add(pt)
    await db_session.flush()
    return ent, emp, pt


async def test_rh_valide_un_pointage(db_session, client_factory):
    ent, emp, pt = await _setup(db_session)
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.post(f"/api/rh/pointages/{pt.id}/valider", json={})
        assert r.status_code == 200, r.text
        assert r.json()["statut_validation"] == "valide"


async def test_rh_refuse_un_pointage_avec_commentaire(db_session, client_factory):
    ent, emp, pt = await _setup(db_session)
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.post(f"/api/rh/pointages/{pt.id}/refuser",
                              json={"commentaire": "Badge non scanné sur site"})
        assert r.status_code == 200
        assert r.json()["statut_validation"] == "refuse"
        assert r.json()["notes"] == "Badge non scanné sur site"


async def test_double_validation_409(db_session, client_factory):
    ent, emp, pt = await _setup(db_session)
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        await client.post(f"/api/rh/pointages/{pt.id}/valider", json={})
        r = await client.post(f"/api/rh/pointages/{pt.id}/valider", json={})
        assert r.status_code == 409


async def test_pointage_autre_entreprise_404(db_session, client_factory):
    ent, emp, pt = await _setup(db_session)
    async with await client_factory("rh", entreprise_id=ent.id + 999) as client:
        r = await client.post(f"/api/rh/pointages/{pt.id}/valider", json={})
        assert r.status_code == 404


async def test_client_n_a_pas_le_droit(db_session, client_factory):
    ent, emp, pt = await _setup(db_session)
    async with await client_factory("client", entreprise_id=ent.id) as client:
        r = await client.post(f"/api/rh/pointages/{pt.id}/valider", json={})
        assert r.status_code == 403
