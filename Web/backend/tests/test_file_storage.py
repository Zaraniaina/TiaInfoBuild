"""Tests pour le module file_storage."""
import asyncio
from pathlib import Path

import pytest
from fastapi import UploadFile
from io import BytesIO
from app.core import file_storage


@pytest.fixture
def tmp_upload_dir(tmp_path, monkeypatch):
    """Redirige UPLOAD_DIR vers un répertoire temporaire."""
    monkeypatch.setattr(file_storage, "UPLOAD_DIR", tmp_path)
    return tmp_path


def _upload(filename: str, content: bytes = b"fake-content") -> UploadFile:
    return UploadFile(filename=filename, file=BytesIO(content))


@pytest.mark.asyncio
async def test_save_photo_valide(tmp_upload_dir):
    fichier = _upload("photo.jpg", b"x" * 100)
    url = await file_storage.save_upload(fichier, "photo", file_storage.ALLOWED_PHOTO_EXT, file_storage.MAX_PHOTO_MB)
    assert url.startswith("/api/uploads/photo/")
    assert url.endswith(".jpg")


@pytest.mark.asyncio
async def test_save_manuel_pdf(tmp_upload_dir):
    fichier = _upload("manuel.pdf", b"%PDF-1.4 fake")
    url = await file_storage.save_upload(fichier, "manuel", file_storage.ALLOWED_MANUEL_EXT, file_storage.MAX_MANUEL_MB)
    assert url.startswith("/api/uploads/manuel/") and url.endswith(".pdf")


@pytest.mark.asyncio
async def test_extension_refusee(tmp_upload_dir):
    with pytest.raises(ValueError):
        await file_storage.save_upload(_upload("virus.exe"), "photo", file_storage.ALLOWED_PHOTO_EXT, 5)


@pytest.mark.asyncio
async def test_fichier_trop_volumineux(tmp_upload_dir):
    fichier = _upload("gros.jpg", b"x" * 10)
    with pytest.raises(ValueError):
        await file_storage.save_upload(fichier, "photo", file_storage.ALLOWED_PHOTO_EXT, 0)  # 0 Mo → tout dépasse


@pytest.mark.asyncio
async def test_delete_upload(tmp_upload_dir):
    fichier = _upload("a.png", b"data")
    url = await file_storage.save_upload(fichier, "photo", file_storage.ALLOWED_PHOTO_EXT, 5)
    path = tmp_upload_dir / url[len("/api/uploads/"):]
    assert path.exists()
    await file_storage.delete_upload(url)
    assert not path.exists()