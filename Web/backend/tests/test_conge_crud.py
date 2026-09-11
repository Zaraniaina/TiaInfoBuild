"""Tests CRUD Congé (solde calculé, décision anti-double)."""
from datetime import date

import pytest
from fastapi import HTTPException

from app.crud.conge import CongeCRUD
from app.models.entreprise import Entreprise
from app.models.employe import Employe


async def _employe(db, **over) -> Employe:
    ent = Entreprise(nom="BTP Test")
    db.add(ent)
    await db.flush()
    emp = Employe(entreprise_id=ent.id, nom="Rakoto", mode_remuneration="journalier",
                  taux_journalier=40000, solde_conges_annuel=30, **over)
    db.add(emp)
    await db.flush()
    return emp


async def test_create_et_solde(db_session):
    emp = await _employe(db_session)
    crud = CongeCRUD()
    c = await crud.create(db_session, {
        "employe_id": emp.id, "type": "annuel", "date_debut": date(2026, 10, 5),
        "date_fin": date(2026, 10, 9), "nb_jours": 5, "statut": "valide",
    })
    assert c.id is not None
    assert await crud.solde_restant(db_session, emp) == 25.0  # 30 - 5


async def test_solde_ignore_refuses_et_autres_types(db_session):
    emp = await _employe(db_session)
    crud = CongeCRUD()
    await crud.create(db_session, {"employe_id": emp.id, "type": "annuel",
                                   "date_debut": date(2026, 10, 5), "date_fin": date(2026, 10, 9),
                                   "nb_jours": 5, "statut": "refuse"})
    await crud.create(db_session, {"employe_id": emp.id, "type": "sans_solde",
                                   "date_debut": date(2026, 10, 5), "date_fin": date(2026, 10, 6),
                                   "nb_jours": 2, "statut": "valide"})
    assert await crud.solde_restant(db_session, emp) == 30.0


async def test_decide_anti_double(db_session):
    emp = await _employe(db_session)
    crud = CongeCRUD()
    c = await crud.create(db_session, {"employe_id": emp.id, "type": "annuel",
                                       "date_debut": date(2026, 10, 5), "date_fin": date(2026, 10, 6),
                                       "nb_jours": 1})
    assert c.statut == "en_attente"
    await crud.decide(db_session, c, statut="valide", valide_par=1, commentaire=None)
    assert c.statut == "valide" and c.valide_par == 1 and c.date_validation is not None
    with pytest.raises(HTTPException):
        await crud.decide(db_session, c, statut="refuse", valide_par=1, commentaire="deja valide")


async def test_liste_scoping_entreprise(db_session):
    emp1 = await _employe(db_session)  # entreprise 1
    # Employé d'une autre entreprise
    ent2 = Entreprise(nom="BTP 2")
    db_session.add(ent2)
    await db_session.flush()
    await db_session.flush()
    emp2 = Employe(entreprise_id=ent2.id, nom="Autre")
    db_session.add(emp2)
    await db_session.flush()
    crud = CongeCRUD()
    await crud.create(db_session, {"entreprise_id": emp1.entreprise_id, "employe_id": emp1.id,
                                   "type": "annuel", "date_debut": date(2026, 10, 5),
                                   "date_fin": date(2026, 10, 6), "nb_jours": 1})
    await crud.create(db_session, {"entreprise_id": ent2.id, "employe_id": emp2.id,
                                   "type": "annuel", "date_debut": date(2026, 10, 5),
                                   "date_fin": date(2026, 10, 6), "nb_jours": 1})
    items, total = await crud.list_for_entreprise(db_session, emp1.entreprise_id)
    assert total == 1 and items[0].employe_id == emp1.id
    items2, total2 = await crud.list_for_employe(db_session, emp2.id)
    assert total2 == 1 and items2[0].employe_id == emp2.id
