"""Tests du volet backend desktop : activation de poste + synchronisation push/pull.

Contrat implémenté (docs/plan-desktop-tauri.md §5.2 / §6) :
- POST /api/auth/desktop/activate (public) : tokens identiques au login,
  profil minimal, référentiel de seed, erreurs identiques au login (401/409).
- POST /api/sync/push (Bearer) : idempotence (device_id, seq), règle
  « le web gagne » (base_version), entités inconnues rejetées sans échec
  global, tenant imposé par le JWT.
- GET /api/sync/pull?since=&limit= (Bearer) : delta web → desktop filtré sur
  sync_updated_at, op reconstruit (delete/update + marqueur created).
- GET /api/sync/push n'existe pas : seul POST est déclaré (405).
"""
import asyncio
from datetime import date

from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.database import get_db
from app.main import app
from app.models.employe import Employe
from app.models.entreprise import Entreprise
from app.models.pointage import Pointage
from app.models.role import Role
from app.models.utilisateur import Utilisateur
from app.security import decode_token, hash_password

MDP = "Admin123!"


# ------------------------------------------------------------
# Helpers de peuplement (SQLite en mémoire, fixtures conftest.py)
# ------------------------------------------------------------

async def _entreprise(db, nom: str = "BTP Sync") -> Entreprise:
    ent = Entreprise(nom=nom)
    db.add(ent)
    await db.flush()
    return ent


async def _employe(db, ent: Entreprise, nom: str = "Rabe") -> Employe:
    emp = Employe(
        entreprise_id=ent.id,
        nom=nom,
        prenom="Solo",
        mode_remuneration="mensuel",
        salaire_base=900_000,
    )
    db.add(emp)
    await db.flush()
    return emp


async def _utilisateur(
    db,
    ent: Entreprise,
    *,
    email: str,
    role_code: str = "directeur",
    mdp: str = MDP,
    statut: str = "actif",
    verifie: bool = True,
) -> Utilisateur:
    role = (await db.execute(select(Role).where(Role.code == role_code))).scalar_one_or_none()
    if role is None:
        role = Role(code=role_code, nom=role_code)
        db.add(role)
        await db.flush()
    user = Utilisateur(
        entreprise_id=ent.id,
        role_id=role.id,
        nom="Rakoto",
        prenom="Jean",
        email=email,
        mot_de_passe_hash=hash_password(mdp),
        statut=statut,
        is_email_verified=verifie,
    )
    db.add(user)
    await db.flush()
    return user


async def _pointage(db, ent: Entreprise, emp: Employe, jour: date, **kwargs) -> Pointage:
    pt = Pointage(
        entreprise_id=ent.id,
        employe_id=emp.id,
        date_jour=jour,
        heures_total=8.0,
        type="present",
        methode_pointage="manuel",
        **kwargs,
    )
    db.add(pt)
    await db.flush()
    return pt


def _change(seq: int, entity: str, entity_id, op: str, payload: dict, base_version=None) -> dict:
    return {
        "seq": seq,
        "entity": entity,
        "entity_id": entity_id,
        "op": op,
        "payload": payload,
        "client_ts": "2026-09-20T07:59:00+00:00",
        "base_version": base_version,
    }


# ------------------------------------------------------------
# 1. POST /api/auth/desktop/activate
# ------------------------------------------------------------

async def test_activate_ok_renvoie_tokens_profil_et_entreprise(db_session, client_factory):
    ent = await _entreprise(db_session)
    user = await _utilisateur(db_session, ent, email="directeur@sync.mg")
    async with await client_factory(
        "directeur", entreprise_id=ent.id, user_email=user.email, user_id=user.id
    ) as client:
        r = await client.post(
            "/api/auth/desktop/activate",
            json={"email": "directeur@sync.mg", "password": MDP, "device_id": "device-001"},
        )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["token_type"] == "Bearer"
    assert data["entreprise_id"] == ent.id
    # Profil minimal {id, email, nom, prenom, role}
    assert data["user"]["id"] == user.id
    assert data["user"]["email"] == "directeur@sync.mg"
    assert data["user"]["role"] == "directeur"
    assert {"nom", "prenom"} <= set(data["user"])
    assert data["server_time"]
    # Tokens « comme le login » : utilisables tels quels (JWT valide + refresh)
    claims = decode_token(data["access_token"])
    assert claims["entreprise_id"] == ent.id
    assert claims["role_code"] == "directeur"
    decode_token(data["refresh_token"], refresh=True)
    # Référentiel de seed local optionnel : rôles + permissions
    assert data["referentiel"] is not None
    assert isinstance(data["referentiel"]["permissions"], dict)
    assert any(r_["code"] == "directeur" for r_ in data["referentiel"]["roles"])


