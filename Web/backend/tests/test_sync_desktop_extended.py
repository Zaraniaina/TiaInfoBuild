"""Tests de l'extension desktop ↔ web aux 13 entités métier (PHASE 4).

Suite de tests/test_sync_desktop.py — le contrat de base (idempotence,
tenant JWT, isolation) y est déjà couvert. Ici seuls les nouveaux
comportements sont vérifiés :

- push `create` d'une entité étendue (article) inconnue du serveur →
  ligne créée et `client_ref` (UUID desktop) mappé ;
- push `update` avec `base_version` périmée → CONFLIT « le web gagne »
  avec `server_record` renvoyé au desktop, ligne serveur intacte ;
- pull : une facture modifiée côté web remonte filtrée sur
  `sync_updated_at` (curseur strict `>`), les lignes inchangées non ;
- entité inconnue → `rejected` pour CE change sans échec global du batch.
"""
import asyncio

from sqlalchemy import select

from app.models.article import Article
from app.models.client import Client
from app.models.entreprise import Entreprise
from app.models.facture import Facture
from app.routers.sync import ENTITES_SYNC

REF_ARTICLE = "11111111-2222-3333-4444-555555555555"
REF_ARTICLE_CONFLIT = "66666666-7777-8888-9999-000000000000"


# ------------------------------------------------------------
# Helpers de peuplement (repris de test_sync_desktop.py)
# ------------------------------------------------------------

async def _entreprise(db, nom: str = "BTP Sync Ext") -> Entreprise:
    ent = Entreprise(nom=nom)
    db.add(ent)
    await db.flush()
    return ent


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
# 0. Couverture : les 13 entités sont bien branchées au moteur
# ------------------------------------------------------------

def test_entites_sync_couvre_les_13_entites_etendues():
    attendues = {
        "article",
        "mouvement_stock",
        "achat",
        "depense",
        "client",
        "devis",
        "facture",
        "conge",
        "heure_supplementaire",
        "materiel",
        "maintenance",
        "tache",
        "incident",
    }
    assert attendues <= set(ENTITES_SYNC)
    # La base desktop (PHASE 1) est toujours là
    assert {"pointage", "chantier", "employe"} <= set(ENTITES_SYNC)


# ------------------------------------------------------------
# 1. push create d'une entité étendue → client_ref mappé
# ------------------------------------------------------------

