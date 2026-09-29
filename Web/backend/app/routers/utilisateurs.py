"""Router pour la gestion des utilisateurs de l'entreprise."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.database import get_db
from app.security import get_current_user
from app.dependencies.auth import get_current_active_user
from app.dependencies.permissions import require_permission, require_any_permission
from app.crud.utilisateur import UtilisateurCRUD
from app.security import hash_password, generate_temp_password
from app.models.utilisateur import Utilisateur
from app.models.role import Role
from app.schemas.utilisateur import UtilisateurCreate, UtilisateurUpdate, UtilisateurResponse, UtilisateurList, UtilisateurRoleUpdate

# Anciennement codé en dur à 2 ; on résout désormais l'id réel du rôle admin_entreprise
# depuis la base pour ne pas dépendre de l'ordre d'insertion des rôles.
MAX_ADMIN_ENTREPRISE = 2


# IMPORTANT : ces alias doivent etre definis AVANT leur premiere utilisation dans
# une signature de fonction. Python < 3.14 evalue les annotations des fonctions
# immediatement au moment du "def" : un alias utilise avant sa definition leve
# "NameError: name 'DbSession' is not defined" (Python 3.14+ masque ce bug via
# l'evaluation paresseuse des annotations, PEP 649).
router = APIRouter(tags=["utilisateurs"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_active_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]
AdminCheck = Annotated[dict[str, Any], Depends(require_permission("parametres:write"))]
# Le "bon de création" est utile aux deux populations qui manipulent des comptes :
# l'admin d'entreprise (parametres:write) et le commercial qui crée les fiches
# clients (commercial:write). Élargissement non restrictif : aucune permission
# existante n'est retirée.
AdminOrCommercialCheck = Annotated[
    dict[str, Any],
    Depends(require_any_permission("parametres:write", "commercial:write")),
]


async def _resolve_admin_role_id(db: DbSession) -> int | None:
    """Retourne l'id réel du rôle admin_entreprise (ou None s'il n'existe pas encore)."""
    # On utilise le code littéral "admin_entreprise" : l'import `Role` ici est le modèle SQL,
    # pas l'énuméré de core.permissions.
    result = await db.execute(select(Role.id).where(Role.code == "admin_entreprise"))
    return result.scalar_one_or_none()


@router.get("", response_model=dict)
@router.get("/", response_model=dict)
async def list_utilisateurs(
    payload: AdminCheck,
    db: DbSession,
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
):
    entreprise_id = payload.get("entreprise_id")
    crud = UtilisateurCRUD()
    query = select(Utilisateur).where(Utilisateur.is_deleted == False)
    if entreprise_id is not None:
        query = query.where(Utilisateur.entreprise_id == entreprise_id)
    if search:
        query = query.where((Utilisateur.nom.ilike(f"%{search}%")) | (Utilisateur.email.ilike(f"%{search}%")))
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one() or 0
    result = await db.execute(query.offset((page - 1) * size).limit(size))
    items = result.scalars().all()
    return {
        "items": [UtilisateurList.model_validate(item) for item in items],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("", response_model=UtilisateurResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=UtilisateurResponse, status_code=status.HTTP_201_CREATED)
async def create_utilisateur(payload: AdminCheck, db: DbSession, data: UtilisateurCreate):
    entreprise_id = payload.get("entreprise_id")
    creator_role = payload.get("role_code")
    existing = await db.execute(
        select(Utilisateur).where(
            Utilisateur.email == data.email,
            Utilisateur.is_deleted == False,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un utilisateur avec cet email existe déjà",
        )
    obj_in = data.model_dump(exclude={"password"})
    if entreprise_id is not None and not obj_in.get("entreprise_id"):
        obj_in["entreprise_id"] = entreprise_id
    from app.security import hash_password
    obj_in["mot_de_passe_hash"] = hash_password(data.password)
    obj_in["must_change_password"] = True  # L'utilisateur doit modifier son mot de passe après la 1ère connexion
    if obj_in.get("role_code"):
        if obj_in["role_code"] == "super_admin" and creator_role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous ne pouvez pas créer un utilisateur avec le rôle Super Administrateur.",
            )
        role_result = await db.execute(select(Role).where(Role.code == obj_in["role_code"]))
        role = role_result.scalar_one_or_none()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rôle invalide: {obj_in['role_code']}",
            )
        obj_in["role_id"] = role.id
        del obj_in["role_code"]
    # Limite du nombre d'administrateurs par entreprise (id du rôle résolu dynamiquement)
    admin_role_id = await _resolve_admin_role_id(db)
    if admin_role_id is not None and obj_in.get("role_id") == admin_role_id and entreprise_id is not None:
        count_query = select(func.count()).select_from(Utilisateur).where(
            Utilisateur.entreprise_id == entreprise_id,
            Utilisateur.role_id == admin_role_id,
            Utilisateur.is_deleted == False,
        )
        current_count = (await db.execute(count_query)).scalar_one() or 0
        if current_count >= MAX_ADMIN_ENTREPRISE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Limite atteinte : maximum {MAX_ADMIN_ENTREPRISE} administrateurs par entreprise.",
            )
    user = Utilisateur(**obj_in)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.get("/{id}/bon-de-creation", response_class=Response)
