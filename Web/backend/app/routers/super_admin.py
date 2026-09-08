"""Router pour le Super Admin (propriétaire SaaS)."""
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.database import get_db
from app.security import require_super_admin, generate_temp_password, hash_password
from app.models.entreprise import Entreprise
from app.models.utilisateur import Utilisateur
from app.models.alerte import Alerte
from app.models.facture import Facture
from app.models.historique_connexion import HistoriqueConnexion
from app.models.paiement import Paiement
from app.schemas.entreprise import EntrepriseCreate, EntrepriseUpdate, EntrepriseResponse
from app.schemas.utilisateur import UtilisateurResponse, UtilisateurList
from app.schemas.dashboard import SuperAdminStatsResponse, PlatformSettingsResponse

router = APIRouter(tags=["super-admin"])
CurrentUser = Annotated[dict[str, Any], Depends(require_super_admin)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("/stats", response_model=SuperAdminStatsResponse)
async def get_stats(payload: CurrentUser, db: DbSession):
    total_entreprises = (await db.execute(select(func.count(Entreprise.id)).where(Entreprise.is_deleted == False))).scalar_one_or_none() or 0
    total_utilisateurs = (await db.execute(select(func.count(Utilisateur.id)).where(Utilisateur.is_deleted == False))).scalar_one_or_none() or 0
    from app.models.chantier import Chantier
    total_chantiers = (await db.execute(select(func.count(Chantier.id)).where(Chantier.is_deleted == False))).scalar_one_or_none() or 0
    entreprises_actives = (await db.execute(select(func.count(Entreprise.id)).where(Entreprise.actif == True, Entreprise.is_deleted == False))).scalar_one_or_none() or 0
    entreprises_inactives = total_entreprises - entreprises_actives
    abonnements_result = await db.execute(select(Entreprise.abonnement, func.count(Entreprise.id)).where(Entreprise.is_deleted == False).group_by(Entreprise.abonnement))
    abonnements = {row[0] or "gratuit": row[1] for row in abonnements_result.all()}

    now = datetime.now()
    debut_mois = datetime(now.year, now.month, 1)
    nouveaux_utilisateurs_mois = (await db.execute(
        select(func.count(Utilisateur.id)).where(Utilisateur.date_creation >= debut_mois, Utilisateur.is_deleted == False)
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
        select(func.coalesce(func.sum(Paiement.montant), 0)).where(
            Paiement.date_paiement >= debut_mois,
            Paiement.is_deleted == False,
        )
    )).scalar_one_or_none() or 0.0

    total_paiements = (await db.execute(
        select(func.count(Paiement.id)).where(Paiement.is_deleted == False)
    )).scalar_one_or_none() or 0

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
        factures_en_retard=factures_en_retard,
        total_paiements=total_paiements,
    )


@router.get("/tenants-evolution")
async def tenants_evolution(payload: CurrentUser, db: DbSession, months: int = Query(default=8, ge=1, le=24)):
    """Évolution mensuelle des nouveaux tenants (entreprises) sur la plateforme SaaS."""
    now = datetime.now()
    debut = datetime(now.year, 1, 1) if months >= 12 else datetime(now.year, now.month, 1) - timedelta(days=30 * (months - 1))
    result = await db.execute(
        select(Entreprise.date_creation).where(Entreprise.date_creation >= debut, Entreprise.is_deleted == False)
    )
    rows = result.fetchall() or []
    buckets = {}
    cur = debut
    while cur <= now:
        buckets[cur.strftime("%Y-%m")] = 0
        if cur.month == 12:
            cur = datetime(cur.year + 1, 1, 1)
        else:
            cur = datetime(cur.year, cur.month + 1, 1)
    for row in rows:
        dc = row[0]
        if dc:
            key = dc.strftime("%Y-%m")
            buckets[key] = buckets.get(key, 0) + 1
    labels = list(buckets.keys())
    data = list(buckets.values())
    total = sum(data)
    active_mois = sum(1 for v in data if v > 0)
    croissance = 0.0
    if active_mois and data[0] > 0:
        croissance = round(((data[-1] - data[0]) / data[0]) * 100.0, 1)
    return {"labels": labels, "data": data, "croissance": croissance}


@router.get("/entreprises", response_model=list[EntrepriseResponse])
async def list_entreprises(
    payload: CurrentUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
    search: str | None = Query(default=None),
    actif: bool | None = Query(default=None),
):
    query = select(Entreprise).where(Entreprise.is_deleted == False)
    if search:
        query = query.where(Entreprise.nom.ilike(f"%{search}%"))
    if actif is not None:
        query = query.where(Entreprise.actif == actif)
    result = await db.execute(query.offset((page - 1) * size).limit(size))
    return list(result.scalars().all())


@router.post("/entreprises", response_model=EntrepriseResponse, status_code=status.HTTP_201_CREATED)
async def create_entreprise(payload: CurrentUser, db: DbSession, data: EntrepriseCreate):
    obj_in = data.model_dump(exclude={"admin_nom", "admin_prenom", "admin_email", "admin_password", "admin_telephone"})
    entreprise = Entreprise(**obj_in)
    db.add(entreprise)
    await db.flush()
    await db.refresh(entreprise)

    if data.admin_email and data.admin_password:
        from app.models.role import Role
        role_result = await db.execute(select(Role).where(Role.code == "admin_entreprise"))
        role = role_result.scalar_one_or_none()
        if not role:
            raise HTTPException(status_code=500, detail="Rôle admin_entreprise introuvable")
        admin = Utilisateur(
            entreprise_id=entreprise.id,
            role_id=role.id,
            nom=data.admin_nom or "Admin",
            prenom=data.admin_prenom or "Entreprise",
            email=data.admin_email,
            mot_de_passe_hash=hash_password(data.admin_password),
            telephone=data.admin_telephone,
            statut="actif",
            must_change_password=True,
        )
        db.add(admin)
        await db.flush()

    return entreprise