async def test_push_create_article_cree_ligne_et_mappe_client_ref(db_session, client_factory):
    ent = await _entreprise(db_session)
    async with await client_factory("directeur", entreprise_id=ent.id) as client:
        r = await client.post(
            "/api/sync/push",
            json={
                "device_id": "device-ext-A",
                "changes": [
                    _change(
                        1,
                        "article",
                        REF_ARTICLE,
                        "create",
                        {
                            "reference": "ART-SYNC-001",
                            "nom": "Ciment CPJ 45",
                            "unite": "sac",
                            "stock_actuel": 42,
                            # Tentative d'injection de tenant : ignorée
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
    assert data["applied_changes"][0]["entity_id"] == REF_ARTICLE
    assert data["applied_changes"][0]["sync_version"] == 1

    row = (
        await db_session.execute(select(Article).where(Article.client_ref == REF_ARTICLE))
    ).scalar_one()
    assert row.entreprise_id == ent.id  # tenant du JWT, pas celui du payload
    assert row.nom == "Ciment CPJ 45"
    assert float(row.stock_actuel) == 42.0
    assert row.is_deleted is False
    assert row.sync_version == 1
    assert row.sync_updated_at is not None
    assert row.sync_created_at is not None


# ------------------------------------------------------------
# 2. push update avec base_version périmée → CONFLIT « le web gagne »
# ------------------------------------------------------------

async def test_push_update_base_version_perimee_web_gagne(db_session, client_factory):
    ent = await _entreprise(db_session)
    async with await client_factory("directeur", entreprise_id=ent.id) as client:
        # Le desktop crée l'article (version serveur 1)…
        r0 = await client.post(
            "/api/sync/push",
            json={
                "device_id": "device-ext-B",
                "changes": [
                    _change(1, "article", REF_ARTICLE_CONFLIT, "create",
                            {"nom": "Brique 12", "unite": "piece", "stock_actuel": 100}),
                ],
            },
        )
        assert r0.status_code == 200, r0.text
        assert r0.json()["applied"] == 1

        # …le web modifie ensuite la ligne (hook before_update → version 2)…
        art = (
            await db_session.execute(
                select(Article).where(Article.client_ref == REF_ARTICLE_CONFLIT)
            )
        ).scalar_one()
        art.stock_actuel = 5
        await db_session.flush()
        assert art.sync_version == 2

        # …puis le desktop pousse une update sur sa version périmée (1 ≠ 2).
        r = await client.post(
            "/api/sync/push",
            json={
                "device_id": "device-ext-B",
                "changes": [
                    _change(2, "article", REF_ARTICLE_CONFLIT, "update",
                            {"stock_actuel": 99}, base_version=1),
                ],
            },
        )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["applied"] == 0
    assert data["rejected"] == []
    assert len(data["conflicts"]) == 1
    conflit = data["conflicts"][0]
    assert conflit["seq"] == 2
    assert conflit["entity"] == "article"
    assert conflit["entity_id"] == REF_ARTICLE_CONFLIT
    # server_record = la ligne serveur (web) sérialisée, cohérente
    assert conflit["server_record"]["sync_version"] == 2
    assert float(conflit["server_record"]["stock_actuel"]) == 5.0

    # Le web gagne : la ligne serveur n'a PAS été écrasée par « 99 »
    await db_session.refresh(art)
    assert float(art.stock_actuel) == 5.0
    assert art.sync_version == 2


# ------------------------------------------------------------
# 3. pull : une facture modifiée remonte, filtrée sur sync_updated_at
# ------------------------------------------------------------

async def test_pull_renvoie_la_facture_modifiee_depuis_curseur(db_session, client_factory):
    ent = await _entreprise(db_session)
    cli = Client(entreprise_id=ent.id, nom="Rakoto SARL")
    db_session.add(cli)
    await db_session.flush()
    fac = Facture(entreprise_id=ent.id, client_id=cli.id, numero="FAC-SYNC-001")
    db_session.add(fac)
    await db_session.flush()

    async with await client_factory("directeur", entreprise_id=ent.id) as client:
        # 1er pull : la facture créée côté web est bien livrée
        r1 = await client.get(
            "/api/sync/pull", params={"since": "2019-01-01T00:00:00+00:00"}
        )
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        factures_vues = {c["entity_id"] for c in d1["changes"] if c["entity"] == "facture"}
        assert fac.id in factures_vues
        curseur = d1["cursor"]
        assert curseur

        # Modification web → le hook bump sync_updated_at + sync_version
        await asyncio.sleep(0.05)  # marge d'horloge
        fac.statut = "payee"
        await db_session.flush()

        # 2e pull depuis le curseur : SEULE la facture changée remonte
        r2 = await client.get("/api/sync/pull", params={"since": curseur})
        assert r2.status_code == 200, r2.text
        d2 = r2.json()

    changes_facture = [c for c in d2["changes"] if c["entity"] == "facture"]
    assert len(changes_facture) == 1
    ch = changes_facture[0]
    assert ch["entity_id"] == fac.id
    assert ch["op"] == "update"
    assert ch["created"] is False
    assert ch["payload"]["statut"] == "payee"
    assert ch["payload"]["numero"] == "FAC-SYNC-001"
    assert ch["payload"]["entreprise_id"] == ent.id
    assert ch["version"] == 2
    # Rien d'autre n'a changé depuis le curseur (client, lignes de départ exclues)
    assert all(c["entity"] == "facture" for c in d2["changes"])


# ------------------------------------------------------------
# 4. entité inconnue → rejected sans échec global du batch
# ------------------------------------------------------------

async def test_push_entite_inconnue_rejectee_sans_echec_global(db_session, client_factory):
    ent = await _entreprise(db_session)
    async with await client_factory("directeur", entreprise_id=ent.id) as client:
        r = await client.post(
            "/api/sync/push",
            json={
                "device_id": "device-ext-C",
                "changes": [
                    _change(1, "entite_fantome", "ref-inconnue", "create", {"nom": "x"}),
                    _change(
                        2,
                        "article",
                        REF_ARTICLE,
                        "create",
                        {"reference": "ART-SYNC-002", "nom": "Rond à béton", "unite": "barre"},
                    ),
                ],
            },
        )
    assert r.status_code == 200, r.text  # le batch n'échoue pas
    data = r.json()
    assert data["applied"] == 1
    assert len(data["rejected"]) == 1
    rejet = data["rejected"][0]
    assert rejet["seq"] == 1
    assert rejet["entity"] == "entite_fantome"
    assert rejet["reason"] == "entite_inconnue"
    # Le changement valide du même batch est bien appliqué
    row = (
        await db_session.execute(select(Article).where(Article.client_ref == REF_ARTICLE))
    ).scalar_one()
    assert row.nom == "Rond à béton"