@router.get("/{id}/bon-de-creation/", response_class=Response)
async def get_bon_creation(payload: AdminOrCommercialCheck, db: DbSession, id: int, temp_password: str | None = Query(default=None), login_url: str | None = Query(default=None)):
    """Génère un PDF 'Bon de création' contenant le login, le rôle de l'utilisateur,
    les rôles de l'entreprise et le mot de passe temporaire défini par l'administrateur.

    Ne réinitialise pas le mot de passe en base si le mot de passe initial à la création est transmis.
    """
    entreprise_id = payload.get("entreprise_id")
    result = await db.execute(
        select(Utilisateur).where(Utilisateur.id == id, Utilisateur.is_deleted == False)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    if entreprise_id is not None and user.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    pwd_display = temp_password if temp_password else "•••••••• (Défini lors de la création)"

    roles_result = await db.execute(select(Role).order_by(Role.id))
    entreprise_roles = [r for r in roles_result.scalars().all() if getattr(r, "code", None) != "super_admin"]

    pdf_bytes = _render_bon_creation_pdf(
        user=user,
        entreprise=user.entreprise,
        entreprise_roles=entreprise_roles,
        temp_password=pwd_display,
        login_url=login_url,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="bon-creation-{user.id}.pdf"'},
    )


def _render_bon_creation_pdf(user, entreprise, entreprise_roles, temp_password: str, login_url: str | None = None) -> bytes:
    """Rend le bon de création au format PDF avec fpdf2 (zéro dépendance lourde)."""
    from fpdf import FPDF

    login = user.email or ""
    entreprise_nom = (entreprise.nom if entreprise else "") or "—"
    role_nom = (user.role.nom if user.role else "") or "—"
    role_code = (user.role.code if user.role else "") or "—"
    nom_complet = f"{user.prenom or ''} {user.nom or ''}".strip() or "-"
    date_str = (user.date_creation or "").strftime("%d/%m/%Y %H:%M") if hasattr(user.date_creation, "strftime") else str(user.date_creation or "")

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.set_font("Helvetica", "", 10)

    pdf.set_fill_color(16, 26, 48)
    pdf.set_draw_color(16, 26, 48)
    pdf.set_line_width(1.5)
    pdf.rect(10, 8, 190, 18, style="F")
    pdf.set_xy(10, 11)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 7, "Bon de Creation de Compte", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, "Plateforme TIA INFO BUILD", new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.set_text_color(16, 26, 48)
    pdf.ln(14)
    pdf.set_draw_color(200, 200, 200)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(8)

    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(40, 40, 40)
    pdf.cell(0, 7, "Identifiants de connexion", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(20, 20, 20)

    def row(label: str, value: str):
        pdf.set_x(15)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(20, 20, 20)
        pdf.cell(50, 6, label, new_x="RIGHT", new_y="TOP")
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(30, 30, 30)
        pdf.multi_cell(0, 6, value)

    row("Nom & Prenom :", nom_complet)
    row("Login / Email :", login)
    row("Role :", f"{role_nom} ({role_code})")
    row("Entreprise :", entreprise_nom)
    row("Date creation :", date_str)

    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(170, 38, 46)
    pdf.cell(0, 7, "Mot de passe temporaire", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Courier", "", 14)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 9, temp_password, new_x="LMARGIN", new_y="NEXT", border=1, align="CENTER")
    pdf.ln(2)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 5, "Ce mot de passe expire a la premiere connexion. Pensez a le modifier.", new_x="LMARGIN", new_y="NEXT", align="C")

    if login_url:
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(16, 26, 48)
        pdf.cell(0, 7, "Lien de connexion", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(0, 0, 128)
        pdf.multi_cell(0, 6, login_url)

    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(140, 140, 140)
    pdf.cell(0, 5, "Document genere automatiquement par TIA INFO BUILD - Diffusion interdite.", new_x="LMARGIN", new_y="NEXT", align="C")

    return bytes(pdf.output())


@router.get("/{id}", response_model=UtilisateurResponse)
async def get_utilisateur(payload: AdminCheck, db: DbSession, id: int):
    entreprise_id = payload.get("entreprise_id")
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == id, Utilisateur.is_deleted == False))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    if entreprise_id is not None and user.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
    return user


@router.put("/{id}", response_model=UtilisateurResponse)
async def update_utilisateur(payload: AdminCheck, db: DbSession, id: int, data: UtilisateurUpdate):
    entreprise_id = payload.get("entreprise_id")
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == id, Utilisateur.is_deleted == False))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    if entreprise_id is not None and user.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
    obj_in = data.model_dump(exclude_unset=True)
    if "email" in obj_in and obj_in["email"] != user.email:
        existing = await db.execute(
            select(Utilisateur).where(
                Utilisateur.email == obj_in["email"],
                Utilisateur.id != id,
                Utilisateur.is_deleted == False,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Un utilisateur avec cet email existe déjà",
            )
    if obj_in.get("role_code"):
        role_result = await db.execute(select(Role).where(Role.code == obj_in["role_code"]))
        role = role_result.scalar_one_or_none()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rôle invalide: {obj_in['role_code']}",
            )
        obj_in["role_id"] = role.id
        del obj_in["role_code"]
    for field, value in obj_in.items():
        setattr(user, field, value)
    await db.flush()
    await db.refresh(user)
    return user


