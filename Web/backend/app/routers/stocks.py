"""Router pour la gestion des stocks, articles, fournisseurs, dépôts et mouvements."""
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func

from app.database import get_db
from app.security import CurrentUserPayload, DbDep
from app.crud.article import ArticleCRUD
from app.crud.fournisseur import FournisseurCRUD
from app.crud.mouvement_stock import MouvementStockCRUD
from app.crud.depot import DepotCRUD
from app.core.numerotation import generate_code
from app.crud.base import BaseCRUD
from app.models.article import Article
from app.models.fournisseur import Fournisseur
from app.models.mouvement_stock import MouvementStock
from app.models.depot import Depot
from app.schemas.article import (
    ArticleCreate,
    ArticleUpdate,
    ArticleResponse,
    ArticleList,
    StockAdjustmentRequest,
)
from app.schemas.fournisseur import (
    FournisseurCreate,
    FournisseurUpdate,
    FournisseurResponse,
    FournisseurList,
)
from app.schemas.mouvement_stock import (
    MouvementStockCreate,
    MouvementStockResponse,
    MouvementStockList,
)
from app.schemas.depot import (
    DepotCreate,
    DepotUpdate,
    DepotResponse,
    DepotList,
)

_permission_map = None


def _get_permission_map():
    global _permission_map
    if _permission_map is None:
        from app.core.permissions import PERMISSION_MAP
        _permission_map = PERMISSION_MAP
    return _permission_map


def _require_permission(payload: CurrentUserPayload, permission: str) -> None:
    role_code = payload.get("role_code")
    perm_map = _get_permission_map()
    permissions = perm_map.get(role_code, [])
    if "*" not in permissions and permission not in permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{permission}' requise",
        )


router = APIRouter()


# --- Articles ---

@router.get("/articles", response_model=dict)
async def list_articles(
    payload: CurrentUserPayload,
    db: DbDep,
    search: str | None = Query(default=None, description="Recherche par nom ou référence"),
    categorie: str | None = Query(default=None),
    fournisseur_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
):
    _require_permission(payload, "stocks:read")
    entreprise_id = payload.get("entreprise_id")
    crud = ArticleCRUD()
    skip = (page - 1) * size

    query = select(Article).where(Article.is_deleted == False)
    if entreprise_id is not None:
        query = query.where(Article.entreprise_id == entreprise_id)
    if search:
        query = query.where(
            (Article.nom.ilike(f"%{search}%")) | (Article.reference.ilike(f"%{search}%"))
        )
    if categorie:
        query = query.where(Article.categorie == categorie)
    if fournisseur_id:
        query = query.where(Article.fournisseur_id == fournisseur_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one() or 0

    result = await db.execute(query.offset(skip).limit(size))
    items = result.scalars().all()

    return {
        "items": [ArticleList.model_validate(item) for item in items],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/articles", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    payload: CurrentUserPayload,
    obj_in: ArticleCreate,
    db: DbDep,
):
    _require_permission(payload, "stocks:write")
    entreprise_id = payload.get("entreprise_id")
    data = obj_in.model_dump(exclude_unset=True)
    if entreprise_id is not None and not data.get("entreprise_id"):
        data["entreprise_id"] = entreprise_id
    # Référence auto si absente (séquentielle, zéro saisie)
    if not data.get("reference"):
        data["reference"] = await generate_code(db, Article, "reference", "ART")
    crud = ArticleCRUD()
    article = await crud.create(db, data)
    await db.refresh(article)
    return ArticleResponse.model_validate(article)


@router.put("/articles/{id}", response_model=ArticleResponse)
async def update_article(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    obj_in: ArticleUpdate,
):
    _require_permission(payload, "stocks:write")
    entreprise_id = payload.get("entreprise_id")
    crud = ArticleCRUD()
    article = await crud.get(db, id)
    if not article or article.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article non trouvé")
    if entreprise_id is not None and article.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    data = obj_in.model_dump(exclude_unset=True)
    updated = await crud.update(db, article, data)
    await db.refresh(updated)
    return ArticleResponse.model_validate(updated)


@router.put("/articles/{id}/stock", response_model=ArticleResponse)
async def adjust_stock(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    obj_in: StockAdjustmentRequest,
):
    _require_permission(payload, "stocks:write")
    entreprise_id = payload.get("entreprise_id")
    crud = ArticleCRUD()
    article = await crud.get(db, id)
    if not article or article.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article non trouvé")
    if entreprise_id is not None and article.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    if obj_in.type_mouvement == "sortie" and article.stock_actuel < obj_in.quantite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stock insuffisant pour cette sortie",
        )

    article.stock_actuel = float(article.stock_actuel or 0)
    if obj_in.type_mouvement in ("entree", "inventaire", "ajustement"):
        article.stock_actuel += obj_in.quantite
    else:
        article.stock_actuel -= obj_in.quantite

    mouvement = MouvementStock(
        entreprise_id=entreprise_id or 0,
        article_id=id,
        type_mouvement=obj_in.type_mouvement,
        quantite=obj_in.quantite,
        prix_unitaire=obj_in.prix_unitaire or 0,
        chantier_id=obj_in.chantier_id,
        fournisseur_id=obj_in.fournisseur_id,
        reference=obj_in.reference,
        notes=obj_in.notes,
    )
    db.add(mouvement)
    await db.flush()
    await db.refresh(article)
    return ArticleResponse.model_validate(article)