@router.put("/entreprises/{id}", response_model=EntrepriseResponse)
async def update_entreprise(payload: CurrentUser, db: DbSession, id: int, data: EntrepriseUpdate):
    result = await db.execute(select(Entreprise).where(Entreprise.id == id, Entreprise.is_deleted == False))
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
    result = await db.execute(select(Entreprise).where(Entreprise.id == id, Entreprise.is_deleted == False))
    entreprise = result.scalar_one_or_none()
    if not entreprise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entreprise non trouvée")
    entreprise.actif = not entreprise.actif
    await db.commit()
    return {"actif": entreprise.actif}


@router.delete("/entreprises/{id}")
async def delete_entreprise(payload: CurrentUser, db: DbSession, id: int):
    result = await db.execute(select(Entreprise).where(Entreprise.id == id, Entreprise.is_deleted == False))
    entreprise = result.scalar_one_or_none()
    if not entreprise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entreprise non trouvée")
    entreprise.is_deleted = True
    entreprise.actif = False
    await db.commit()
    return {"detail": "Entreprise supprimée avec succès"}


@router.get("/utilisateurs", response_model=list[UtilisateurList])
async def list_all_utilisateurs(
    payload: CurrentUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
    search: str | None = Query(default=None),
    entreprise_id: int | None = Query(default=None),
):
    query = select(Utilisateur).where(Utilisateur.is_deleted == False)
    if search:
        query = query.where((Utilisateur.nom.ilike(f"%{search}%")) | (Utilisateur.email.ilike(f"%{search}%")))
    if entreprise_id is not None:
        query = query.where(Utilisateur.entreprise_id == entreprise_id)
    result = await db.execute(query.offset((page - 1) * size).limit(size))
    return list(result.scalars().all())


@router.post("/utilisateurs/{id}/reset-password")
async def reset_user_password(payload: CurrentUser, db: DbSession, id: int):
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == id, Utilisateur.is_deleted == False))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    temp_password = generate_temp_password()
    user.mot_de_passe_hash = hash_password(temp_password)
    user.must_change_password = True
    await db.flush()
    return {"detail": "Mot de passe réinitialisé", "temp_password": temp_password}


@router.post("/utilisateurs/{id}/suspendre")
async def toggle_user_status(payload: CurrentUser, db: DbSession, id: int):
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == id, Utilisateur.is_deleted == False))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")
    user.statut = "inactif" if user.statut == "actif" else "actif"
    await db.commit()
    return {"statut": user.statut}


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
    result = await db.execute(
        select(HistoriqueConnexion).where(HistoriqueConnexion.is_deleted == False).order_by(HistoriqueConnexion.date_connexion.desc()).limit(size)
    )
    logs = result.scalars().all()
    return {
        "items": [
            {
                "id": l.id,
                "niveau": "info" if l.reussi else "error",
                "message": f"Connexion utilisateur #{l.utilisateur_id} - {'Succès' if l.reussi else 'Échec'}",
                "date": l.date_connexion.isoformat() if l.date_connexion else None,
                "utilisateur": "system",
            }
            for l in logs
        ]
    }


@router.get("/abonnements")
async def list_abonnements(payload: CurrentUser, db: DbSession):
    result = await db.execute(select(Entreprise.abonnement, func.count(Entreprise.id)).where(Entreprise.is_deleted == False).group_by(Entreprise.abonnement))
    abonnements = [
        {"id": 1, "nom": k or "gratuit", "prix": 0, "utilisateurs_max": 5, "chantiers_max": 3, "stockage_go": 5, "actif": True, "count": v}
        for k, v in result.all()
    ]
    if not abonnements:
        abonnements = [
            {"id": 1, "nom": "Pro", "prix": 150000, "utilisateurs_max": 10, "chantiers_max": 5, "stockage_go": 10, "actif": True, "count": 0},
            {"id": 2, "nom": "Premium", "prix": 350000, "utilisateurs_max": 25, "chantiers_max": 15, "stockage_go": 50, "actif": True, "count": 0},
            {"id": 3, "nom": "Enterprise", "prix": 750000, "utilisateurs_max": 999, "chantiers_max": 999, "stockage_go": 200, "actif": True, "count": 0},
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


@router.get("/paiements")
async def list_paiements(payload: CurrentUser, db: DbSession, size: int = Query(default=50, le=100)):
    result = await db.execute(
        select(Paiement).where(Paiement.is_deleted == False).order_by(Paiement.date_paiement.desc()).limit(size)
    )
    paiements = result.scalars().all()
    return {
        "items": [
            {
                "id": p.id,
                "entreprise": p.entreprise.nom if p.entreprise else f"Entreprise #{p.entreprise_id}",
                "montant": float(p.montant or 0),
                "date_paiement": p.date_paiement.isoformat() if p.date_paiement else None,
                "mode_paiement": p.mode_paiement or "-",
                "facture_id": p.facture_id,
            }
            for p in paiements
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
