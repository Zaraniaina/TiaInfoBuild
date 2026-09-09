"""Router de l'Espace Employe Terrain : consultation et declarations du terrain.

Securite (referentiel Espace Employe Terrain, section 20) : l'employe ne voit
que les donnees liees a ses affectations. La fiche employe est resolue par
l'email du compte connecte.
"""
from datetime import datetime, date

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func

from app.security import CurrentUserPayload, DbDep
from app.models.employe import Employe
from app.models.chantier import Chantier
from app.models.pointage import Pointage
from app.models.tache import Tache
from app.models.travail_realise import TravailRealise
from app.models.rapport_journalier import RapportJournalier
from app.models.photo_chantier import PhotoChantier
from app.models.signalement import Signalement
from app.models.commentaire import Commentaire
from app.models.affectation_chantier import AffectationChantier
from app.models.notification import Notification

router = APIRouter(tags=["employe-terrain"])


def _require_permission(payload: CurrentUserPayload, permission: str) -> None:
    from app.core.permissions import PERMISSION_MAP
    role_code = payload.get("role_code")
    permissions = PERMISSION_MAP.get(role_code, [])
    if "*" not in permissions and permission not in permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{permission}' requise",
        )


async def _get_employe(payload: CurrentUserPayload, db: DbDep) -> Employe:
    """Resout la fiche employe du compte connecte (par email)."""
    user = payload.get("user")
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compte non trouve")
    email = (getattr(user, "email", None) or "").strip().lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aucune fiche employe rattachee a votre compte")
    query = select(Employe).where(
        func.lower(Employe.email) == email,
        Employe.is_deleted == False,
    )
    result = await db.execute(query)
    employe = result.scalar_one_or_none()
    if not employe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucune fiche employe rattachee a votre compte. Contactez votre administrateur.",
        )
    return employe


# ==================== DASHBOARD ====================

@router.get("/dashboard")
async def get_dashboard(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "employe_terrain:read")
    employe = await _get_employe(payload, db)
    eid = employe.id

    # Chantiers affectes (via affectation_chantiers)
    affectations = (await db.execute(
        select(AffectationChantier).where(
            AffectationChantier.employe_id == eid,
            AffectationChantier.is_deleted == False,
        )
    )).scalars().all()
    chantier_ids = [a.chantier_id for a in affectations]

    chantier_actuel = None
    nb_chantiers = len(chantier_ids)
    if chantier_ids:
        chantiers_l = (await db.execute(
            select(Chantier).where(
                Chantier.id.in_(chantier_ids),
                Chantier.is_deleted == False,
                Chantier.statut == "en_cours",
            )
        )).scalars().all()
        if chantiers_l:
            ch = chantiers_l[0]
            chantier_actuel = {"id": ch.id, "nom": ch.nom, "adresse": ch.adresse, "statut": ch.statut}

    # Taches du jour
    aujourdhui = date.today()
    nb_taches_total = (await db.execute(
        select(func.count()).select_from(Tache).where(
            Tache.employe_id == eid, Tache.is_deleted == False,
            Tache.date_prevue == aujourdhui,
        )
    )).scalar_one() or 0
    nb_taches_terminees = (await db.execute(
        select(func.count()).select_from(Tache).where(
            Tache.employe_id == eid, Tache.is_deleted == False,
            Tache.statut == "terminee", Tache.date_prevue == aujourdhui,
        )
    )).scalar_one() or 0

    # Presence aujourd'hui
    pt = (await db.execute(
        select(Pointage).where(
            Pointage.employe_id == eid,
            Pointage.date_jour == aujourdhui,
            Pointage.is_deleted == False,
        )
    )).scalar_one_or_none()

    return {
        "employe": {"id": employe.id, "nom": employe.nom, "prenom": employe.prenom, "poste": employe.poste},
        "chantier_actuel": chantier_actuel,
        "nb_chantiers": nb_chantiers,
        "taches_du_jour": {
            "total": nb_taches_total,
            "terminees": nb_taches_terminees,
            "restantes": max(nb_taches_total - nb_taches_terminees, 0),
        },
        "presence": {
            "date": aujourdhui.isoformat(),
            "heure_entree": pt.heure_debut.strftime("%H:%M") if pt and pt.heure_debut else None,
            "heure_sortie": pt.heure_fin.strftime("%H:%M") if pt and pt.heure_fin else None,
            "pause_debut": pt.heure_pause_debut.strftime("%H:%M") if pt and pt.heure_pause_debut else None,
            "pause_fin": pt.heure_pause_fin.strftime("%H:%M") if pt and pt.heure_pause_fin else None,
            "heures_total": float(pt.heures_total or 0) if pt else 0,
        },
    }