@router.get("/articles/en-alerte", response_model=list[ArticleResponse])
async def articles_en_alerte(
    payload: CurrentUserPayload,
    db: DbDep,
):
    _require_permission(payload, "stocks:read")
    entreprise_id = payload.get("entreprise_id")
    if entreprise_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Entreprise requise")

    crud = ArticleCRUD()
    items = await crud.get_en_alerte(db, entreprise_id)
    return [ArticleResponse.model_validate(item) for item in items]


# --- Fournisseurs ---

@router.get("/fournisseurs", response_model=dict)
async def list_fournisseurs(
    payload: CurrentUserPayload,
    db: DbDep,
    search: str | None = Query(default=None, description="Recherche par nom"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
):
    _require_permission(payload, "stocks:read")
    entreprise_id = payload.get("entreprise_id")
    crud = FournisseurCRUD()
    skip = (page - 1) * size

    query = select(Fournisseur).where(Fournisseur.is_deleted == False)
    if entreprise_id is not None:
        query = query.where(Fournisseur.entreprise_id == entreprise_id)
    if search:
        query = query.where(Fournisseur.nom.ilike(f"%{search}%"))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one() or 0

    result = await db.execute(query.offset(skip).limit(size))
    items = result.scalars().all()

    return {
        "items": [FournisseurList.model_validate(item) for item in items],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/fournisseurs", response_model=FournisseurResponse, status_code=status.HTTP_201_CREATED)
async def create_fournisseur(
    payload: CurrentUserPayload,
    obj_in: FournisseurCreate,
    db: DbDep,
):
    _require_permission(payload, "stocks:write")
    entreprise_id = payload.get("entreprise_id")
    data = obj_in.model_dump(exclude_unset=True)
    if entreprise_id is not None and not data.get("entreprise_id"):
        data["entreprise_id"] = entreprise_id
    crud = FournisseurCRUD()
    fournisseur = await crud.create(db, data)
    await db.refresh(fournisseur)
    return FournisseurResponse.model_validate(fournisseur)


@router.put("/fournisseurs/{id}", response_model=FournisseurResponse)
async def update_fournisseur(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    obj_in: FournisseurUpdate,
):
    _require_permission(payload, "stocks:write")
    entreprise_id = payload.get("entreprise_id")
    crud = FournisseurCRUD()
    fournisseur = await crud.get(db, id)
    if not fournisseur or fournisseur.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fournisseur non trouvé")
    if entreprise_id is not None and fournisseur.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    data = obj_in.model_dump(exclude_unset=True)
    updated = await crud.update(db, fournisseur, data)
    await db.refresh(updated)
    return FournisseurResponse.model_validate(updated)


# --- Mouvements de stock ---

@router.get("/mouvements", response_model=dict)
async def list_mouvements(
    payload: CurrentUserPayload,
    db: DbDep,
    article_id: int | None = Query(default=None),
    date_debut: date | None = Query(default=None),
    date_fin: date | None = Query(default=None),
    type_mouvement: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
):
    _require_permission(payload, "stocks:read")
    entreprise_id = payload.get("entreprise_id")
    crud = MouvementStockCRUD()
    skip = (page - 1) * size

    query = select(MouvementStock).where(MouvementStock.is_deleted == False)
    if entreprise_id is not None:
        query = query.where(MouvementStock.entreprise_id == entreprise_id)
    if article_id:
        query = query.where(MouvementStock.article_id == article_id)
    if date_debut:
        query = query.where(MouvementStock.date_mouvement >= date_debut)
    if date_fin:
        query = query.where(MouvementStock.date_mouvement <= date_fin)
    if type_mouvement:
        query = query.where(MouvementStock.type_mouvement == type_mouvement)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one() or 0

    result = await db.execute(query.offset(skip).limit(size))
    items = result.scalars().all()

    return {
        "items": [MouvementStockList.model_validate(item) for item in items],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/mouvements", response_model=MouvementStockResponse, status_code=status.HTTP_201_CREATED)
async def create_mouvement(
    payload: CurrentUserPayload,
    obj_in: MouvementStockCreate,
    db: DbDep,
):
    _require_permission(payload, "stocks:write")
    entreprise_id = payload.get("entreprise_id")
    data = obj_in.model_dump(exclude_unset=True)
    if entreprise_id is not None and not data.get("entreprise_id"):
        data["entreprise_id"] = entreprise_id
    crud = MouvementStockCRUD()
    mouvement = await crud.create(db, data)
    await db.refresh(mouvement)
    return MouvementStockResponse.model_validate(mouvement)


# --- Dépôts BTP ---

@router.get("/depots", response_model=dict)
async def list_depots(
    payload: CurrentUserPayload,
    db: DbDep,
    search: str | None = Query(default=None, description="Recherche par nom ou code"),
    type: str | None = Query(default=None, description="Filtrer par type de dépôt"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=200),
):
    """Lister tous les dépôts actifs de l'entreprise."""
    _require_permission(payload, "stocks:read")
    entreprise_id = payload.get("entreprise_id")
    skip = (page - 1) * size

    query = select(Depot).where(Depot.is_deleted == False)
    if entreprise_id is not None:
        query = query.where(Depot.entreprise_id == entreprise_id)
    if search:
        query = query.where(
            (Depot.nom.ilike(f"%{search}%")) | (Depot.code.ilike(f"%{search}%"))
        )
    if type:
        query = query.where(Depot.type == type)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one() or 0

    result = await db.execute(query.offset(skip).limit(size))
    items = result.scalars().all()

    return {
        "items": [DepotList.model_validate(item) for item in items],
        "total": total,
        "page": page,
        "size": size,
    }


@router.get("/depots/{id}", response_model=DepotResponse)
async def get_depot(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    """Détail d'un dépôt."""
    _require_permission(payload, "stocks:read")
    entreprise_id = payload.get("entreprise_id")
    crud = DepotCRUD()
    depot = await crud.get(db, id)
    if not depot or depot.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dépôt non trouvé")
    if entreprise_id is not None and depot.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
    return DepotResponse.model_validate(depot)


@router.post("/depots", response_model=DepotResponse, status_code=status.HTTP_201_CREATED)
async def create_depot(
    payload: CurrentUserPayload,
    obj_in: DepotCreate,
    db: DbDep,
):
    """Créer un nouveau dépôt / zone de stockage BTP."""
    _require_permission(payload, "stocks:write")
    entreprise_id = payload.get("entreprise_id")
    data = obj_in.model_dump(exclude_unset=True)
    if entreprise_id is not None and not data.get("entreprise_id"):
        data["entreprise_id"] = entreprise_id
    # Génération auto du code si absent (séquentiel, zéro saisie)
    if not data.get("code"):
        data["code"] = await generate_code(db, Depot, "code", "DEP")
    crud = DepotCRUD()
    depot = await crud.create(db, data)
    await db.refresh(depot)
    return DepotResponse.model_validate(depot)


@router.put("/depots/{id}", response_model=DepotResponse)
async def update_depot(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    obj_in: DepotUpdate,
):
    """Mettre à jour un dépôt existant."""
    _require_permission(payload, "stocks:write")
    entreprise_id = payload.get("entreprise_id")
    crud = DepotCRUD()
    depot = await crud.get(db, id)
    if not depot or depot.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dépôt non trouvé")
    if entreprise_id is not None and depot.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    data = obj_in.model_dump(exclude_unset=True)
    updated = await crud.update(db, depot, data)
    await db.refresh(updated)
    return DepotResponse.model_validate(updated)


@router.delete("/depots/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_depot(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    """Supprimer (soft-delete) un dépôt. Les articles liés conservent leur emplacement textuel."""
    _require_permission(payload, "stocks:write")
    entreprise_id = payload.get("entreprise_id")
    crud = DepotCRUD()
    depot = await crud.get(db, id)
    if not depot or depot.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dépôt non trouvé")
    if entreprise_id is not None and depot.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    depot.is_deleted = True
    await db.flush()
