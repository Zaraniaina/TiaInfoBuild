"""Router Aléas climatiques : périodes à risque pré-marquées + calcul du retard net.

Contexte Madagascar (skill expert-btp-entreprise / references/madagascar.md) :
- saison cyclonique déc.-mars, saison des pluies nov.-mars, sécheresse au Sud ;
- les aléas climatiques documentés rendent le retard « négociable », distinct
  du retard imputable à l'entreprise — utile aux pénalités de retard
  contractuelles.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select

from app.database import get_db
from app.security import CurrentUserPayload, DbDep
from app.core.permissions import PERMISSION_MAP, Role
from app.models.alerte import Alerte
from app.models.chantier import Chantier
from app.models.incident import Incident
from app.models.periode_risque_climatique import PeriodeRisqueClimatique


def _interdire_super_admin(payload: CurrentUserPayload) -> None:
    """Données métier d'entreprise : le super admin (propriétaire du SaaS) n'a
    ni lecture ni écriture sur les aléas climatiques.

    Cohérent avec roles.config.ts : le module a été retiré de son menu ; il est
    géré par les rôles responsables de l'entreprise BTP (directeur,
    admin_entreprise, chef_projet, chef_chantier). Appliqué à 100 % des routes
    du router via dependencies=[...] ci-dessous.
    """
    if payload.get("role_code") == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Module réservé aux entreprises BTP (données métier).",
        )


router = APIRouter(dependencies=[Depends(_interdire_super_admin)])

TYPES_RISQUE = {
    "cyclone",
    "inondation",
    "pluies_intenses",
    "secheresse",
    "route_coupee",
    "coupure_electricite",
    "autre",
}
IMPUTABILITES = {"climatique", "entreprise", "client", "indetermine"}


def _require_permission(payload: CurrentUserPayload, permission: str) -> None:
    role_code = payload.get("role_code")
    permissions = PERMISSION_MAP.get(role_code, [])
    if "*" not in permissions and permission not in permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{permission}' requise",
        )


# Périmètre du module aléas climatiques : les rôles de direction gèrent les
# périodes à risque et consultent l'impact SANS disposer de chantiers:read /
# chantiers:write globaux (admin_entreprise = périmètre administratif strict,
# directeur = lecture seule chantiers). L'élargissement ne vaut QUE pour ce
# module (données de direction : pénalités de retard négociables).
ROLES_GESTION_ALEAS = (Role.DIRECTEUR, Role.ADMIN_ENTREPRISE)


def _require_permission_alea(payload: CurrentUserPayload, permission: str) -> None:
    if payload.get("role_code") in ROLES_GESTION_ALEAS:
        return
    _require_permission(payload, permission)


def _get_entreprise_id(payload: CurrentUserPayload) -> int | None:
    return payload.get("entreprise_id")


# ============================================================
# Schémas Pydantic
# ============================================================

class PeriodeRisqueCreate(BaseModel):
    region: str = Field(..., min_length=1, max_length=80)
    type_risque: str = Field(..., max_length=30)
    date_debut: date
    date_fin: date
    description: str | None = None

    @field_validator("type_risque")
    @classmethod
    def validate_type_risque(cls, v: str) -> str:
        if v not in TYPES_RISQUE:
            raise ValueError(f"Type de risque invalide. Valeurs autorisées: {sorted(TYPES_RISQUE)}")
        return v

    @field_validator("date_fin")
    @classmethod
    def validate_dates(cls, v: date, info) -> date:
        debut = info.data.get("date_debut")
        if debut is not None and v < debut:
            raise ValueError("La date de fin doit être postérieure ou égale à la date de début")
        return v


class PeriodeRisqueUpdate(BaseModel):
    region: str | None = Field(default=None, min_length=1, max_length=80)
    type_risque: str | None = Field(default=None, max_length=30)
    date_debut: date | None = None
    date_fin: date | None = None
    description: str | None = None

    @field_validator("type_risque")
    @classmethod
    def validate_type_risque(cls, v: str | None) -> str | None:
        if v is not None and v not in TYPES_RISQUE:
            raise ValueError(f"Type de risque invalide. Valeurs autorisées: {sorted(TYPES_RISQUE)}")
        return v


# ============================================================
# Périodes à risque climatique (CRUD)
# ============================================================

@router.get("/periodes-risque")
async def list_periodes_risque(
    payload: CurrentUserPayload,
    db: DbDep,
    region: str | None = Query(default=None),
    type_risque: str | None = Query(default=None),
):
    """Liste les périodes à risque climatique de l'entreprise (multi-tenant)."""
    _require_permission_alea(payload, "chantiers:read")
    entreprise_id = _get_entreprise_id(payload)
    query = select(PeriodeRisqueClimatique).where(PeriodeRisqueClimatique.is_deleted == False)
    if entreprise_id is not None:
        query = query.where(PeriodeRisqueClimatique.entreprise_id == entreprise_id)
    if region:
        query = query.where(PeriodeRisqueClimatique.region == region)
    if type_risque:
        query = query.where(PeriodeRisqueClimatique.type_risque == type_risque)
    result = await db.execute(query.order_by(PeriodeRisqueClimatique.date_debut))
    items = result.scalars().all()
    return [
        {
            c.name: getattr(p, c.name)
            for c in p.__table__.columns
        }
        for p in items
    ]


