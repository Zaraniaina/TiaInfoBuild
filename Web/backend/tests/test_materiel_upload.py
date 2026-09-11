"""Tests upload multipart photo/manuel matériel."""
from io import BytesIO
from pathlib import Path

from app.models.entreprise import Entreprise
from app.models.materiel import Materiel


def _png_bytes() -> bytes:
    """Mini PNG 1x1 valide."""
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02"
        b"\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01"
        b"\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _pdf_bytes() -> bytes:
    return b"%PDF-1.4\n%test\n%%EOF"


async def _setup(db_session):
    ent = Entreprise(nom="BTP Test")
    db_session.add(ent)
    await db_session.flush()
    mat = Materiel(entreprise_id=ent.id, nom="Pelleteuse", statut="actif")
    db_session.add(mat)
    await db_session.flush()
    return ent, mat


async def test_upload_photo_ok(db_session, client_factory):
    ent, mat = await _setup(db_session)
    async with await client_factory("materiel", entreprise_id=ent.id) as client:
        r = await client.post(
            f"/api/materiels/{mat.id}/upload-photo",
            files={"fichier": ("photo.png", _png_bytes(), "image/png")},
        )
        assert r.status_code == 200, r.text
        assert r.json()["photo_url"].startswith("/api/uploads/materiel-photos/")


async def test_upload_photo_extension_refusee(db_session, client_factory):
    ent, mat = await _setup(db_session)
    async with await client_factory("materiel", entreprise_id=ent.id) as client:
        r = await client.post(
            f"/api/materiels/{mat.id}/upload-photo",
            files={"fichier": ("photo.gif", _png_bytes(), "image/gif")},
        )
        assert r.status_code == 400


async def test_upload_manuel_ok(db_session, client_factory):
    ent, mat = await _setup(db_session)
    async with await client_factory("materiel", entreprise_id=ent.id) as client:
        r = await client.post(
            f"/api/materiels/{mat.id}/upload-manuel",
            files={"fichier": ("manuel.pdf", _pdf_bytes(), "application/pdf")},
        )
        assert r.status_code == 200, r.text
        assert r.json()["manuel_url"].startswith("/api/uploads/materiels-manuels/")


async def test_supprime_photo(db_session, client_factory):
    ent, mat = await _setup(db_session)
    async with await client_factory("materiel", entreprise_id=ent.id) as client:
        r = await client.post(
            f"/api/materiels/{mat.id}/upload-photo",
            files={"fichier": ("photo.png", _png_bytes(), "image/png")},
        )
        photo_url = r.json()["photo_url"]
        r = await client.delete(f"/api/materiels/{mat.id}/photo")
        assert r.status_code == 200 and r.json()["photo_url"] is None
        # Fichier disque supprimé
        path = Path("Web/backend") / photo_url[len("/api/"):]
        assert not path.exists()