async def test_activate_mauvais_mot_de_passe_401(db_session, client_factory):
    ent = await _entreprise(db_session)
    await _utilisateur(db_session, ent, email="directeur@sync.mg")
    async with await client_factory("directeur", entreprise_id=ent.id) as client:
        r = await client.post(
            "/api/auth/desktop/activate",
            json={"email": "directeur@sync.mg", "password": "Mauvais1!", "device_id": "device-001"},
        )
    assert r.status_code == 401
    assert r.json()["detail"] == "Email ou mot de passe incorrect"


async def test_activate_email_inconnu_401_message_identique_au_login(db_session, client_factory):
    """Email inconnu → même 401 / même message que mauvais mdp (anti-énumération)."""
    async with await client_factory("directeur", entreprise_id=1) as client:
        r = await client.post(
            "/api/auth/desktop/activate",
            json={"email": "inconnu@sync.mg", "password": MDP, "device_id": "device-001"},
        )
    assert r.status_code == 401
    assert r.json()["detail"] == "Email ou mot de passe incorrect"


async def test_activate_compte_inactif_409(db_session, client_factory):
    ent = await _entreprise(db_session)
    await _utilisateur(db_session, ent, email="inactif@sync.mg", statut="inactif")
    async with await client_factory("directeur", entreprise_id=ent.id) as client:
        r = await client.post(
            "/api/auth/desktop/activate",
            json={"email": "inactif@sync.mg", "password": MDP, "device_id": "device-001"},
        )
    assert r.status_code == 409
    assert "Aucun compte actif" in r.json()["detail"]


async def test_activate_email_non_confirme_409(db_session, client_factory):
    ent = await _entreprise(db_session)
    await _utilisateur(db_session, ent, email="nonconfirme@sync.mg", verifie=False)
    async with await client_factory("directeur", entreprise_id=ent.id) as client:
        r = await client.post(
            "/api/auth/desktop/activate",
            json={"email": "nonconfirme@sync.mg", "password": MDP, "device_id": "device-001"},
        )
    assert r.status_code == 409
    assert "Aucun compte actif" in r.json()["detail"]


def test_openapi_expose_uniquement_le_contrat_desktop():
    """Vérification en mémoire via /openapi : chemins et méthodes exacts."""
    paths = app.openapi()["paths"]
    assert "post" in paths.get("/api/auth/desktop/activate", {})
    assert "post" in paths.get("/api/sync/push", {})
    assert "get" in paths.get("/api/sync/pull", {})
    # GET /api/sync/push n'existe pas : seule la route POST est déclarée
    assert "get" not in paths["/api/sync/push"]


# ------------------------------------------------------------
# 2/3. POST /api/sync/push : create + idempotence
# ------------------------------------------------------------

REF_CLIENT = "3f6c2f0a-8f9e-4c1a-9d5e-0b1c2d3e4f50"


async def test_push_create_pointage_stocke_client_ref(db_session, client_factory):
    ent = await _entreprise(db_session)
    emp = await _employe(db_session, ent)
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.post(
            "/api/sync/push",
            json={
                "device_id": "device-A",
                "changes": [
                    _change(
                        1,
                        "pointage",
                        REF_CLIENT,
                        "create",
                        {
                            "employe_id": emp.id,
                            "date_jour": "2026-09-20",
                            "heures_total": 8,
                            "type": "present",
                            "methode_pointage": "qr_site",
                            # Tentative d'injection de tenant : doit être ignorée
                            "entreprise_id": 999,
                        },
                    )
                ],
            },
        )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["applied"] == 1
    assert data["skipped"] == 0
    assert data["conflicts"] == []
    assert data["rejected"] == []
    assert data["applied_changes"][0]["sync_version"] == 1
    assert data["applied_changes"][0]["entity_id"] == REF_CLIENT

    row = (
        await db_session.execute(select(Pointage).where(Pointage.client_ref == REF_CLIENT))
    ).scalar_one()
    assert row.entreprise_id == ent.id  # tenant du JWT, pas celui du payload
    assert row.sync_version == 1
    assert row.sync_updated_at is not None
    assert row.sync_created_at is not None
    assert row.date_jour == date(2026, 9, 20)  # chaîne ISO convertie en date


