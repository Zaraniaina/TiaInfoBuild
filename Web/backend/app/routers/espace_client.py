"""Router de l'Espace Client : consultation securisee des donnees du client.

Principe de securite (referentiel Espace Client, section 17) : un client ne
voit que les donnees rattachees a sa propre fiche. Toutes les requetes sont
filtrees par le client_id resolu depuis le compte utilisateur connecte
(utilisateurs.client_id, avec repli par correspondance d'email).
"""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func

from app.security import CurrentUserPayload, DbDep, hash_password, verify_password
from app.models.client import Client
from app.models.demande_travaux import DemandeTravaux
from app.models.projet import Projet
from app.models.devis import Devis
from app.models.ligne_devis import LigneDevis
from app.models.contrat import Contrat
from app.models.avenant import Avenant
from app.models.chantier import Chantier
from app.models.situation_travaux import SituationTravaux, LigneSituation
from app.models.facture import Facture
from app.models.ligne_facture import LigneFacture
from app.models.paiement import Paiement
from app.models.document import Document
from app.models.notification import Notification
from app.models.preference import Preference

router = APIRouter(tags=["espace-client"])


def _require_permission(payload: CurrentUserPayload, permission: str) -> None:
    from app.core.permissions import PERMISSION_MAP
    role_code = payload.get("role_code")
    permissions = PERMISSION_MAP.get(role_code, [])
    if "*" not in permissions and permission not in permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{permission}' requise",
        )


async def _get_client(payload: CurrentUserPayload, db: DbDep) -> Client:
    """Resout la fiche client du compte connecte (client_id, puis email)."""
    user = payload.get("user")
    client = None
    if user is not None and getattr(user, "client_id", None):
        result = await db.execute(
            select(Client).where(Client.id == user.client_id, Client.is_deleted == False)
        )
        client = result.scalar_one_or_none()
    if client is None and user is not None:
        result = await db.execute(
            select(Client).where(Client.email == user.email, Client.is_deleted == False)
        )
        client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fiche client introuvable pour ce compte",
        )
    return client


class ProfilUpdate(BaseModel):
    nom: str | None = None
    prenom: str | None = None
    telephone: str | None = None
    adresse: str | None = None
    code_postal: str | None = None
    ville: str | None = None
    pays: str | None = None


class MotDePasseChange(BaseModel):
    ancien: str
    nouveau: str


class ReponseDevis(BaseModel):
    action: Literal["accepter", "refuser"]
    motif: str | None = None


class PreferencesUpdate(BaseModel):
    notif_email: bool | None = None
    langue: str | None = None


