"""Router pour les préférences utilisateur (thème, langue, notifications)."""
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.core.permissions import PERMISSION_MAP
from app.database import get_db
from app.models.preference import Preference
from app.models.utilisateur import Utilisateur
from app.security import CurrentUserPayload, DbDep
from pydantic import BaseModel, Field
from sqlalchemy import select

router = APIRouter(tags=["preferences"])


class PreferenceUpdate(BaseModel):
    theme: str | None = Field(default=None, max_length=20)
    langue: str | None = Field(default=None, max_length=10)
    date_format: str | None = Field(default=None, max_length=20)
    devise: str | None = Field(default=None, max_length=10)
    notif_email: bool | None = None
    notif_push: bool | None = None
    notif_factures_retard: bool | None = None
    notif_stock_bas: bool | None = None


class PreferenceResponse(BaseModel):
    theme: str
    langue: str
    date_format: str
    devise: str
    notif_email: bool
    notif_push: bool
    notif_factures_retard: bool
    notif_stock_bas: bool

    model_config = {"from_attributes": True}


def _to_response(pref: Preference) -> PreferenceResponse:
    theme = pref.theme if pref.theme in ("light", "dark") else "light"
    return PreferenceResponse(
        theme=theme,
        langue=pref.langue or "fr",
        date_format=pref.date_format or "DD/MM/YYYY",
        devise=pref.devise or "MGA",
        notif_email=bool(pref.notif_email),
        notif_push=bool(pref.notif_push),
        notif_factures_retard=bool(pref.notif_factures_retard),
        notif_stock_bas=bool(pref.notif_stock_bas),
    )


@router.get("/me", response_model=PreferenceResponse)
async def get_my_preferences(payload: CurrentUserPayload, db: DbDep):
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User ID manquant")

    result = await db.execute(select(Preference).where(Preference.user_id == int(user_id)))
    pref = result.scalar_one_or_none()

    if not pref:
        pref = Preference(
            user_id=int(user_id),
            theme="light",
            langue="fr",
            date_format="DD/MM/YYYY",
            devise="MGA",
            notif_email=True,
            notif_push=True,
            notif_factures_retard=True,
            notif_stock_bas=True,
        )
        db.add(pref)
        await db.flush()
        await db.refresh(pref)

    return _to_response(pref)


@router.patch("/me", response_model=PreferenceResponse)
async def update_my_preferences(payload: CurrentUserPayload, db: DbDep, data: PreferenceUpdate):
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User ID manquant")

    result = await db.execute(select(Preference).where(Preference.user_id == int(user_id)))
    pref = result.scalar_one_or_none()

    if not pref:
        pref = Preference(user_id=int(user_id))
        db.add(pref)

    update_data = data.model_dump(exclude_unset=True)
    if "theme" in update_data:
        theme = update_data["theme"]
        if theme not in ("light", "dark"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Theme invalide")
        pref.theme = theme

    for field in ("langue", "date_format", "devise"):
        if field in update_data:
            setattr(pref, field, update_data[field])

    for field in ("notif_email", "notif_push", "notif_factures_retard", "notif_stock_bas"):
        if field in update_data:
            setattr(pref, field, update_data[field])

    await db.flush()
    await db.refresh(pref)
    return _to_response(pref)