@router.post("/periodes-risque", status_code=status.HTTP_201_CREATED)
async def create_periode_risque(
    payload: CurrentUserPayload,
    db: DbDep,
    obj_in: PeriodeRisqueCreate,
):
    """Pré-marque une période à risque climatique (ex: saison cyclonique déc.-mars)."""
    _require_permission_alea(payload, "chantiers:write")
    entreprise_id = _get_entreprise_id(payload)
    if entreprise_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise introuvable")

    periode = PeriodeRisqueClimatique(
        entreprise_id=entreprise_id,
        **obj_in.model_dump(),
    )
    db.add(periode)
    await db.flush()
    await db.refresh(periode)
    return {"id": periode.id, "message": "Période à risque créée"}


@router.put("/periodes-risque/{id}")
async def update_periode_risque(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
    obj_in: PeriodeRisqueUpdate,
):
    _require_permission_alea(payload, "chantiers:write")
    entreprise_id = _get_entreprise_id(payload)
    result = await db.execute(
        select(PeriodeRisqueClimatique).where(
            PeriodeRisqueClimatique.id == id,
            PeriodeRisqueClimatique.is_deleted == False,
        )
    )
    periode = result.scalar_one_or_none()
    if not periode:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Période à risque non trouvée")
    if entreprise_id is not None and periode.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    data = obj_in.model_dump(exclude_unset=True)
    if data:
        if "date_debut" in data or "date_fin" in data:
            debut = data.get("date_debut", periode.date_debut)
            fin = data.get("date_fin", periode.date_fin)
            if debut is not None and fin is not None and fin < debut:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="La date de fin doit être postérieure ou égale à la date de début",
                )
        for key, value in data.items():
            setattr(periode, key, value)
    await db.flush()
    await db.refresh(periode)
    return {"id": periode.id, "message": "Période à risque mise à jour"}


@router.delete("/periodes-risque/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_periode_risque(
    payload: CurrentUserPayload,
    db: DbDep,
    id: int,
):
    _require_permission_alea(payload, "chantiers:write")
    entreprise_id = _get_entreprise_id(payload)
    result = await db.execute(
        select(PeriodeRisqueClimatique).where(
            PeriodeRisqueClimatique.id == id,
            PeriodeRisqueClimatique.is_deleted == False,
        )
    )
    periode = result.scalar_one_or_none()
    if not periode:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Période à risque non trouvée")
    if entreprise_id is not None and periode.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    periode.is_deleted = True
    await db.flush()
    return None


# ============================================================
# Impact climatique d'un chantier (jours d'arrêt + retard net)
# ============================================================

