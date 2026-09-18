"""Router Achats fournisseurs : commande → réception (→ stock) → facture → paiement.

Multi-tenant strict (entreprise_id du JWT), permissions `stocks:*`.
La réception génère les MouvementStock 'entree' et met à jour article.stock_actuel.
"""
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func

from app.database import get_db
from app.security import CurrentUserPayload, DbDep
from app.core.permissions import PERMISSION_MAP
from app.core.numerotation import generate_numero
from app.models.article import Article
from app.models.chantier import Chantier
from app.models.depot import Depot
from app.models.fournisseur import Fournisseur
from app.models.mouvement_stock import MouvementStock
from app.models.achats import (
    CommandeFournisseur,
    LigneCommandeFournisseur,
    ReceptionFournisseur,
    LigneReceptionFournisseur,
    FactureFournisseur,
    PaiementFournisseur,
)

router = APIRouter()

STATUTS_COMMANDE = {"brouillon", "envoyee", "confirmee", "partiellement_recue", "recue", "annulee"}
STATUTS_FACTURE = {"a_payer", "partiellement_payee", "payee", "litige", "annulee"}
MODES_PAIEMENT = {"virement", "especes", "cheque", "mvola", "orange_money", "airtel_money"}


def _require_permission(payload: CurrentUserPayload, permission: str) -> None:
    role_code = payload.get("role_code")
    permissions = PERMISSION_MAP.get(role_code, [])
    if "*" not in permissions and permission not in permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{permission}' requise",
        )


def _entreprise(payload: CurrentUserPayload) -> int:
    eid = payload.get("entreprise_id")
    if eid is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise requise")
    return eid


def _d(v) -> float:
    return float(v or 0)


# ============================================================
# Schémas
# ============================================================

class LigneCommandeIn(BaseModel):
    article_id: int | None = None
    designation: str = Field(..., min_length=1, max_length=255)
    quantite: float = Field(..., gt=0)
    prix_unitaire: float = Field(default=0, ge=0)


class LigneCommandeUpdate(BaseModel):
    article_id: int | None = None
    designation: str | None = Field(default=None, min_length=1, max_length=255)
    quantite: float | None = Field(default=None, gt=0)
    prix_unitaire: float | None = Field(default=None, ge=0)


class CommandeCreate(BaseModel):
    fournisseur_id: int
    chantier_id: int | None = None
    date_commande: date | None = None
    date_livraison_prevue: date | None = None
    taux_tva: float = Field(default=20.0, ge=0, le=100)
    notes: str | None = None
    lignes: list[LigneCommandeIn] = Field(..., min_length=1)

    @field_validator("lignes")
    @classmethod
    def validate_lignes(cls, v):
        if not v:
            raise ValueError("Au moins une ligne est requise")
        return v


class CommandeUpdate(BaseModel):
    date_livraison_prevue: date | None = None
    taux_tva: float | None = Field(default=None, ge=0, le=100)
    notes: str | None = None
    statut: str | None = None
    lignes: list[LigneCommandeUpdate] | None = None

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v):
        if v is not None and v not in STATUTS_COMMANDE:
            raise ValueError(f"Statut invalide. Valeurs autorisées: {sorted(STATUTS_COMMANDE)}")
        return v


class LigneReceptionIn(BaseModel):
    ligne_commande_id: int
    quantite_recue: float = Field(..., gt=0)
    conforme: bool = True
    notes: str | None = None


class ReceptionCreate(BaseModel):
    date_reception: date | None = None
    depot_id: int | None = None
    chantier_id: int | None = None
    notes: str | None = None
    lignes: list[LigneReceptionIn] = Field(..., min_length=1)


class FactureCreate(BaseModel):
    fournisseur_id: int
    commande_id: int | None = None
    chantier_id: int | None = None
    numero: str = Field(..., min_length=1, max_length=100)
    date_facture: date | None = None
    date_echeance: date | None = None
    taux_tva: float = Field(default=20.0, ge=0, le=100)
    montant_ht: float = Field(default=0, ge=0)
    notes: str | None = None