# ==================== MES CHANTIERS ====================

@router.get("/chantiers")
async def get_mes_chantiers(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "employe_terrain:read")
    employe = await _get_employe(payload, db)
    affectations = (await db.execute(
        select(AffectationChantier).where(
            AffectationChantier.employe_id == employe.id,
            AffectationChantier.is_deleted == False,
        )
    )).scalars().all()
    items = []
    for a in affectations:
        ch = (await db.execute(
            select(Chantier).where(Chantier.id == a.chantier_id, Chantier.is_deleted == False)
        )).scalar_one_or_none()
        if ch:
            items.append({"chantier": ch, "role_affectation": a.role, "date_debut": a.date_debut, "date_fin": a.date_fin})
    return {"items": items}


@router.get("/chantiers/{chantier_id}")
async def get_chantier_detail(payload: CurrentUserPayload, db: DbDep, chantier_id: int):
    _require_permission(payload, "employe_terrain:read")
    employe = await _get_employe(payload, db)
    affect = (await db.execute(
        select(AffectationChantier).where(
            AffectationChantier.employe_id == employe.id,
            AffectationChantier.chantier_id == chantier_id,
            AffectationChantier.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not affect:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chantier non trouve ou non autorise")
    chantier = await db.get(Chantier, chantier_id)
    if not chantier or chantier.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chantier introuvable")
    return {"chantier": chantier, "role_affectation": affect.role}


# ==================== MES TACHES ====================

@router.get("/taches")
async def get_mes_taches(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "employe_terrain:read")
    employe = await _get_employe(payload, db)
    result = await db.execute(
        select(Tache).where(Tache.employe_id == employe.id, Tache.is_deleted == False).order_by(Tache.date_prevue)
    )
    return {"items": result.scalars().all()}


class TacheStatutRequest(BaseModel):
    statut: str


@router.post("/taches/{tache_id}/statut")
async def changer_statut_tache(payload: CurrentUserPayload, db: DbDep, tache_id: int, data: TacheStatutRequest):
    _require_permission(payload, "taches:write")
    employe = await _get_employe(payload, db)
    tache = await db.get(Tache, tache_id)
    if not tache or tache.is_deleted or tache.employe_id != employe.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tache introuvable")
    allowed = {"a_faire", "en_cours", "terminee", "bloquee"}
    if data.statut not in allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Statut invalide. Valeurs: {allowed}")
    tache.statut = data.statut
    await db.commit()
    return {"message": f"Statut mis a jour: {data.statut}", "tache": tache}


# ==================== PLANNING ====================

@router.get("/planning")
async def get_planning(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "employe_terrain:read")
    employe = await _get_employe(payload, db)
    aujourdhui = date.today()
    result = await db.execute(
        select(Tache).where(
            Tache.employe_id == employe.id,
            Tache.is_deleted == False,
            Tache.date_prevue >= aujourdhui,
        ).order_by(Tache.date_prevue).limit(20)
    )
    return {"items": result.scalars().all()}


# ==================== PRESENCE / ACTIVITE ====================

class PresenceRequest(BaseModel):
    action: str


@router.post("/presence")
async def enregistrer_presence(payload: CurrentUserPayload, db: DbDep, data: PresenceRequest):
    _require_permission(payload, "pointage:write")
    employe = await _get_employe(payload, db)
    aujourdhui = date.today()
    now_time = datetime.now().time()
    existing_pt = (await db.execute(
        select(Pointage).where(
            Pointage.employe_id == employe.id,
            Pointage.date_jour == aujourdhui,
            Pointage.is_deleted == False,
        )
    )).scalar_one_or_none()
    action = data.action

    if action == "entree":
        if existing_pt:
            return {"message": "Presence deja enregistree aujourd'hui", "pointage": existing_pt}
        pt = Pointage(
            entreprise_id=employe.entreprise_id, employe_id=employe.id,
            date_jour=aujourdhui, heure_debut=now_time, heures_total=0,
            type="present", methode_pointage="auto_employe",
        )
        db.add(pt)
        await db.commit()
        return {"message": f"Entree enregistree a {now_time.strftime('%H:%M')}", "pointage": pt}

    if not existing_pt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aucune presence enregistree. Commencez par pointer l'entree.")

    if action == "pause_debut":
        if existing_pt.heure_pause_debut:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pause deja en cours")
        existing_pt.heure_pause_debut = now_time
        await db.commit()
        return {"message": f"Debut de pause a {now_time.strftime('%H:%M')}", "pointage": existing_pt}

    if action == "pause_fin":
        if not existing_pt.heure_pause_debut:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aucune pause en cours")
        existing_pt.heure_pause_fin = now_time
        await db.commit()
        return {"message": f"Fin de pause a {now_time.strftime('%H:%M')}", "pointage": existing_pt}

    if action == "sortie":
        if existing_pt.heure_fin:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sortie deja enregistree")
        existing_pt.heure_fin = now_time
        if existing_pt.heure_debut:
            h_start = existing_pt.heure_debut.hour + existing_pt.heure_debut.minute / 60.0
            h_end = now_time.hour + now_time.minute / 60.0
            pause_ded = 0.0
            if existing_pt.heure_pause_debut and existing_pt.heure_pause_fin:
                hp_s = existing_pt.heure_pause_debut.hour + existing_pt.heure_pause_debut.minute / 60.0
                hp_f = existing_pt.heure_pause_fin.hour + existing_pt.heure_pause_fin.minute / 60.0
                pause_ded = max(0, hp_f - hp_s)
            existing_pt.heures_total = max(0.0, round(h_end - h_start - pause_ded, 2))
        else:
            existing_pt.heures_total = 8.0
        await db.commit()
        return {"message": f"Sortie enregistree a {now_time.strftime('%H:%M')} ({existing_pt.heures_total}h)", "pointage": existing_pt}

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Action invalide")


@router.get("/presence")
async def get_ma_presence(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "employe_terrain:read")
    employe = await _get_employe(payload, db)
    aujourdhui = date.today()
    pt = (await db.execute(
        select(Pointage).where(
            Pointage.employe_id == employe.id,
            Pointage.date_jour == aujourdhui,
            Pointage.is_deleted == False,
        )
    )).scalar_one_or_none()
    return {"pointage": pt}


# ==================== TRAVAUX REALISES ====================

class TravailRealiseCreate(BaseModel):
    chantier_id: int | None = None
    tache_id: int | None = None
    ouvrage: str | None = None
    travail: str
    quantite: float = 0.0
    unite: str | None = None
    duree_heures: float = 0.0
    observations: str | None = None


@router.post("/travaux-realises")
async def declarer_travail(payload: CurrentUserPayload, db: DbDep, data: TravailRealiseCreate):
    _require_permission(payload, "employe_terrain:write")
    employe = await _get_employe(payload, db)
    travail = TravailRealise(
        entreprise_id=employe.entreprise_id,
        chantier_id=data.chantier_id,
        employe_id=employe.id,
        tache_id=data.tache_id,
        date_travail=date.today(),
        ouvrage=data.ouvrage,
        travail=data.travail,
        quantite=data.quantite,
        unite=data.unite,
        duree_heures=data.duree_heures,
        observations=data.observations,
    )
    db.add(travail)
    await db.commit()
    return {"message": "Travail declare avec succes", "travail": travail}


@router.get("/travaux-realises")
async def get_travaux(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "employe_terrain:read")
    employe = await _get_employe(payload, db)
    result = await db.execute(
        select(TravailRealise).where(
            TravailRealise.employe_id == employe.id, TravailRealise.is_deleted == False
        ).order_by(TravailRealise.created_at.desc())
    )
    return {"items": result.scalars().all()}


# Alias pour compatibilite
@router.get("/travaux")
async def get_travaux_alias(payload: CurrentUserPayload, db: DbDep):
    return await get_travaux(payload, db)


# ==================== RAPPORTS JOURNALIERS ====================

class RapportJournalierCreate(BaseModel):
    chantier_id: int | None = None
    travaux_realises: str | None = None
    quantites: str | None = None
    personnel_present: str | None = None
    materiel_utilise: str | None = None
    materiaux_utilises: str | None = None
    incidents: str | None = None
    difficultes: str | None = None
    observations: str | None = None
    nb_photos: int = 0


@router.post("/rapports")
async def creer_rapport(payload: CurrentUserPayload, db: DbDep, data: RapportJournalierCreate):
    _require_permission(payload, "employe_terrain:write")
    employe = await _get_employe(payload, db)
    rapport = RapportJournalier(
        entreprise_id=employe.entreprise_id,
        chantier_id=data.chantier_id,
        employe_id=employe.id,
        date_rapport=date.today(),
        travaux_realises=data.travaux_realises,
        quantites=data.quantites,
        personnel_present=data.personnel_present,
        materiel_utilise=data.materiel_utilise,
        materiaux_utilises=data.materiaux_utilises,
        incidents=data.incidents,
        difficultes=data.difficultes,
        observations=data.observations,
        nb_photos=data.nb_photos,
    )
    db.add(rapport)
    await db.commit()
    return {"message": "Rapport journalier enregistre", "rapport": rapport}


@router.get("/rapports")
async def get_rapports(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "employe_terrain:read")
    employe = await _get_employe(payload, db)
    result = await db.execute(
        select(RapportJournalier).where(
            RapportJournalier.employe_id == employe.id, RapportJournalier.is_deleted == False
        ).order_by(RapportJournalier.created_at.desc())
    )
    return {"items": result.scalars().all()}


# ==================== PHOTOS CHANTIER ====================

class PhotoCreate(BaseModel):
    chantier_id: int | None = None
    tache_id: int | None = None
    fichier_url: str
    description: str | None = None
    zone: str | None = None


@router.post("/photos")
async def envoyer_photo(payload: CurrentUserPayload, db: DbDep, data: PhotoCreate):
    _require_permission(payload, "employe_terrain:write")
    employe = await _get_employe(payload, db)
    photo = PhotoChantier(
        entreprise_id=employe.entreprise_id,
        chantier_id=data.chantier_id,
        employe_id=employe.id,
        tache_id=data.tache_id,
        fichier_url=data.fichier_url,
        description=data.description,
        zone=data.zone,
    )
    db.add(photo)
    await db.commit()
    return {"message": "Photo envoyee avec succes", "photo": photo}


@router.get("/photos")
async def get_photos(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "employe_terrain:read")
    employe = await _get_employe(payload, db)
    result = await db.execute(
        select(PhotoChantier).where(
            PhotoChantier.employe_id == employe.id, PhotoChantier.is_deleted == False
        ).order_by(PhotoChantier.created_at.desc())
    )
    return {"items": result.scalars().all()}


# ==================== SIGNALEMENTS ====================

class SignalementCreate(BaseModel):
    chantier_id: int | None = None
    type: str
    description: str | None = None
    zone: str | None = None
    priorite: str = "normale"
    photo_url: str | None = None


@router.post("/signalements")
async def creer_signalement(payload: CurrentUserPayload, db: DbDep, data: SignalementCreate):
    _require_permission(payload, "employe_terrain:write")
    employe = await _get_employe(payload, db)
    signalement = Signalement(
        entreprise_id=employe.entreprise_id,
        chantier_id=data.chantier_id,
        employe_id=employe.id,
        type=data.type,
        description=data.description,
        zone=data.zone,
        priorite=data.priorite,
        photo_url=data.photo_url,
    )
    db.add(signalement)
    await db.commit()
    return {"message": "Signalement envoye avec succes", "signalement": signalement}


@router.get("/signalements")
async def get_signalements(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "employe_terrain:read")
    employe = await _get_employe(payload, db)
    result = await db.execute(
        select(Signalement).where(
            Signalement.employe_id == employe.id, Signalement.is_deleted == False
        ).order_by(Signalement.created_at.desc())
    )
    return {"items": result.scalars().all()}


# ==================== COMMENTAIRES ====================

class CommentaireCreate(BaseModel):
    chantier_id: int | None = None
    objet_type: str | None = None
    objet_id: int | None = None
    message: str


@router.post("/commentaires")
async def ajouter_commentaire(payload: CurrentUserPayload, db: DbDep, data: CommentaireCreate):
    _require_permission(payload, "employe_terrain:write")
    employe = await _get_employe(payload, db)
    user = payload.get("user")
    commentaire = Commentaire(
        entreprise_id=employe.entreprise_id,
        chantier_id=data.chantier_id,
        employe_id=employe.id,
        utilisateur_id=user.id if user else None,
        objet_type=data.objet_type,
        objet_id=data.objet_id,
        message=data.message,
    )
    db.add(commentaire)
    await db.commit()
    return {"message": "Commentaire ajoute", "commentaire": commentaire}


@router.get("/commentaires/{objet_type}/{objet_id}")
async def get_commentaires(payload: CurrentUserPayload, db: DbDep, objet_type: str, objet_id: int):
    _require_permission(payload, "employe_terrain:read")
    employe = await _get_employe(payload, db)
    result = await db.execute(
        select(Commentaire).where(
            Commentaire.employe_id == employe.id,
            Commentaire.objet_type == objet_type,
            Commentaire.objet_id == objet_id,
            Commentaire.is_deleted == False,
        ).order_by(Commentaire.created_at.asc())
    )
    return {"items": result.scalars().all()}


# ==================== NOTIFICATIONS ====================

@router.get("/notifications")
async def get_notifications(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "employe_terrain:read")
    user = payload.get("user")
    uid = user.id if user else None
    result = await db.execute(
        select(Notification).where(
            Notification.utilisateur_id == uid,
        ).order_by(Notification.created_at.desc()).limit(50)
    )
    notifications = result.scalars().all()
    non_lues = sum(1 for n in notifications if not n.lu)
    return {"items": notifications, "non_lues": non_lues}


@router.post("/notifications/{notification_id}/lu")
async def marquer_notification_lue(payload: CurrentUserPayload, db: DbDep, notification_id: int):
    _require_permission(payload, "employe_terrain:write")
    user = payload.get("user")
    uid = user.id if user else None
    notification = (await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.utilisateur_id == uid,
        )
    )).scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification introuvable")
    notification.lu = True
    await db.commit()
    return {"message": "Notification marquee comme lue"}


# ==================== PROFIL ====================

@router.get("/profil")
async def get_profil_terrain(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "employe_terrain:read")
    employe = await _get_employe(payload, db)
    return {"employe": employe}


@router.put("/profil")
async def update_profil_terrain(payload: CurrentUserPayload, db: DbDep, data: dict):
    _require_permission(payload, "employe_terrain:write")
    employe = await _get_employe(payload, db)
    allowed = {"telephone", "email", "photo", "adresse"}
    for key, value in data.items():
        if key in allowed and value is not None:
            setattr(employe, key, value)
    await db.commit()
    return {"message": "Profil mis a jour", "employe": employe}


# ==================== DOCUMENTS ====================

@router.get("/documents")
async def get_documents_terrain(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "employe_terrain:read")
    employe = await _get_employe(payload, db)
    eid = employe.id

    affectations = (await db.execute(
        select(AffectationChantier).where(
            AffectationChantier.employe_id == eid,
            AffectationChantier.is_deleted == False,
        )
    )).scalars().all()
    chantier_ids = [a.chantier_id for a in affectations]

    from app.models.document import Document
    query = select(Document).where(Document.is_deleted == False)
    if chantier_ids:
        query = query.where(
            (Document.chantier_id.in_(chantier_ids)) | (Document.client_id.is_(None))
        )
    result = await db.execute(query.order_by(Document.created_at.desc()))
    documents = result.scalars().all()
    return {"items": documents}


# ==================== BADGE QR ====================

@router.get("/mon-badge")
async def get_mon_badge(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "employe_terrain:read")
    employe = await _get_employe(payload, db)
    return {
        "employe": employe,
        "code_qr": employe.code_qr_badge or f"TIA-EMP-{employe.id}-1-0",
    }


# Alias pour compatibilite
@router.get("/badge")
async def get_badge_alias(payload: CurrentUserPayload, db: DbDep):
    return await get_mon_badge(payload, db)


@router.get("/pointages")
async def get_mes_pointages(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "employe_terrain:read")
    employe = await _get_employe(payload, db)
    eid = employe.id

    pointages = (await db.execute(
        select(Pointage).where(
            Pointage.employe_id == eid,
            Pointage.is_deleted == False,
        ).order_by(Pointage.date_jour.desc(), Pointage.heure_debut.desc())
    )).scalars().all()
    return {"items": pointages}

