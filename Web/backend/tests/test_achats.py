"""Tests API du module Achats fournisseurs (cycle commande → réception → facture → paiement).

Couvre :
- Création de commande : numérotation auto CMD-F-YYYY-00001, totaux HT/TVA/TTC
- Workflow de réception : partielle (stock alimenté, statut partiellement_recue),
  refus de sur-réception, complétude (statut recue)
- Factures : création, échéance en retard, paiement partiel puis soldé,
  refus de sur-paiement, statut recalculé
- Multi-tenant : accès 403 aux données d'une autre entreprise
- Impact chantier : budget vs commandé/facturé/payé, taux de consommation
"""
import pytest
from datetime import date, timedelta
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.database import get_db
from app.security import get_current_user
from app.models.entreprise import Entreprise
from app.models.fournisseur import Fournisseur
from app.models.article import Article
from app.models.chantier import Chantier


async def _seed(db_session):
    """Jeu de données minimal : 2 entreprises, fournisseur, article, chantier."""
    ent = Entreprise(nom="BTP Climat")
    db_session.add(ent)
    await db_session.flush()
    ent2 = Entreprise(nom="BTP Autre")
    db_session.add(ent2)
    await db_session.flush()

    f = Fournisseur(entreprise_id=ent.id, nom="Quincaillerie Centrale")
    db_session.add(f)
    art = Article(entreprise_id=ent.id, nom="Ciment 50kg", reference="ART-CIM-1", unite="sac 50kg")
    db_session.add(art)
    ch = Chantier(entreprise_id=ent.id, nom="Chantier Toamasina", budget_prevu=10_000_000)
    db_session.add(ch)
    await db_session.flush()
    return ent.id, ent2.id, f.id, art.id, ch.id


async def _client(db_session, entreprise_id: int) -> AsyncClient:
    payload = {"sub": "1", "role_code": "super_admin", "entreprise_id": entreprise_id}

    async def _override_get_db():
        yield db_session

    async def _override_user():
        return payload

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_user
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_cycle_complet_commande_reception_facture_paiement(db_session):
    """Le cycle achats de bout en bout avec totaux et stock vérifiés."""
    ent_id, _, four_id, art_id, ch_id = await _seed(db_session)
    client = await _client(db_session, ent_id)
    async with client:
        # 1. Création commande : 100 sacs à 50 000 Ar → 5 000 000 HT, 6 000 000 TTC
        r = await client.post("/api/achats/commandes", json={
            "fournisseur_id": four_id,
            "chantier_id": ch_id,
            "taux_tva": 20,
            "lignes": [
                {"article_id": art_id, "designation": "Ciment 50kg", "quantite": 100, "prix_unitaire": 50000},
                {"designation": "Location camion", "quantite": 10, "prix_unitaire": 50000},
            ],
        })
        assert r.status_code == 201, r.text
        body = r.json()
        cmd_id = body["id"]
        assert body["numero"].startswith("CMD-F-") and body["numero"].endswith("-00001")

        # 2. Détail : totaux recalculés
        r = await client.get(f"/api/achats/commandes/{cmd_id}")
        assert r.status_code == 200
        cmd = r.json()
        assert float(cmd["montant_ht"]) == 5_500_000.00
        assert float(cmd["montant_tva"]) == 1_100_000.00
        assert float(cmd["montant_ttc"]) == 6_600_000.00
        assert cmd["statut"] == "brouillon"

        # 3. Réception sur brouillon refusée
        r = await client.post(f"/api/achats/commandes/{cmd_id}/receptions", json={
            "lignes": [{"ligne_commande_id": cmd["lignes"][0]["id"], "quantite_recue": 10}],
        })
        assert r.status_code == 409

        # 4. Confirmation puis réception partielle : 60/100 sacs → stock = 60
        r = await client.post(f"/api/achats/commandes/{cmd_id}/statut?statut=confirmee")
        assert r.status_code == 200
        r = await client.post(f"/api/achats/commandes/{cmd_id}/receptions", json={
            "lignes": [{"ligne_commande_id": cmd["lignes"][0]["id"], "quantite_recue": 60}],
        })
        assert r.status_code == 201, r.text
        assert r.json()["commande_statut"] == "partiellement_recue"
        art = await db_session.get(Article, art_id)
        assert float(art.stock_actuel) == 60.0

        # 5. Sur-réception refusée (restant 40)
        r = await client.post(f"/api/achats/commandes/{cmd_id}/receptions", json={
            "lignes": [{"ligne_commande_id": cmd["lignes"][0]["id"], "quantite_recue": 50}],
        })
        assert r.status_code == 400

        # 6. Réception finale → commande reçue, stock 100
        r = await client.post(f"/api/achats/commandes/{cmd_id}/receptions", json={
            "lignes": [
                {"ligne_commande_id": cmd["lignes"][0]["id"], "quantite_recue": 40},
                {"ligne_commande_id": cmd["lignes"][1]["id"], "quantite_recue": 10},
            ],
        })
        assert r.status_code == 201
        assert r.json()["commande_statut"] == "recue"
        await db_session.refresh(art)
        assert float(art.stock_actuel) == 100.0

        # 7. Facture liée + paiement partiel puis soldé
        r = await client.post("/api/achats/factures", json={
            "fournisseur_id": four_id,
            "commande_id": cmd_id,
            "chantier_id": ch_id,
            "numero": "FAC-FOURN-001",
            "montant_ht": 6_600_000,
            "taux_tva": 20,
        })
        assert r.status_code == 201, r.text
        fac_id = r.json()["id"]

        r = await client.post(f"/api/achats/factures/{fac_id}/paiements", json={
            "montant": 3_000_000, "mode_paiement": "mvola", "reference": "MV-123",
        })
        assert r.status_code == 201
        assert r.json()["facture_statut"] == "partiellement_payee"

        # 8. Sur-paiement refusé
        r = await client.post(f"/api/achats/factures/{fac_id}/paiements", json={
            "montant": 9_999_999, "mode_paiement": "virement",
        })
        assert r.status_code == 400

        r = await client.post(f"/api/achats/factures/{fac_id}/paiements", json={
            "montant": 4_920_000, "mode_paiement": "virement",
        })
        assert r.status_code == 201
        assert r.json()["facture_statut"] == "payee"

        # 9. Impact chantier : budget 10 000 000 vs facturé 7 920 000
        r = await client.get(f"/api/achats/impact-chantier/{ch_id}")
        assert r.status_code == 200
        imp = r.json()
        assert imp["budget_prevu"] == 10_000_000.0
        assert imp["achats_factures"] == 7_920_000.0
        assert imp["budget_restant"] == 2_080_000.0
        assert imp["taux_consommation"] == 79.2
        assert imp["depassement"] is False


