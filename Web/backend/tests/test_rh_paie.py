"""Tests API du rapport de paie (Task 6)."""
from datetime import date, time

from app.models.entreprise import Entreprise
from app.models.employe import Employe
from app.models.pointage import Pointage


async def _ent(db_session):
    ent = Entreprise(nom="BTP Test")
    db_session.add(ent)
    await db_session.flush()
    return ent


def _pt(ent_id, emp_id, day):
    return Pointage(
        entreprise_id=ent_id, employe_id=emp_id,
        date_jour=date(2026, 9, day), heure_debut=time(8, 0), heure_fin=time(17, 0),
        statut_validation="valide",
    )


async def test_paie_journalier_jours_valides(db_session, client_factory):
    ent = await _ent(db_session)
    emp = Employe(entreprise_id=ent.id, nom="Rakoto", mode_remuneration="journalier",
                  taux_journalier=40000)
    db_session.add(emp)
    await db_session.flush()
    for day in (1, 2, 3):
        db_session.add(_pt(ent.id, emp.id, day))
    await db_session.flush()

    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.get("/api/rh/paie", params={"mois": 9, "annee": 2026})
        assert r.status_code == 200, r.text
        ligne = next(l for l in r.json()["lignes"] if l["employe_id"] == emp.id)
        assert ligne["jours_valides"] == 3
        assert ligne["brut"] == 120000.0  # 3 × 40 000 Ar
        assert r.json()["total"] == 120000.0


async def test_paie_mensuel_plein(db_session, client_factory):
    ent = await _ent(db_session)
    db_session.add(Employe(entreprise_id=ent.id, nom="Mensu", mode_remuneration="mensuel",
                           salaire_base=900000))
    await db_session.flush()
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.get("/api/rh/paie", params={"mois": 9, "annee": 2026})
        assert r.status_code == 200, r.text
        ligne = next(l for l in r.json()["lignes"] if l["nom"] == "Mensu")
        assert ligne["brut"] == 900000.0


async def test_paie_horaire(db_session, client_factory):
    ent = await _ent(db_session)
    emp = Employe(entreprise_id=ent.id, nom="Rina", mode_remuneration="horaire",
                  taux_horaire=5000)
    db_session.add(emp)
    await db_session.flush()
    # 2 jours x 9 h (8h-17h)
    for day in (1, 2):
        db_session.add(_pt(ent.id, emp.id, day))
    await db_session.flush()
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.get("/api/rh/paie", params={"mois": 9, "annee": 2026})
        ligne = next(l for l in r.json()["lignes"] if l["employe_id"] == emp.id)
        assert ligne["brut"] == 90000.0  # 18 h × 5 000 Ar


async def test_paie_export_csv(db_session, client_factory):
    ent = await _ent(db_session)
    emp = Employe(entreprise_id=ent.id, nom="Rakoto", mode_remuneration="journalier",
                  taux_journalier=40000)
    db_session.add(emp)
    await db_session.flush()
    for day in (1, 2, 3):
        db_session.add(_pt(ent.id, emp.id, day))
    await db_session.flush()
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.get("/api/rh/paie/export", params={"mois": 9, "annee": 2026})
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("text/csv")
        assert "Rakoto" in r.text
        assert "120000" in r.text