async def test_push_idempotent_rejeu_meme_device_seq(db_session, client_factory):
    ent = await _entreprise(db_session)
    emp = await _employe(db_session, ent)
    corps = {
        "device_id": "device-A",
        "changes": [
            _change(
                7,
                "pointage",
                REF_CLIENT,
                "create",
                {"employe_id": emp.id, "date_jour": "2026-09-21", "heures_total": 8},
            )
        ],
    }
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r1 = await client.post("/api/sync/push", json=corps)
        r2 = await client.post("/api/sync/push", json=corps)  # rejeu (reprise réseau)
    assert r1.status_code == 200, r1.text
    assert r1.json()["applied"] == 1
    assert r2.status_code == 200, r2.text
    assert r2.json()["applied"] == 0
    assert r2.json()["skipped"] == 1

    lignes = (
        await db_session.execute(select(Pointage).where(Pointage.client_ref == REF_CLIENT))
    ).scalars().all()
    assert len(lignes) == 1  # aucun doublon


# ------------------------------------------------------------
# 4/5. POST /api/sync/push : règle « le web gagne »
# ------------------------------------------------------------

async def test_push_update_base_version_perime_conflict_web_gagne(db_session, client_factory):
    ent = await _entreprise(db_session)
    emp = await _employe(db_session, ent)
    # Le desktop crée la ligne (version 1)…
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r0 = await client.post(
            "/api/sync/push",
            json={
                "device_id": "device-A",
                "changes": [
                    _change(1, "pointage", REF_CLIENT, "create",
                            {"employe_id": emp.id, "date_jour": "2026-09-22"})
                ],
            },
        )
        assert r0.status_code == 200, r0.text
        # …puis pousse une update avec une version serveur périmée.
        r = await client.post(
            "/api/sync/push",
            json={
                "device_id": "device-A",
                "changes": [
                    _change(2, "pointage", REF_CLIENT, "update",
                            {"notes": "Écriture desktop"}, base_version=42)
                ],
            },
        )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["applied"] == 0
    assert len(data["conflicts"]) == 1
    conflit = data["conflicts"][0]
    assert conflit["seq"] == 2
    assert conflit["entity"] == "pointage"
    assert conflit["entity_id"] == REF_CLIENT
    # server_record = la ligne serveur (web) sérialisée, cohérente
    assert conflit["server_record"]["notes"] is None
    assert conflit["server_record"]["sync_version"] == 1

    # Le web gagne : la ligne serveur n'a PAS été modifiée
    row = (
        await db_session.execute(select(Pointage).where(Pointage.client_ref == REF_CLIENT))
    ).scalar_one()
    assert row.notes is None
    assert row.sync_version == 1


async def test_push_update_base_version_correcte_appliquee(db_session, client_factory):
    ent = await _entreprise(db_session)
    emp = await _employe(db_session, ent)
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r0 = await client.post(
            "/api/sync/push",
            json={
                "device_id": "device-A",
                "changes": [
                    _change(1, "pointage", REF_CLIENT, "create",
                            {"employe_id": emp.id, "date_jour": "2026-09-23"})
                ],
            },
        )
        assert r0.status_code == 200, r0.text
        r = await client.post(
            "/api/sync/push",
            json={
                "device_id": "device-A",
                "changes": [
                    _change(2, "pointage", REF_CLIENT, "update",
                            {"notes": "Saisie desktop"}, base_version=1)
                ],
            },
        )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["applied"] == 1
    assert data["conflicts"] == []
    assert data["applied_changes"][0]["sync_version"] == 2

    row = (
        await db_session.execute(select(Pointage).where(Pointage.client_ref == REF_CLIENT))
    ).scalar_one()
    assert row.notes == "Saisie desktop"
    assert row.sync_version == 2  # hook before_update : version incrémentée


# ------------------------------------------------------------
# 6. GET /api/sync/pull : delta depuis un curseur + soft delete
# ------------------------------------------------------------