@pytest.mark.asyncio
async def test_factures_en_retard(db_session):
    ent_id, _, four_id, _, ch_id = await _seed(db_session)
    client = await _client(db_session, ent_id)
    hier = (date.today() - timedelta(days=1)).isoformat()
    async with client:
        await client.post("/api/achats/factures", json={
            "fournisseur_id": four_id, "numero": "FAC-RET-1",
            "montant_ht": 100000, "taux_tva": 20, "date_echeance": hier,
        })
        await client.post("/api/achats/factures", json={
            "fournisseur_id": four_id, "numero": "FAC-OK-1",
            "montant_ht": 100000, "taux_tva": 20,
            "date_echeance": (date.today() + timedelta(days=30)).isoformat(),
        })
        r = await client.get("/api/achats/factures?en_retard=true")
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 1
        assert items[0]["numero"] == "FAC-RET-1"


@pytest.mark.asyncio
async def test_multi_tenant_403(db_session):
    """Une autre entreprise ne voit ni ne modifie les achats de la première."""
    ent_id, ent2_id, four_id, _, ch_id = await _seed(db_session)
    client = await _client(db_session, ent_id)
    async with client:
        r = await client.post("/api/achats/commandes", json={
            "fournisseur_id": four_id,
            "lignes": [{"designation": "X", "quantite": 1, "prix_unitaire": 1000}],
        })
        cmd_id = r.json()["id"]

    client2 = await _client(db_session, ent2_id)
    async with client2:
        # Le fournisseur appartient à ent1 → création refusée
        r = await client2.post("/api/achats/commandes", json={
            "fournisseur_id": four_id,
            "lignes": [{"designation": "X", "quantite": 1, "prix_unitaire": 1000}],
        })
        assert r.status_code == 404
        # Lecture et modification de la commande d'ent1 refusées
        r = await client2.get(f"/api/achats/commandes/{cmd_id}")
        assert r.status_code == 403
        r = await client2.get(f"/api/achats/impact-chantier/{ch_id}")
        assert r.status_code == 403


@pytest.mark.asyncio
async def test_validation_statut_et_mode_paiement(db_session):
    ent_id, _, four_id, _, _ = await _seed(db_session)
    client = await _client(db_session, ent_id)
    async with client:
        r = await client.post("/api/achats/commandes", json={
            "fournisseur_id": four_id,
            "lignes": [{"designation": "X", "quantite": 1, "prix_unitaire": 1000}],
        })
        cmd_id = r.json()["id"]
        # Statut inconnu
        r = await client.post(f"/api/achats/commandes/{cmd_id}/statut?statut=inconnu")
        assert r.status_code == 422
        # Mode de paiement inconnu
        r = await client.post("/api/achats/factures", json={
            "fournisseur_id": four_id, "numero": "FAC-VAL-1", "montant_ht": 10000, "taux_tva": 20,
        })
        fac_id = r.json()["id"]
        r = await client.post(f"/api/achats/factures/{fac_id}/paiements", json={
            "montant": 100, "mode_paiement": "paypal",
        })
        assert r.status_code == 422