def calculer_impact_climatique(
    incidents: list[Incident],
    date_debut: date | None,
    date_fin_prevue: date | None,
    date_fin_reelle: date | None,
    aujourdhui: date,
) -> dict:
    """Calcule jours d'arrêt climatiques documentés et retard net.

    - retard_brut_jours : dépassement du délai contractuel (date fin réelle
      ou aujourd'hui vs date fin prévue), 0 si rien dépassé ;
    - jours_arret_climatique : somme des jours d'arrêt des aléas dont
      l'imputabilité est 'climatique' (négociable) ;
    - retard_net_jours : retard_brut - jours_arret_climatique, borné à 0.
    """
    jours_arret_climatique = sum(
        (i.impact_arret_jours or 0)
        for i in incidents
        if (i.type_alea or "").strip()
        and i.imputabilite == "climatique"
        and not i.is_deleted
    )

    fin_reference = date_fin_reelle or aujourdhui
    retard_brut = 0
    if date_fin_prevue is not None and fin_reference > date_fin_prevue:
        retard_brut = (fin_reference - date_fin_prevue).days

    retard_net = max(0, retard_brut - jours_arret_climatique)
    return {
        "jours_arret_climatique": jours_arret_climatique,
        "retard_brut_jours": retard_brut,
        "retard_net_jours": retard_net,
    }


@router.get("/impact")
async def get_impact_climatique(
    payload: CurrentUserPayload,
    db: DbDep,
    chantier_id: int = Query(...),
):
    """Impact climatique d'un chantier : jours d'arrêt documentés, retard brut
    vs retard net (les aléas climatiques documentés sont négociables)."""
    _require_permission_alea(payload, "chantiers:read")
    entreprise_id = _get_entreprise_id(payload)
    result = await db.execute(select(Chantier).where(Chantier.id == chantier_id, Chantier.is_deleted == False))
    chantier = result.scalar_one_or_none()
    if not chantier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chantier non trouvé")
    if entreprise_id is not None and chantier.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    result = await db.execute(
        select(Incident).where(
            Incident.chantier_id == chantier_id,
            Incident.is_deleted == False,
            Incident.type_alea.is_not(None),
        ).order_by(Incident.date_incident)
    )
    aleas = result.scalars().all()

    aujourdhui = date.today()
    impact = calculer_impact_climatique(
        list(aleas),
        chantier.date_debut,
        chantier.date_fin_prevue,
        chantier.date_fin_reelle,
        aujourdhui,
    )

    periodes = None
    if chantier.region:
        result = await db.execute(
            select(PeriodeRisqueClimatique).where(
                PeriodeRisqueClimatique.entreprise_id == chantier.entreprise_id,
                PeriodeRisqueClimatique.region == chantier.region,
                PeriodeRisqueClimatique.is_deleted == False,
                PeriodeRisqueClimatique.date_fin >= aujourdhui,
            )
        )
        periodes = [
            {c.name: getattr(p, c.name) for c in p.__table__.columns}
            for p in result.scalars().all()
        ]

    return {
        "chantier_id": chantier_id,
        "region": chantier.region,
        **impact,
        "aleas": [
            {
                "id": a.id,
                "titre": a.titre,
                "type_alea": a.type_alea,
                "date_incident": str(a.date_incident),
                "date_fin": str(a.date_fin) if a.date_fin else None,
                "impact_arret_jours": a.impact_arret_jours,
                "imputabilite": a.imputabilite,
                "gravite": a.gravite,
                "statut": a.statut,
            }
            for a in aleas
        ],
        "periodes_risque_actives": periodes,
    }


# ============================================================
# Alerte automatique sur aléa climatique critique
# ============================================================

LIBELLES_ALEA = {
    "cyclone": "Cyclone",
    "inondation": "Inondation",
    "pluies_intenses": "Pluies intenses",
    "secheresse": "Sécheresse",
    "route_coupee": "Route coupée",
    "coupure_electricite": "Coupure d'électricité",
    "autre": "Aléa climatique",
}


async def notifier_alea_climatique(db, chantier: Chantier, incident: Incident) -> None:
    """Crée une alerte plateforme pour un aléa climatique de gravité critique.

    Résilient : une erreur d'alerte ne doit jamais faire échouer le
    signalement de l'aléa (best effort).
    """
    try:
        alerte = Alerte(
            entreprise_id=chantier.entreprise_id,
            titre=f"{LIBELLES_ALEA.get(incident.type_alea, 'Aléa climatique')} critique — {chantier.nom}",
            message=(
                f"{incident.titre} : arrêt de chantier de {incident.impact_arret_jours or 0} jour(s) "
                f"imputabilité « {incident.imputabilite or 'indetermine'} ». "
                "Retard potentiellement négociable auprès du maître d'ouvrage."
            ),
            type_entite="incident",
            entite_id=incident.id,
            niveau_gravite="critique",
        )
        db.add(alerte)
        await db.flush()
    except Exception:
        pass