class FactureUpdate(BaseModel):
    statut: str | None = None
    date_echeance: date | None = None
    notes: str | None = None

    @field_validator("statut")
    @classmethod
    def validate_statut(cls, v):
        if v is not None and v not in STATUTS_FACTURE:
            raise ValueError(f"Statut invalide. Valeurs autorisées: {sorted(STATUTS_FACTURE)}")
        return v


class PaiementCreate(BaseModel):
    montant: float = Field(..., gt=0)
    date_paiement: date | None = None
    mode_paiement: str = "virement"
    reference: str | None = Field(default=None, max_length=100)
    notes: str | None = None

    @field_validator("mode_paiement")
    @classmethod
    def validate_mode(cls, v):
        if v not in MODES_PAIEMENT:
            raise ValueError(f"Mode de paiement invalide. Valeurs autorisées: {sorted(MODES_PAIEMENT)}")
        return v


# ============================================================
# Helpers internes
# ============================================================

async def _get_commande(db, commande_id: int, entreprise_id: int) -> CommandeFournisseur:
    result = await db.execute(
        select(CommandeFournisseur).where(
            CommandeFournisseur.id == commande_id,
            CommandeFournisseur.is_deleted == False,
        )
    )
    cmd = result.scalar_one_or_none()
    if not cmd:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commande non trouvée")
    if cmd.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
    return cmd


async def _recalculer_commande(db, cmd: CommandeFournisseur) -> None:
    result = await db.execute(
        select(LigneCommandeFournisseur).where(LigneCommandeFournisseur.commande_id == cmd.id)
    )
    lignes = result.scalars().all()
    ht = sum(_d(l.quantite) * _d(l.prix_unitaire) for l in lignes)
    cmd.montant_ht = round(ht, 2)
    cmd.montant_tva = round(ht * _d(cmd.taux_tva) / 100, 2)
    cmd.montant_ttc = round(ht + cmd.montant_tva, 2)


def _commande_dict(cmd: CommandeFournisseur) -> dict:
    return {
        c.name: getattr(cmd, c.name) for c in cmd.__table__.columns
    } | {
        "fournisseur_nom": cmd.fournisseur.nom if cmd.fournisseur else None,
        "chantier_nom": cmd.chantier.nom if cmd.chantier else None,
        "lignes": [
            {c.name: getattr(l, c.name) for c in l.__table__.columns}
            for l in cmd.lignes
        ],
    }


# ============================================================
# Commandes fournisseurs
# ============================================================

@router.get("/commandes")
async def list_commandes(
    payload: CurrentUserPayload,
    db: DbDep,
    statut: str | None = Query(default=None),
    fournisseur_id: int | None = Query(default=None),
    chantier_id: int | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
):
    _require_permission(payload, "stocks:read")
    entreprise_id = _entreprise(payload)
    query = select(CommandeFournisseur).where(CommandeFournisseur.is_deleted == False)
    if entreprise_id is not None:
        query = query.where(CommandeFournisseur.entreprise_id == entreprise_id)
    if statut:
        query = query.where(CommandeFournisseur.statut == statut)
    if fournisseur_id:
        query = query.where(CommandeFournisseur.fournisseur_id == fournisseur_id)
    if chantier_id:
        query = query.where(CommandeFournisseur.chantier_id == chantier_id)
    if search:
        query = query.where(CommandeFournisseur.numero.ilike(f"%{search}%"))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one() or 0

    result = await db.execute(
        query.order_by(CommandeFournisseur.id.desc()).offset((page - 1) * size).limit(size)
    )
    items = [_commande_dict(c) for c in result.scalars().all()]
    return {"items": items, "total": total, "page": page, "size": size}


@router.get("/commandes/{id}")
async def get_commande(payload: CurrentUserPayload, db: DbDep, id: int):
    _require_permission(payload, "stocks:read")
    entreprise_id = _entreprise(payload)
    cmd = await _get_commande(db, id, entreprise_id)
    return _commande_dict(cmd)


