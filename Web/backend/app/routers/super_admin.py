"""Router pour le Super Admin (propriétaire SaaS)."""
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.database import get_db
from app.security import require_super_admin
from app.models.entreprise import Entreprise
from app.models.utilisateur import Utilisateur
from app.models.alerte import Alerte
from app.models.facture import Facture
from app.schemas.entreprise import EntrepriseCreate, EntrepriseUpdate, EntrepriseResponse
from app.schemas.utilisateur import UtilisateurResponse, UtilisateurList
from app.schemas.dashboard import SuperAdminStatsResponse, PlatformSettingsResponse

router = APIRouter(prefix="/super-admin", tags=["super-admin"])
CurrentUser = Annotated[dict[str, Any], Depends(require_super_admin)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("/stats", response_model=SuperAdminStatsResponse)
async def get_stats(payload: CurrentUser, db: DbSession):
    total_entreprises = (await db.execute(select(func.count(Entreprise.id)))).scalar_one_or_none() or 0
    total_utilisateurs = (await db.execute(select(func.count(Utilisateur.id)))).scalar_one_or_none() or 0
    from app.models.chantier import Chantier
    total_chantiers = (await db.execute(select(func.count(Chantier.id)))).scalar_one_or_none() or 0
    entreprises_actives = (await db.execute(select(func.count(Entreprise.id)).where(Entreprise.actif == True))).scalar_one_or_none() or 0
    entreprises_inactives = total_entreprises - entreprises_actives
    abonnements_result = await db.execute(select(Entreprise.abonnement, func.count(Entreprise.id)).group_by(Entreprise.abonnement))
    abonnements = {row[0]: row[1] for row in abonnements_result.all()}

    now = datetime.now()
    debut_mois = datetime(now.year, now.month, 1)
    nouveaux_utilisateurs_mois = (await db.execute(
        select(func.count(Utilisateur.id)).where(Utilisateur.date_creation >= debut_mois)
    )).scalar_one_or_none() or 0

    factures_en_retard = (await db.execute(
        select(func.count(Facture.id)).where(Facture.statut == "en_retard", Facture.is_deleted == False)
    )).scalar_one_or_none() or 0

    incidents_critiques = (await db.execute(
        select(func.count(Alerte.id)).where(Alerte.niveau_gravite == "critique", Alerte.statut != "traite", Alerte.is_deleted == False)
    )).scalar_one_or_none() or 0

    demandes_support = (await db.execute(
        select(func.count(Alerte.id)).where(Alerte.niveau_gravite.in_(["basse", "moyenne"]), Alerte.statut == "non_lue", Alerte.is_deleted == False)
    )).scalar_one_or_none() or 0

    revenu_mensuel = (await db.execute(
        select(func.coalesce(func.sum(Facture.montant_paye), 0)).where(
            Facture.date_paiement >= debut_mois,
            Facture.is_deleted == False,
        )
    )).scalar_one_or_none() or 0.0

    return SuperAdminStatsResponse(
        total_entreprises=total_entreprises,
        total_utilisateurs=total_utilisateurs,
        total_chantiers=total_chantiers,
        ca_total=float(revenu_mensuel),
        entreprises_actives=entreprises_actives,
        entreprises_inactives=entreprises_inactives,
        abonnements=abonnements,
        nouveaux_utilisateurs_mois=nouveaux_utilisateurs_mois,
        uptime=99.9,
        revenu_mensuel=float(revenu_mensuel),
        incidents_critiques=incidents_critiques,
        demandes_support=demandes_support,
    )


@router.get("/entreprises", response_model=list[EntrepriseResponse])
async def list_entreprises(
    payload: CurrentUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
    search: str | None = Query(default=None),
    actif: bool | None = Query(default=None),
):
    query = select(Entreprise)
    if search:
        query = query.where(Entreprise.nom.ilike(f"%{search}%"))
    if actif is not None:
        query = query.where(Entreprise.actif == actif)
    result = await db.execute(query.offset((page - 1) * size).limit(size))
    return list(result.scalars().all())


@router.post("/entreprises", response_model=EntrepriseResponse, status_code=status.HTTP_201_CREATED)
async def create_entreprise(payload: CurrentUser, db: DbSession, data: EntrepriseCreate):
    obj_in = data.model_dump()
    entreprise = Entreprise(**obj_in)
    db.add(entreprise)
    await db.flush()
    await db.refresh(entreprise)
    return entreprise


@router.put("/entreprises/{id}", response_model=EntrepriseResponse)
async def update_entreprise(payload: CurrentUser, db: DbSession, id: int, data: EntrepriseUpdate):
    result = await db.execute(select(Entreprise).where(Entreprise.id == id))
    entreprise = result.scalar_one_or_none()
    if not entreprise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entreprise non trouvée")
    obj_in = data.model_dump(exclude_unset=True)
    for field, value in obj_in.items():
        setattr(entreprise, field, value)
    await db.flush()
    await db.refresh(entreprise)
    return entreprise


@router.post("/entreprises/{id}/desactiver", response_model=dict)
async def toggle_entreprise(payload: CurrentUser, db: DbSession, id: int):
    result = await db.execute(select(Entreprise).where(Entreprise.id == id))
    entreprise = result.scalar_one_or_none()
    if not entreprise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entreprise non trouvée")
    entreprise.actif = not entreprise.actif
    await db.commit()
    return {"actif": entreprise.actif}


@router.get("/utilisateurs", response_model=list[UtilisateurList])
async def list_all_utilisateurs(
    payload: CurrentUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
    search: str | None = Query(default=None),
):
    query = select(Utilisateur).where(Utilisateur.is_deleted == False)
    if search:
        query = query.where((Utilisateur.nom.ilike(f"%{search}%")) | (Utilisateur.email.ilike(f"%{search}%")))
    result = await db.execute(query.offset((page - 1) * size).limit(size))
    return list(result.scalars().all())


@router.get("/alerts")
async def list_alerts(payload: CurrentUser, db: DbSession, size: int = Query(default=50, le=100)):
    result = await db.execute(
        select(Alerte).where(Alerte.is_deleted == False).order_by(Alerte.created_at.desc()).limit(size)
    )
    alerts = result.scalars().all()
    return {
        "items": [
            {
                "id": a.id,
                "type": a.niveau_gravite,
                "titre": a.titre,
                "texte": a.message,
                "date": a.created_at.isoformat() if a.created_at else None,
            }
            for a in alerts
        ]
    }


@router.get("/logs")
async def list_logs(payload: CurrentUser, db: DbSession, size: int = Query(default=50, le=100)):
    from app.models.historique_connexion import HistoriqueConnexion
    result = await db.execute(
        select(HistoriqueConnexion).where(HistoriqueConnexion.is_deleted == False).order_by(HistoriqueConnexion.date_connexion.desc()).limit(size)
    )
    logs = result.scalars().all()
    return {
        "items": [
            {
                "id": l.id,
                "niveau": "info",
                "message": f"Connexion utilisateur #{l.utilisateur_id} - {'Succès' if l.reussi else 'Échec'}",
                "date": l.date_connexion.isoformat() if l.date_connexion else None,
                "utilisateur": "system",
            }
            for l in logs
        ]
    }


@router.get("/abonnements")
async def list_abonnements(payload: CurrentUser, db: DbSession):
    result = await db.execute(select(Entreprise.abonnement, func.count(Entreprise.id)).group_by(Entreprise.abonnement))
    abonnements = [
        {"id": 1, "nom": k or "gratuit", "prix": 0, "utilisateurs_max": 5, "chantiers_max": 3, "stockage_go": 5, "actif": True}
        for k, _ in result.all()
    ]
    if not abonnements:
        abonnements = [
            {"id": 1, "nom": "Pro", "prix": 150000, "utilisateurs_max": 10, "chantiers_max": 5, "stockage_go": 10, "actif": True},
            {"id": 2, "nom": "Premium", "prix": 350000, "utilisateurs_max": 25, "chantiers_max": 15, "stockage_go": 50, "actif": True},
            {"id": 3, "nom": "Enterprise", "prix": 750000, "utilisateurs_max": 999, "chantiers_max": 999, "stockage_go": 200, "actif": True},
        ]
    return abonnements


@router.get("/facturation")
async def list_facturation(payload: CurrentUser, db: DbSession, size: int = Query(default=50, le=100)):
    result = await db.execute(
        select(Facture).where(Facture.is_deleted == False).order_by(Facture.date_echeance.desc()).limit(size)
    )
    factures = result.scalars().all()
    return {
        "items": [
            {
                "id": f.id,
                "entreprise": f.entreprise.nom if f.entreprise else f"Entreprise #{f.entreprise_id}",
                "montant": float(f.montant_ttc or 0),
                "statut": f.statut,
                "date_echeance": f.date_echeance.isoformat() if f.date_echeance else None,
                "date_paiement": f.date_creation.isoformat() if f.date_creation else None,
                "moyen": f.mode_paiement or "-",
            }
            for f in factures
        ]
    }


@router.get("/settings", response_model=PlatformSettingsResponse)
async def get_platform_settings(payload: CurrentUser, db: DbSession):
    from app.models.preference import Preference
    result = await db.execute(select(Preference).where(Preference.cle == "platform_settings"))
    pref = result.scalar_one_or_none()
    if pref and pref.valeur:
        return PlatformSettingsResponse(**pref.valeur)
    return PlatformSettingsResponse(
        nom_plateforme="TIA INFO BUILD",
        support_email="support@tiainfo.mg",
        mobile_money_enabled=True,
        devise_defaut="MGA",
        langues="fr,mg",
        maintenance_mode=False,
    )


@router.put("/settings", response_model=PlatformSettingsResponse)
async def update_platform_settings(payload: CurrentUser, db: DbSession, data: PlatformSettingsResponse):
    from app.models.preference import Preference
    result = await db.execute(select(Preference).where(Preference.cle == "platform_settings"))
    pref = result.scalar_one_or_none()
    if not pref:
        pref = Preference(cle="platform_settings", valeur=data.model_dump())
        db.add(pref)
    else:
        pref.valeur = data.model_dump()
    await db.flush()
    await db.refresh(pref)
    return data
