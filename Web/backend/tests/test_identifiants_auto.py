"""Tests des identifiants 100% automatiques (zéro saisie utilisateur).

Couvre :
- POST /stocks/articles sans `reference` → référence séquentielle ART-0001, ART-0002…
- POST /stocks/articles avec `reference` → valeur fournie respectée
- POST /stocks/depots sans `code` → code séquentiel DEP-0001, DEP-0002…
- POST /stocks/depots avec `code` → valeur fournie respectée
- Anti-collision : deux créations de suite ne produisent jamais le même code
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.database import get_db
from app.security import get_current_user
from app.models.entreprise import Entreprise

Payload = {"sub": "1", "role_code": "super_admin", "entreprise_id": 1}


async def _client(db_session) -> AsyncClient:
    ent = Entreprise(nom="TIA Test")
    db_session.add(ent)
    await db_session.flush()
    assert ent.id == 1

    async def _override_get_db():
        yield db_session

    async def _override_user():
        return Payload

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_user
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_article_reference_auto(db_session):
    client = await _client(db_session)
    async with client:
        r1 = await client.post("/api/stocks/articles", json={"nom": "Ciment 50kg"})
        r2 = await client.post("/api/stocks/articles", json={"nom": "Fer 12mm"})
    assert r1.status_code == 201, r1.text
    assert r2.status_code == 201, r2.text
    assert r1.json()["reference"] == "ART-0001"
    assert r2.json()["reference"] == "ART-0002"


@pytest.mark.asyncio
async def test_article_reference_fournie_respectee(db_session):
    client = await _client(db_session)
    async with client:
        r = await client.post(
            "/api/stocks/articles", json={"nom": "Sable", "reference": "SBL-SPEC-01"}
        )
    assert r.status_code == 201
    assert r.json()["reference"] == "SBL-SPEC-01"


@pytest.mark.asyncio
async def test_depot_code_auto(db_session):
    client = await _client(db_session)
    async with client:
        r1 = await client.post("/api/stocks/depots", json={"nom": "Dépôt Antaninarenina"})
        r2 = await client.post("/api/stocks/depots", json={"nom": "Dépôt Mahajanga"})
    assert r1.status_code == 201, r1.text
    assert r2.status_code == 201, r2.text
    assert r1.json()["code"] == "DEP-0001"
    assert r2.json()["code"] == "DEP-0002"


@pytest.mark.asyncio
async def test_depot_code_fourni_respecte(db_session):
    client = await _client(db_session)
    async with client:
        r = await client.post(
            "/api/stocks/depots", json={"nom": "Zone Vrac", "code": "ZV-01"}
        )
    assert r.status_code == 201
    assert r.json()["code"] == "ZV-01"