@router.post("/commandes", status_code=status.HTTP_201_CREATED)
async def create_commande(payload: CurrentUserPayload, db: DbDep, obj_in: CommandeCreate):
    _require_permission(payload, "stocks:write")
    entreprise_id = _entreprise(payload)
    user = payload.get("user")

    result = await db.execute(
        select(Fournisseur).where(Fournisseur.id == obj_in.fournisseur_id, Fournisseur.is_deleted == False)
    )
    fournisseur = result.scalar_one_or_none()
    if not fournisseur or fournisseur.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fournisseur non trouvé")

    if obj_in.chantier_id:
        result = await db.execute(select(Chantier).where(Chantier.id == obj_in.chantier_id))
        chantier = result.scalar_one_or_none()
        if not chantier or chantier.entreprise_id != entreprise_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chantier non trouvé")

    numero = await generate_numero(db, "CMD-F", CommandeFournisseur)
    cmd = CommandeFournisseur(
        entreprise_id=entreprise_id,
        fournisseur_id=obj_in.fournisseur_id,
        chantier_id=obj_in.chantier_id,
        numero=numero,
        date_commande=obj_in.date_commande or date.today(),
        date_livraison_prevue=obj_in.date_livraison_prevue,
        taux_tva=obj_in.taux_tva,
        notes=obj_in.notes,
        created_by=user.id if user else None,
        statut="brouillon",
    )
    db.add(cmd)
    await db.flush()

    for l in obj_in.lignes:
        db.add(LigneCommandeFournisseur(
            commande_id=cmd.id,
            article_id=l.article_id,
            designation=l.designation,
            quantite=l.quantite,
            prix_unitaire=l.prix_unitaire,
            montant_ht=round(l.quantite * l.prix_unitaire, 2),
        ))
    await db.flush()  # rend les lignes visibles du recalcul (sessions autoflush=False)
    await _recalculer_commande(db, cmd)
    await db.flush()
    await db.refresh(cmd)
    return {"id": cmd.id, "numero": cmd.numero, "message": "Commande créée"}


