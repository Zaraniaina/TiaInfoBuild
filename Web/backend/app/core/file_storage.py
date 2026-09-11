"""Service de stockage de fichiers sur disque (UUID, validation, suppression)."""
from __future__ import annotations

import asyncio
import uuid
from pathlib import Path

from fastapi import UploadFile

UPLOAD_DIR: Path = Path(__file__).resolve().parent.parent / "uploads"
MAX_PHOTO_MB: int = 5
MAX_MANUEL_MB: int = 10
ALLOWED_PHOTO_EXT: set[str] = {".jpg", ".jpeg", ".png"}
ALLOWED_MANUEL_EXT: set[str] = {".pdf"}


def _ext(filename: str) -> str:
    return Path(filename).suffix.lower()


async def save_upload(file: UploadFile, folder: str, allowed_ext: set[str], max_mb: int) -> str:
    """Valide et sauvegarde un UploadFile sur disque. Retourne l'URL relative."""
    ext = _ext(file.filename or "")
    if ext not in allowed_ext:
        raise ValueError(f"Extension non autorisée : {ext}. Autorisées : {allowed_ext}")
    dest_dir = UPLOAD_DIR / folder
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = dest_dir / filename
    size = 0
    chunk_size = 64 * 1024
    while True:
        chunk = await asyncio.to_thread(file.file.read, chunk_size)
        if not chunk:
            break
        size += len(chunk)
        if size > max_mb * 1024 * 1024:
            if dest.exists():
                await asyncio.to_thread(dest.unlink)
            raise ValueError(f"Fichier trop volumineux (max {max_mb} Mo)")
        mode = "ab" if dest.exists() else "wb"

        def _write(d, c, m):
            with open(d, m) as f:
                f.write(c)

        await asyncio.to_thread(_write, dest, chunk, mode)
    return f"/api/uploads/{folder}/{filename}"


async def delete_upload(url: str) -> None:
    """Supprime un fichier à partir de son URL relative (/api/uploads/...)."""
    if not url.startswith("/api/uploads/"):
        return
    parts = url[len("/api/uploads/"):]
    path = UPLOAD_DIR / parts
    if path.exists():
        await asyncio.to_thread(path.unlink)