async def test_pull_delta_depuis_curseur_et_delete_remonte(db_session, client_factory):
    ent = await _entreprise(db_session)
    emp = await _employe(db_session, ent)
    pa = await _pointage(db_session, ent, emp, date(2026, 9, 1))
    pb = await _pointage(db_session, ent, emp, date(2026, 9, 2))
    pc = await _pointage(db_session, ent, emp, date(2026, 9, 3))

    async with await client_factory("rh", entreprise_id=ent.id) as client:
        # 1er pull : tout depuis le début
        r1 = await client.get("/api/sync/pull", params={"since": "2019-01-01T00:00:00+00:00"})
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        ids_vus = {c["entity_id"] for c in d1["changes"] if c["entity"] == "pointage"}
        assert {pa.id, pb.id, pc.id} <= ids_vus
        assert d1["cursor"] and d1["server_time"]
        assert len(d1["changes"]) > 0
        curseur = d1["cursor"]

        # Deuxième cycle : une ligne modifiée, une supprimée (soft delete).
        await asyncio.sleep(0.05)  # marge d'horloge (résolution ~µs)
        pa.notes = "Modifié côté web"
        pb.is_deleted = True
        await db_session.flush()

        r2 = await client.get("/api/sync/pull", params={"since": curseur})
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        par_id = {c["entity_id"]: c for c in d2["changes"] if c["entity"] == "pointage"}

        assert pa.id in par_id
        assert pb.id in par_id
        assert pc.id not in par_id  # inchangée depuis le curseur
        assert par_id[pa.id]["op"] == "update"
        assert par_id[pa.id]["created"] is False
        assert par_id[pa.id]["payload"]["notes"] == "Modifié côté web"
        assert par_id[pa.id]["version"] == 2
        assert par_id[pb.id]["op"] == "delete"
        assert par_id[pb.id]["payload"]["is_deleted"] in (True, 1)
        assert par_id[pb.id]["payload"]["entreprise_id"] == ent.id
        # Chaque change porte payload + version + entity_id (PK)
        assert set(par_id[pa.id]) >= {"entity", "entity_id", "op", "payload", "version"}


# ------------------------------------------------------------
# 7. Isolation multi-tenant : jamais de ligne d'une autre entreprise
# ------------------------------------------------------------

REF_B = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"


async def test_isolation_tenant_push_et_pull(db_session, client_factory):
    ent_a = await _entreprise(db_session, "Entreprise A")
    ent_b = await _entreprise(db_session, "Entreprise B")
    emp_a = await _employe(db_session, ent_a, nom="Rakoto")
    emp_b = await _employe(db_session, ent_b, nom="Rasoa")
    pt_b = await _pointage(
        db_session, ent_b, emp_b, date(2026, 9, 10), notes="Secret B", client_ref=REF_B
    )
    version_b_avant = pt_b.sync_version

    async with await client_factory("rh", entreprise_id=ent_a.id) as client:
        # Pull côté A : rien de B ne transparaît
        r1 = await client.get("/api/sync/pull")
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        cles_vues = {(c["entity"], c["entity_id"]) for c in d1["changes"]}
        assert ("employe", emp_a.id) in cles_vues  # les données de A sont là
        assert ("pointage", pt_b.id) not in cles_vues
        assert ("employe", emp_b.id) not in cles_vues
        assert all(c["payload"]["entreprise_id"] == ent_a.id for c in d1["changes"])

        # Push update visant l'UUID de la ligne de B : ligne absente pour A
        # → traitée comme create dans A, la ligne de B reste intacte.
        r2 = await client.post(
            "/api/sync/push",
            json={
                "device_id": "device-A",
                "changes": [
                    _change(1, "pointage", REF_B, "update",
                            {"employe_id": emp_a.id, "date_jour": "2026-09-11",
                             "heures_total": 8, "notes": "Piratage"})
                ],
            },
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["applied"] == 1

        # Push delete visant la PK de la ligne de B : rejeté (jamais modifiée).
        r3 = await client.post(
            "/api/sync/push",
            json={
                "device_id": "device-A",
                "changes": [
                    _change(2, "pointage", str(pt_b.id), "delete", {})
                ],
            },
        )
    assert r3.status_code == 200, r3.text
    d3 = r3.json()
    assert d3["rejected"] and d3["rejected"][0]["reason"] == "ligne_absente"
    assert d3["applied"] == 0

    # La ligne de B est strictement intacte
    await db_session.refresh(pt_b)
    assert pt_b.notes == "Secret B"
    assert pt_b.is_deleted is False
    assert pt_b.sync_version == version_b_avant
    assert pt_b.entreprise_id == ent_b.id

    # La tentative a bien créé une ligne dans l'entreprise A (pas de modification de B)
    lignes_a = (
        await db_session.execute(select(Pointage).where(Pointage.entreprise_id == ent_a.id))
    ).scalars().all()
    assert len(lignes_a) == 1
    assert lignes_a[0].notes == "Piratage"
    assert lignes_a[0].entreprise_id != ent_b.id


# ------------------------------------------------------------
# 8. Authentification obligatoire + GET /api/sync/push inexistant
# ------------------------------------------------------------

async def test_push_pull_sans_token_401_et_get_push_405(db_session):
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            r_push = await client.post("/api/sync/push", json={"device_id": "d", "changes": []})
            r_pull = await client.get("/api/sync/pull")
            r_get_push = await client.get("/api/sync/push")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert r_push.status_code in (401, 403)
    assert r_pull.status_code in (401, 403)
    # Seule la route POST existe sur /api/sync/push
    assert r_get_push.status_code == 405
