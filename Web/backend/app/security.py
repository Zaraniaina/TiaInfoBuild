"""Sécurité: JWT (access + refresh rotation), hachage Argon2, RBAC (FastAPI Expert)."""
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
import secrets
import string
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.config import settings
from app.database import get_db

# Hachage des mots de passe avec Argon2id (recommandé)
pwd_hash = PasswordHash.recommended()

# OAuth2 scheme pour l'extraction du Bearer token
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login",
    auto_error=False,
)

# Codes d'erreur HTTP — factory pour éviter la mutation d'une instance partagée
def credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


# --- Hachage mot de passe ---
def hash_password(password: str) -> str:
    return pwd_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_hash.verify(plain_password, hashed_password)
    except Exception:
        return False


def generate_temp_password(length: int = 12) -> str:
    """Génère un mot de passe temporaire robuste respectant la politique de sécurité."""
    if length < 8:
        length = 8
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*-_"
    while True:
        password = "".join(secrets.choice(alphabet) for _ in range(length))
        if (
            len(password) >= 8
            and any(c.isupper() for c in password)
            and any(c.islower() for c in password)
            and any(c.isdigit() for c in password)
            and any(c in "!@#$%^&*-_" for c in password)
        ):
            return password


# --- JWT Tokens ---
def _create_token(
    subject: str | int,
    token_type: str,
    expires_delta: timedelta,
    secret: str,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, secret, algorithm=settings.algorithm)


def create_access_token(
    subject: str | int,
    role_code: str | None = None,
    entreprise_id: int | None = None,
    permissions: list[str] | None = None,
) -> str:
    extra: dict[str, Any] = {}
    if role_code:
        extra["role_code"] = role_code
    if entreprise_id is not None:
        extra["entreprise_id"] = entreprise_id
    if permissions:
        extra["permissions"] = permissions
    return _create_token(
        subject,
        "access",
        timedelta(minutes=settings.access_token_expire_minutes),
        settings.secret_key,
        extra,
    )


def create_refresh_token(subject: str | int) -> str:
    return _create_token(
        subject,
        "refresh",
        timedelta(days=settings.refresh_token_expire_days),
        settings.secret_key_refresh,
    )


def decode_token(token: str, refresh: bool = False) -> dict[str, Any]:
    # Le secret diffère selon le type de token (accès vs rafraîchissement) :
    # un token d'accès ne doit jamais être accepté comme token de rafraîchissement.
    secret = settings.secret_key_refresh if refresh else settings.secret_key
    try:
        payload = jwt.decode(token, secret, algorithms=[settings.algorithm])
        # Vérification du "type" : empêche la réutilisation d'un token d'accès pour le refresh.
        if payload.get("type") != ("refresh" if refresh else "access"):
            raise credentials_exception()
        return payload
    except jwt.ExpiredSignatureError as exc:
        # Token expiré : le front déclenchera un refresh via l'intercepteur Axios (401).
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        ) from exc
    except jwt.PyJWTError as exc:
        # Signature invalide ou token corrompu : on refuse l'accès sans fuite d'information.
        raise credentials_exception() from exc


async def get_current_user_payload(
    token: Annotated[str | None, Depends(oauth2_scheme)],
) -> dict[str, Any]:
    if not token:
        raise credentials_exception()
    return decode_token(token)


async def get_current_user(
    payload: Annotated[dict[str, Any], Depends(get_current_user_payload)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    """Retourne le payload utilisateur courant (sub, role_code, entreprise_id)."""
    from app.models.utilisateur import Utilisateur

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exception()

    try:
        user_id_int = int(user_id)
    except (ValueError, TypeError):
        raise credentials_exception()

    result = await db.execute(
        select(Utilisateur).where(
            Utilisateur.id == user_id_int,
            Utilisateur.is_deleted == False,
        )
    )
    user = result.scalar_one_or_none()
    if not user or user.statut == "inactif":
        raise credentials_exception()

    payload["user"] = user
    return payload


# Dépendances typées
CurrentUserPayload = Annotated[dict[str, Any], Depends(get_current_user)]
DbDep = Annotated[AsyncSession, Depends(get_db)]


def require_super_admin(
    payload: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    """Exige le rôle super_admin (propriétaire SaaS)."""
    if payload.get("role_code") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin privileges required",
        )
    return payload


SuperAdminDep = Annotated[dict[str, Any], Depends(require_super_admin)]