@router.put("/{id}/role", response_model=UtilisateurResponse)
async def update_utilisateur_role(payload: AdminCheck, db: DbSession, id: int, data: UtilisateurRoleUpdate):
    entreprise_id = payload.get("entreprise_id")
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == id, Utilisateur.is_deleted == False))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    # Limite du nombre d'administrateurs par entreprise (id du rôle résolu dynamiquement)
    admin_role_id = await _resolve_admin_role_id(db)
    if admin_role_id is not None and data.role_id == admin_role_id and entreprise_id is not None and user.role_id != admin_role_id:
        count_query = select(func.count()).select_from(Utilisateur).where(
            Utilisateur.entreprise_id == entreprise_id,
            Utilisateur.role_id == admin_role_id,
            Utilisateur.is_deleted == False,
        )
        current_count = (await db.execute(count_query)).scalar_one() or 0
        if current_count >= MAX_ADMIN_ENTREPRISE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Limite atteinte : maximum {MAX_ADMIN_ENTREPRISE} administrateurs par entreprise.",
            )
    user.role_id = data.role_id
    await db.flush()
    await db.refresh(user)
    return user


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_utilisateur(payload: AdminCheck, db: DbSession, id: int):
    entreprise_id = payload.get("entreprise_id")
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == id, Utilisateur.is_deleted == False))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    if entreprise_id is not None and user.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
    user.is_deleted = True
    await db.flush()
    return None


@router.post("/{id}/toggle-actif", response_model=dict)
async def toggle_utilisateur_actif(payload: AdminCheck, db: DbSession, id: int):
    entreprise_id = payload.get("entreprise_id")
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == id, Utilisateur.is_deleted == False))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    if entreprise_id is not None and user.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
    user.statut = "inactif" if user.statut == "actif" else "actif"
    await db.flush()
    await db.refresh(user)
    return {"statut": user.statut}