@router.get("/profil")
async def get_profil(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    user = payload.get("user")
    return {
        "client": client,
        "compte": {
            "id": user.id,
            "email": user.email,
            "must_change_password": user.must_change_password,
        },
    }


@router.put("/profil")
async def update_profil(payload: CurrentUserPayload, db: DbDep, data: ProfilUpdate):
    _require_permission(payload, "espace_client:write")
    client = await _get_client(payload, db)
    champs = data.model_dump(exclude_unset=True)
    for cle, valeur in champs.items():
        if valeur is not None:
            setattr(client, cle, valeur)
    await db.commit()
    return {"message": "Profil mis a jour", "client": client}


@router.post("/mot-de-passe")
async def changer_mot_de_passe(payload: CurrentUserPayload, db: DbDep, data: MotDePasseChange):
    _require_permission(payload, "espace_client:write")
    user = payload.get("user")
    if not user or not verify_password(data.ancien, user.mot_de_passe_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ancien mot de passe incorrect")
    user.mot_de_passe_hash = hash_password(data.nouveau)
    user.must_change_password = False
    await db.commit()
    return {"message": "Mot de passe modifie avec succes"}


@router.get("/preferences")
async def get_preferences(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "espace_client:read")
    user = payload.get("user")
    result = await db.execute(select(Preference).where(Preference.user_id == user.id))
    pref = result.scalar_one_or_none()
    if pref is None:
        return {"notif_email": True, "langue": "fr"}
    return {"notif_email": bool(pref.notif_email), "langue": pref.langue}


@router.put("/preferences")
async def update_preferences(payload: CurrentUserPayload, db: DbDep, data: PreferencesUpdate):
    _require_permission(payload, "espace_client:write")
    user = payload.get("user")
    result = await db.execute(select(Preference).where(Preference.user_id == user.id))
    pref = result.scalar_one_or_none()
    if pref is None:
        pref = Preference(user_id=user.id)
        db.add(pref)
    if data.notif_email is not None:
        pref.notif_email = data.notif_email
    if data.langue is not None:
        pref.langue = data.langue
    await db.commit()
    return {"message": "Preferences mises a jour", "notif_email": bool(pref.notif_email), "langue": pref.langue}


@router.get("/dashboard")
async def get_dashboard(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    cid = client.id

    def _stats(model, cond):
        return select(model.statut, func.count()).where(model.is_deleted == False, cond).group_by(model.statut)

    demandes_stats = dict((await db.execute(_stats(DemandeTravaux, DemandeTravaux.client_id == cid))).all())
    devis_stats = dict((await db.execute(_stats(Devis, Devis.client_id == cid))).all())
    contrats_stats = dict((await db.execute(_stats(Contrat, Contrat.client_id == cid))).all())
    chantiers_stats = dict((await db.execute(_stats(Chantier, Chantier.client_id == cid))).all())
    factures_stats = dict((await db.execute(_stats(Facture, Facture.client_id == cid))).all())

    montant_restant = (await db.execute(
        select(func.coalesce(func.sum(Facture.reste_a_payer), 0))
        .where(Facture.client_id == cid, Facture.is_deleted == False)
    )).scalar_one()

    projets = (await db.execute(
        select(Projet).where(Projet.client_id == cid, Projet.is_deleted == False).order_by(Projet.created_at.desc())
    )).scalars().all()

    devis_list = (await db.execute(select(Devis).where(Devis.client_id == cid, Devis.is_deleted == False))).scalars().all()
    contrats_list = (await db.execute(select(Contrat).where(Contrat.client_id == cid, Contrat.is_deleted == False))).scalars().all()
    chantiers_list = (await db.execute(select(Chantier).where(Chantier.client_id == cid, Chantier.is_deleted == False))).scalars().all()
    chantier_ids = [ch.id for ch in chantiers_list]
    situations_list = []
    if chantier_ids:
        situations_list = (await db.execute(
            select(SituationTravaux).where(SituationTravaux.chantier_id.in_(chantier_ids), SituationTravaux.is_deleted == False)
        )).scalars().all()
    factures_list = (await db.execute(select(Facture).where(Facture.client_id == cid, Facture.is_deleted == False))).scalars().all()
    facture_ids = [f.id for f in factures_list]
    paiements_list = []
    if facture_ids:
        paiements_list = (await db.execute(
            select(Paiement).where(Paiement.facture_id.in_(facture_ids), Paiement.is_deleted == False)
        )).scalars().all()

    def _progression(p: Projet) -> dict:
        devis_projet = [d for d in devis_list if d.projet_id == p.id]
        devis_ids = [d.id for d in devis_projet]
        contrats_projet = [c for c in contrats_list if c.devis_id in devis_ids]
        contrat_ids = [c.id for c in contrats_projet]
        factures_projet = [f for f in factures_list if f.contrat_id in contrat_ids]
        facture_ids_projet = [f.id for f in factures_projet]
        return {
            "Demande": p.demande_id is not None,
            "Projet": True,
            "Devis": len(devis_projet) > 0,
            "Contrat": len(contrats_projet) > 0,
            "Chantier": len(chantiers_list) > 0,
            "Avancement": any(float(s.avancement or 0) > 0 for s in situations_list),
            "Facturation": len(factures_projet) > 0,
            "Paiement": any(pay.facture_id in facture_ids_projet for pay in paiements_list),
        }

    return {
        "client": {"id": client.id, "nom": client.nom, "prenom": client.prenom},
        "compteurs": {
            "projets": len(projets),
            "demandes": {
                "total": sum(demandes_stats.values()),
                "nouvelles": demandes_stats.get("nouvelle", 0),
                "en_cours": demandes_stats.get("en_etude", 0),
                "traitees": demandes_stats.get("traitee", 0) + demandes_stats.get("annulee", 0),
            },
            "devis": {
                "total": sum(devis_stats.values()),
                "en_attente": devis_stats.get("envoye", 0) + devis_stats.get("brouillon", 0),
                "acceptes": devis_stats.get("accepte", 0),
                "refuses": devis_stats.get("refuse", 0),
            },
            "contrats": {
                "total": sum(contrats_stats.values()),
                "actifs": contrats_stats.get("en_cours", 0),
                "termines": contrats_stats.get("termine", 0),
            },
            "chantiers": {
                "total": sum(chantiers_stats.values()),
                "en_cours": chantiers_stats.get("en_cours", 0),
                "termines": chantiers_stats.get("termine", 0),
            },
            "factures": {
                "total": sum(factures_stats.values()),
                "a_payer": factures_stats.get("emis", 0) + factures_stats.get("envoye", 0),
                "partiellement_payees": factures_stats.get("partiellement_payee", 0),
                "payees": factures_stats.get("payee", 0),
            },
            "montant_restant_a_payer": float(montant_restant or 0),
        },
        "projets": [
            {
                "id": p.id,
                "reference": p.reference,
                "nom": p.nom,
                "statut": p.statut,
                "etapes": _progression(p),
            }
            for p in projets
        ],
    }


@router.get("/demandes")
async def get_demandes(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    result = await db.execute(
        select(DemandeTravaux)
        .where(DemandeTravaux.client_id == client.id, DemandeTravaux.is_deleted == False)
        .order_by(DemandeTravaux.created_at.desc())
    )
    return {"items": result.scalars().all()}


@router.get("/demandes/{demande_id}")
async def get_demande(payload: CurrentUserPayload, db: DbDep, demande_id: int):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    result = await db.execute(
        select(DemandeTravaux).where(
            DemandeTravaux.id == demande_id,
            DemandeTravaux.client_id == client.id,
            DemandeTravaux.is_deleted == False,
        )
    )
    demande = result.scalar_one_or_none()
    if demande is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demande introuvable")
    return {"demande": demande}


@router.get("/projets")
async def get_projets(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    result = await db.execute(
        select(Projet).where(Projet.client_id == client.id, Projet.is_deleted == False).order_by(Projet.created_at.desc())
    )
    return {"items": result.scalars().all()}


@router.get("/projets/{projet_id}")
async def get_projet(payload: CurrentUserPayload, db: DbDep, projet_id: int):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    result = await db.execute(
        select(Projet).where(
            Projet.id == projet_id, Projet.client_id == client.id, Projet.is_deleted == False
        )
    )
    projet = result.scalar_one_or_none()
    if projet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable")
    devis_projet = (await db.execute(
        select(Devis).where(Devis.projet_id == projet.id, Devis.client_id == client.id, Devis.is_deleted == False)
    )).scalars().all()
    contrats_projet = (await db.execute(
        select(Contrat).join(Devis, Contrat.devis_id == Devis.id).where(
            Devis.projet_id == projet.id, Contrat.client_id == client.id, Contrat.is_deleted == False
        )
    )).scalars().all()
    chantiers_projet = (await db.execute(
        select(Chantier).where(Chantier.client_id == client.id, Chantier.is_deleted == False)
    )).scalars().all()
    factures_projet = (await db.execute(
        select(Facture).where(Facture.client_id == client.id, Facture.is_deleted == False)
    )).scalars().all()
    return {
        "projet": projet,
        "devis": devis_projet,
        "contrats": contrats_projet,
        "chantiers": chantiers_projet,
        "factures": factures_projet,
    }


@router.get("/devis")
async def get_devis_list(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    result = await db.execute(
        select(Devis).where(Devis.client_id == client.id, Devis.is_deleted == False).order_by(Devis.created_at.desc())
    )
    return {"items": result.scalars().all()}


@router.get("/devis/{devis_id}")
async def get_devis_detail(payload: CurrentUserPayload, db: DbDep, devis_id: int):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    result = await db.execute(
        select(Devis).where(Devis.id == devis_id, Devis.client_id == client.id, Devis.is_deleted == False)
    )
    devis = result.scalar_one_or_none()
    if devis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devis introuvable")
    lignes = (await db.execute(
        select(LigneDevis).where(LigneDevis.devis_id == devis.id, LigneDevis.is_deleted == False).order_by(LigneDevis.ordre)
    )).scalars().all()
    return {"devis": devis, "lignes": lignes}


@router.post("/devis/{devis_id}/reponse")
async def repondre_devis(payload: CurrentUserPayload, db: DbDep, devis_id: int, data: ReponseDevis):
    _require_permission(payload, "espace_client:write")
    client = await _get_client(payload, db)
    user = payload.get("user")
    result = await db.execute(
        select(Devis).where(Devis.id == devis_id, Devis.client_id == client.id, Devis.is_deleted == False)
    )
    devis = result.scalar_one_or_none()
    if devis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devis introuvable")
    if devis.statut in ("accepte", "refuse"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ce devis a deja ete repondu")

    accepte = data.action == "accepter"
    devis.statut = "accepte" if accepte else "refuse"
    devis.reponse_le = datetime.now()
    devis.reponse_par_id = user.id if user else None
    devis.reponse_motif = data.motif if not accepte else None

    db.add(Notification(
        entreprise_id=devis.entreprise_id,
        utilisateur_id=user.id if user else None,
        client_id=client.id,
        type="devis_repondu",
        titre=f"Devis {devis.numero} {'accepte' if accepte else 'refuse'}",
        message=(
            f"Votre devis {devis.numero} a ete {'accepte' if accepte else 'refuse'} le {datetime.now().strftime('%d/%m/%Y a %H:%M')}."
            + (f" Motif : {data.motif}" if data.motif and not accepte else "")
        ),
        entite_type="devis",
        entite_id=devis.id,
    ))
    await db.commit()
    return {"message": f"Devis {'accepte' if accepte else 'refuse'} avec succes", "devis": devis}


@router.get("/contrats")
async def get_contrats(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    result = await db.execute(
        select(Contrat).where(Contrat.client_id == client.id, Contrat.is_deleted == False).order_by(Contrat.created_at.desc())
    )
    return {"items": result.scalars().all()}


@router.get("/contrats/{contrat_id}")
async def get_contrat(payload: CurrentUserPayload, db: DbDep, contrat_id: int):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    result = await db.execute(
        select(Contrat).where(Contrat.id == contrat_id, Contrat.client_id == client.id, Contrat.is_deleted == False)
    )
    contrat = result.scalar_one_or_none()
    if contrat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contrat introuvable")
    avenants = (await db.execute(
        select(Avenant).where(Avenant.contrat_id == contrat.id, Avenant.is_deleted == False).order_by(Avenant.created_at.desc())
    )).scalars().all()
    return {"contrat": contrat, "avenants": avenants}


@router.get("/avenants")
async def get_avenants(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    result = await db.execute(
        select(Avenant)
        .join(Contrat, Avenant.contrat_id == Contrat.id)
        .where(Contrat.client_id == client.id, Avenant.is_deleted == False)
        .order_by(Avenant.created_at.desc())
    )
    return {"items": result.scalars().all()}


@router.get("/chantiers")
async def get_chantiers(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    result = await db.execute(
        select(Chantier).where(Chantier.client_id == client.id, Chantier.is_deleted == False).order_by(Chantier.created_at.desc())
    )
    chantiers = result.scalars().all()
    items = []
    for ch in chantiers:
        phases = [ph for ph in (ch.phases or []) if not ph.is_deleted]
        avancement = round(sum(ph.avancement_pct for ph in phases) / len(phases)) if phases else 0
        items.append({
            "chantier": ch,
            "avancement_global": avancement,
        })
    return {"items": items}


@router.get("/chantiers/{chantier_id}")
async def get_chantier(payload: CurrentUserPayload, db: DbDep, chantier_id: int):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    result = await db.execute(
        select(Chantier).where(Chantier.id == chantier_id, Chantier.client_id == client.id, Chantier.is_deleted == False)
    )
    chantier = result.scalar_one_or_none()
    if chantier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chantier introuvable")
    phases = [ph for ph in (chantier.phases or []) if not ph.is_deleted]
    phases.sort(key=lambda ph: ph.ordre)
    situations = (await db.execute(
        select(SituationTravaux).where(
            SituationTravaux.chantier_id == chantier.id, SituationTravaux.is_deleted == False
        ).order_by(SituationTravaux.created_at.desc())
    )).scalars().all()
    avancement_global = round(sum(ph.avancement_pct for ph in phases) / len(phases)) if phases else 0
    return {
        "chantier": chantier,
        "avancement_global": avancement_global,
        "phases": [
            {"nom": ph.nom, "avancement_pct": ph.avancement_pct, "statut": ph.statut, "date_debut": ph.date_debut, "date_fin": ph.date_fin}
            for ph in phases
        ],
        "situations": situations,
    }


@router.get("/avancements")
async def get_avancements(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    chantiers = (await db.execute(
        select(Chantier).where(Chantier.client_id == client.id, Chantier.is_deleted == False)
    )).scalars().all()
    items = []
    for ch in chantiers:
        phases = [ph for ph in (ch.phases or []) if not ph.is_deleted]
        phases.sort(key=lambda ph: ph.ordre)
        situations = (await db.execute(
            select(SituationTravaux).where(
                SituationTravaux.chantier_id == ch.id, SituationTravaux.is_deleted == False
            )
        )).scalars().all()
        avancement_global = round(sum(ph.avancement_pct for ph in phases) / len(phases)) if phases else 0
        items.append({
            "chantier": {"id": ch.id, "nom": ch.nom, "adresse": ch.adresse, "statut": ch.statut},
            "avancement_global": avancement_global,
            "phases": [
                {"nom": ph.nom, "avancement_pct": ph.avancement_pct, "statut": ph.statut}
                for ph in phases
            ],
            "situations": [
                {"id": s.id, "numero": s.numero, "periode": s.periode, "avancement": float(s.avancement or 0), "montant": float(s.montant or 0), "statut": s.statut}
                for s in situations
            ],
        })
    return {"items": items}


# Alias pour compatibilite
@router.get("/avancement")
async def get_avancement_alias(payload: CurrentUserPayload, db: DbDep):
    return await get_avancements(payload, db)


@router.get("/situations")
async def get_situations(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    result = await db.execute(
        select(SituationTravaux)
        .join(Chantier, SituationTravaux.chantier_id == Chantier.id)
        .where(Chantier.client_id == client.id, SituationTravaux.is_deleted == False)
        .order_by(SituationTravaux.created_at.desc())
    )
    return {"items": result.scalars().all()}


@router.get("/situations/{situation_id}")
async def get_situation(payload: CurrentUserPayload, db: DbDep, situation_id: int):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    result = await db.execute(
        select(SituationTravaux)
        .join(Chantier, SituationTravaux.chantier_id == Chantier.id)
        .where(SituationTravaux.id == situation_id, Chantier.client_id == client.id, SituationTravaux.is_deleted == False)
    )
    situation = result.scalar_one_or_none()
    if situation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Situation introuvable")
    lignes = (await db.execute(
        select(LigneSituation).where(LigneSituation.situation_id == situation.id, LigneSituation.is_deleted == False)
    )).scalars().all()
    total = sum(float(l.montant or 0) for l in lignes)
    return {
        "situation": situation,
        "lignes": lignes,
        "total": total,
    }


@router.get("/factures")
async def get_factures(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    result = await db.execute(
        select(Facture).where(Facture.client_id == client.id, Facture.is_deleted == False).order_by(Facture.created_at.desc())
    )
    return {"items": result.scalars().all()}


@router.get("/factures/{facture_id}")
async def get_facture(payload: CurrentUserPayload, db: DbDep, facture_id: int):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    result = await db.execute(
        select(Facture).where(Facture.id == facture_id, Facture.client_id == client.id, Facture.is_deleted == False)
    )
    facture = result.scalar_one_or_none()
    if facture is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture introuvable")
    lignes = (await db.execute(
        select(LigneFacture).where(LigneFacture.facture_id == facture.id, LigneFacture.is_deleted == False).order_by(LigneFacture.ordre)
    )).scalars().all()
    paiements = (await db.execute(
        select(Paiement).where(Paiement.facture_id == facture.id, Paiement.is_deleted == False).order_by(Paiement.date_paiement.desc())
    )).scalars().all()
    return {"facture": facture, "lignes": lignes, "paiements": paiements}


@router.get("/paiements")
async def get_paiements(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    factures = (await db.execute(
        select(Facture).where(Facture.client_id == client.id, Facture.is_deleted == False)
    )).scalars().all()
    facture_ids = [f.id for f in factures]
    paiements = []
    if facture_ids:
        paiements = (await db.execute(
            select(Paiement).where(Paiement.facture_id.in_(facture_ids), Paiement.is_deleted == False).order_by(Paiement.date_paiement.desc())
        )).scalars().all()
    total_facture = sum(float(f.montant_ttc or 0) for f in factures)
    total_paye = sum(float(p.montant or 0) for p in paiements)
    return {
        "items": paiements,
        "totaux": {
            "total_facture": total_facture,
            "total_paye": total_paye,
            "total_restant": max(total_facture - total_paye, 0),
        },
    }


@router.get("/documents")
async def get_documents(payload: CurrentUserPayload, db: DbDep, categorie: str | None = None):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    query = select(Document).where(Document.client_id == client.id, Document.is_deleted == False)
    if categorie:
        query = query.where(Document.categorie == categorie)
    query = query.order_by(Document.created_at.desc())
    return {"items": (await db.execute(query)).scalars().all()}


@router.get("/notifications")
async def get_notifications(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "espace_client:read")
    client = await _get_client(payload, db)
    user = payload.get("user")
    result = await db.execute(
        select(Notification)
        .where(
            (Notification.client_id == client.id) | (Notification.utilisateur_id == user.id),
        )
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    notifications = result.scalars().all()
    non_lues = sum(1 for n in notifications if not n.lu)
    return {"items": notifications, "non_lues": non_lues}


@router.post("/notifications/{notification_id}/lu")
async def marquer_notification_lue(payload: CurrentUserPayload, db: DbDep, notification_id: int):
    _require_permission(payload, "espace_client:write")
    client = await _get_client(payload, db)
    user = payload.get("user")
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            (Notification.client_id == client.id) | (Notification.utilisateur_id == user.id),
        )
    )
    notification = result.scalar_one_or_none()
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification introuvable")
    notification.lu = True
    await db.commit()
    return {"message": "Notification marquee comme lue"}