@router.put("/commandes/{id}")
async def update_commande(payload: CurrentUserPayload, db: DbDep, id: int, obj_in: CommandeUpdate):
    _require_permission(payload, "stocks:write")
    entreprise_id = _entreprise(payload)
    cmd = await _get_commande(db, id, entreprise_id)
    if cmd.statut in ("recue", "annulee"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Commande déjà reçue ou annulée")

    data = obj_in.model_dump(exclude_unset=True, exclude={"lignes"})
    if obj_in.lignes is not None:
        # Remplacement des lignes (quantités reçues conservées par désignation)
        old = (await db.execute(
            select(LigneCommandeFournisseur).where(LigneCommandeFournisseur.commande_id == cmd.id)
        )).scalars().all()
        for l in old:
            await db.delete(l)
        await db.flush()
        for l in obj_in.lignes:
            db.add(LigneCommandeFournisseur(
                commande_id=cmd.id,
                article_id=l.article_id,
                designation=l.designation or "",
                quantite=l.quantite or 0,
                prix_unitaire=l.prix_unitaire or 0,
            ))
        await db.flush()
        cmd.statut = "brouillon" if cmd.statut not in ("envoyee", "confirmee") else cmd.statut
        data.pop("statut", None)
    for key, value in data.items():
        setattr(cmd, key, value)
    await _recalculer_commande(db, cmd)
    await db.flush()
    await db.refresh(cmd)
    return {"id": cmd.id, "message": "Commande mise à jour"}


@router.post("/commandes/{id}/statut")
async def changer_statut_commande(payload: CurrentUserPayload, db: DbDep, id: int, statut: str = Query(...)):
    _require_permission(payload, "stocks:write")
    entreprise_id = _entreprise(payload)
    cmd = await _get_commande(db, id, entreprise_id)
    if statut not in STATUTS_COMMANDE:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Statut invalide")
    cmd.statut = statut
    await db.flush()
    return {"id": cmd.id, "statut": cmd.statut}


@router.delete("/commandes/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_commande(payload: CurrentUserPayload, db: DbDep, id: int):
    _require_permission(payload, "stocks:write")
    entreprise_id = _entreprise(payload)
    cmd = await _get_commande(db, id, entreprise_id)
    cmd.is_deleted = True
    await db.flush()
    return None


# ============================================================
# Réceptions → entrée en stock
# ============================================================

@router.post("/commandes/{id}/receptions", status_code=status.HTTP_201_CREATED)
async def creer_reception(payload: CurrentUserPayload, db: DbDep, id: int, obj_in: ReceptionCreate):
    _require_permission(payload, "stocks:write")
    entreprise_id = _entreprise(payload)
    user = payload.get("user")
    cmd = await _get_commande(db, id, entreprise_id)
    if cmd.statut in ("annulee",):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Commande annulée")
    if cmd.statut == "brouillon":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Confirmez d'abord la commande")

    if obj_in.depot_id:
        result = await db.execute(select(Depot).where(Depot.id == obj_in.depot_id))
        depot = result.scalar_one_or_none()
        if not depot or depot.entreprise_id != entreprise_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dépôt non trouvé")

    lignes_cmd = (await db.execute(
        select(LigneCommandeFournisseur).where(LigneCommandeFournisseur.commande_id == cmd.id)
    )).scalars().all()
    map_lignes = {l.id: l for l in lignes_cmd}

    reception = ReceptionFournisseur(
        entreprise_id=entreprise_id,
        commande_id=cmd.id,
        numero=f"REC-{cmd.numero}",
        date_reception=obj_in.date_reception or date.today(),
        depot_id=obj_in.depot_id,
        chantier_id=obj_in.chantier_id,
        notes=obj_in.notes,
        received_by=user.id if user else None,
    )
    db.add(reception)
    await db.flush()

    for lr in obj_in.lignes:
        ligne = map_lignes.get(lr.ligne_commande_id)
        if not ligne:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ligne de commande {lr.ligne_commande_id} inconnue",
            )
        restant = _d(ligne.quantite) - _d(ligne.quantite_recue)
        if lr.quantite_recue > restant + 1e-9:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Quantité supérieure au restant à recevoir pour « {ligne.designation} » (restant {restant})",
            )

        db.add(LigneReceptionFournisseur(
            reception_id=reception.id,
            ligne_commande_id=lr.ligne_commande_id,
            quantite_recue=lr.quantite_recue,
            conforme=lr.conforme,
            notes=lr.notes,
        ))
        ligne.quantite_recue = _d(ligne.quantite_recue) + lr.quantite_recue

        # Entrée en stock si article rattaché et conforme
        if lr.conforme and ligne.article_id:
            result = await db.execute(select(Article).where(Article.id == ligne.article_id))
            article = result.scalar_one_or_none()
            if article and article.entreprise_id == entreprise_id:
                article.stock_actuel = _d(article.stock_actuel) + lr.quantite_recue
                db.add(MouvementStock(
                    entreprise_id=entreprise_id,
                    article_id=article.id,
                    type_mouvement="entree",
                    quantite=lr.quantite_recue,
                    prix_unitaire=_d(ligne.prix_unitaire),
                    chantier_id=obj_in.chantier_id,
                    fournisseur_id=cmd.fournisseur_id,
                    reference=reception.numero,
                    notes=f"Réception commande {cmd.numero}",
                ))

    # Statut de la commande selon complétude
    await db.flush()
    complete = all(
        _d(l.quantite_recue) >= _d(l.quantite) - 1e-9 for l in lignes_cmd
    )
    if complete:
        cmd.statut = "recue"
        reception.complete = True
    else:
        cmd.statut = "partiellement_recue"

    await db.flush()
    await db.refresh(reception)
    return {"id": reception.id, "numero": reception.numero, "commande_statut": cmd.statut}


@router.get("/commandes/{id}/receptions")
async def list_receptions(payload: CurrentUserPayload, db: DbDep, id: int):
    _require_permission(payload, "stocks:read")
    entreprise_id = _entreprise(payload)
    await _get_commande(db, id, entreprise_id)
    result = await db.execute(
        select(ReceptionFournisseur).where(
            ReceptionFournisseur.commande_id == id,
            ReceptionFournisseur.is_deleted == False,
        ).order_by(ReceptionFournisseur.id.desc())
    )
    receptions = result.scalars().all()
    out = []
    for r in receptions:
        out.append({c.name: getattr(r, c.name) for c in r.__table__.columns} | {
            "lignes": [
                {c.name: getattr(l, c.name) for c in l.__table__.columns}
                for l in r.lignes
            ],
        })
    return out


# ============================================================
# Factures fournisseurs
# ============================================================

