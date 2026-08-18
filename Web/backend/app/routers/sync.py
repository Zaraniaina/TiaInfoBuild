"""Router pour la synchronisation et l'import."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.database import get_db
from app.dependencies.auth import get_current_active_user

router = APIRouter(prefix="/sync", tags=["sync"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_active_user)]


@router.post("/import-sqlite")
async def import_sqlite(payload: CurrentUser):
    return JSONResponse(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        content={"detail": "Import SQLite non implémenté dans cette version"},
    )