@router.get("/factures")
async def list_factures(
    payload: CurrentUserPayload,
    db: DbDep,
    statut: str | None = Query(default=None),
    fournisseur_id: int | None = Query(default=None),
    chantier_id: int | None = Query(default=None),
    en_retard: bool | None = Query(default=None, description="Factures échues non payées"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
):
    _require_permission(payload, "stocks:read")
    entreprise_id = _entreprise(payload)
    query = select(FactureFournisseur).where(FactureFournisseur.is_deleted == False)
    if entreprise_id is not None:
        query = query.where(FactureFournisseur.entreprise_id == entreprise_id)
    if statut:
        query = query.where(FactureFournisseur.statut == statut)
    if fournisseur_id:
        query = query.where(FactureFournisseur.fournisseur_id == fournisseur_id)
    if chantier_id:
        query = query.where(FactureFournisseur.chantier_id == chantier_id)
    if en_retard:
        query = query.where(
            FactureFournisseur.statut.in_(("a_payer", "partiellement_payee")),
            FactureFournisseur.date_echeance != None,
            FactureFournisseur.date_echeance < date.today(),
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one() or 0

    result = await db.execute(
        query.order_by(FactureFournisseur.id.desc()).offset((page - 1) * size).limit(size)
    )
    items = []
    for f in result.scalars().all():
        items.append({c.name: getattr(f, c.name) for c in f.__table__.columns} | {
            "fournisseur_nom": f.fournisseur.nom if f.fournisseur else None,
            "chantier_nom": f.chantier.nom if f.chantier else None,
            "restant_a_payer": round(_d(f.montant_ttc) - _d(f.montant_paye), 2),
        })
    return {"items": items, "total": total, "page": page, "size": size}


@router.post("/factures", status_code=status.HTTP_201_CREATED)
async def create_facture(payload: CurrentUserPayload, db: DbDep, obj_in: FactureCreate):
    _require_permission(payload, "stocks:write")
    entreprise_id = _entreprise(payload)

    result = await db.execute(
        select(Fournisseur).where(Fournisseur.id == obj_in.fournisseur_id, Fournisseur.is_deleted == False)
    )
    fournisseur = result.scalar_one_or_none()
    if not fournisseur or fournisseur.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fournisseur non trouvé")

    tva = round(obj_in.montant_ht * obj_in.taux_tva / 100, 2)
    facture = FactureFournisseur(
        entreprise_id=entreprise_id,
        fournisseur_id=obj_in.fournisseur_id,
        commande_id=obj_in.commande_id,
        chantier_id=obj_in.chantier_id,
        numero=obj_in.numero.strip(),
        date_facture=obj_in.date_facture or date.today(),
        date_echeance=obj_in.date_echeance,
        taux_tva=obj_in.taux_tva,
        montant_ht=obj_in.montant_ht,
        montant_tva=tva,
        montant_ttc=round(obj_in.montant_ht + tva, 2),
        notes=obj_in.notes,
    )
    db.add(facture)
    await db.flush()
    await db.refresh(facture)
    return {"id": facture.id, "message": "Facture fournisseur créée"}


@router.put("/factures/{id}")
async def update_facture(payload: CurrentUserPayload, db: DbDep, id: int, obj_in: FactureUpdate):
    _require_permission(payload, "stocks:write")
    entreprise_id = _entreprise(payload)
    result = await db.execute(
        select(FactureFournisseur).where(FactureFournisseur.id == id, FactureFournisseur.is_deleted == False)
    )
    facture = result.scalar_one_or_none()
    if not facture:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture non trouvée")
    if facture.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    data = obj_in.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(facture, key, value)
    await db.flush()
    return {"id": facture.id, "statut": facture.statut}


@router.post("/factures/{id}/paiements", status_code=status.HTTP_201_CREATED)
async def add_paiement(payload: CurrentUserPayload, db: DbDep, id: int, obj_in: PaiementCreate):
    _require_permission(payload, "stocks:write")
    entreprise_id = _entreprise(payload)
    user = payload.get("user")
    result = await db.execute(
        select(FactureFournisseur).where(FactureFournisseur.id == id, FactureFournisseur.is_deleted == False)
    )
    facture = result.scalar_one_or_none()
    if not facture:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture non trouvée")
    if facture.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
    if facture.statut in ("payee", "annulee"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Facture déjà soldée ou annulée")

    restant = _d(facture.montant_ttc) - _d(facture.montant_paye)
    if obj_in.montant > restant + 1e-9:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Montant supérieur au restant à payer ({restant})",
        )

    paiement = PaiementFournisseur(
        entreprise_id=entreprise_id,
        facture_id=facture.id,
        montant=obj_in.montant,
        date_paiement=obj_in.date_paiement or date.today(),
        mode_paiement=obj_in.mode_paiement,
        reference=obj_in.reference,
        notes=obj_in.notes,
        created_by=user.id if user else None,
    )
    db.add(paiement)
    facture.montant_paye = round(_d(facture.montant_paye) + obj_in.montant, 2)
    if _d(facture.montant_paye) >= _d(facture.montant_ttc) - 1e-9:
        facture.statut = "payee"
    else:
        facture.statut = "partiellement_payee"
    await db.flush()
    await db.refresh(paiement)
    return {"id": paiement.id, "facture_statut": facture.statut}


@router.get("/factures/{id}/paiements")
async def list_paiements(payload: CurrentUserPayload, db: DbDep, id: int):
    _require_permission(payload, "stocks:read")
    entreprise_id = _entreprise(payload)
    result = await db.execute(
        select(FactureFournisseur).where(FactureFournisseur.id == id, FactureFournisseur.is_deleted == False)
    )
    facture = result.scalar_one_or_none()
    if not facture or facture.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture non trouvée")
    result = await db.execute(
        select(PaiementFournisseur).where(
            PaiementFournisseur.facture_id == id,
            PaiementFournisseur.is_deleted == False,
        ).order_by(PaiementFournisseur.id.desc())
    )
    return [
        {c.name: getattr(p, c.name) for c in p.__table__.columns}
        for p in result.scalars().all()
    ]


# ============================================================
# Impact chantier (achats vs budget)
# ============================================================

@router.get("/impact-chantier/{chantier_id}")
async def impact_chantier(payload: CurrentUserPayload, db: DbDep, chantier_id: int):
    _require_permission(payload, "stocks:read")
    entreprise_id = _entreprise(payload)
    result = await db.execute(
        select(Chantier).where(Chantier.id == chantier_id, Chantier.is_deleted == False)
    )
    chantier = result.scalar_one_or_none()
    if not chantier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chantier non trouvé")
    if chantier.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    # Achats commandés (hors annulées) et facturés
    result = await db.execute(
        select(func.coalesce(func.sum(CommandeFournisseur.montant_ttc), 0)).where(
            CommandeFournisseur.chantier_id == chantier_id,
            CommandeFournisseur.is_deleted == False,
            CommandeFournisseur.statut != "annulee",
        )
    )
    achats_commandes = _d(result.scalar_one())

    result = await db.execute(
        select(func.coalesce(func.sum(FactureFournisseur.montant_ttc), 0)).where(
            FactureFournisseur.chantier_id == chantier_id,
            FactureFournisseur.is_deleted == False,
            FactureFournisseur.statut != "annulee",
        )
    )
    achats_factures = _d(result.scalar_one())

    result = await db.execute(
        select(func.coalesce(func.sum(PaiementFournisseur.montant), 0)).where(
            PaiementFournisseur.is_deleted == False,
            PaiementFournisseur.facture_id.in_(
                select(FactureFournisseur.id).where(
                    FactureFournisseur.chantier_id == chantier_id,
                    FactureFournisseur.is_deleted == False,
                )
            ),
        )
    )
    achats_payes = _d(result.scalar_one())

    budget = _d(chantier.budget_prevu)
    return {
        "chantier_id": chantier_id,
        "budget_prevu": budget,
        "achats_commandes": round(achats_commandes, 2),
        "achats_factures": round(achats_factures, 2),
        "achats_payes": round(achats_payes, 2),
        "budget_restant": round(budget - achats_factures, 2),
        "taux_consommation": round(achats_factures / budget * 100, 1) if budget > 0 else None,
        "depassement": achats_factures > budget > 0,
    }
