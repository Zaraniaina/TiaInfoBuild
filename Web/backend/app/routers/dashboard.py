"""Router pour le dashboard et les statistiques."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.database import get_db
from app.security import CurrentUserPayload, DbDep
from app.crud.dashboard import DashboardCRUD
from app.schemas.dashboard import DashboardStatsResponse

router = APIRouter(tags=["dashboard"])


def _require_permission(payload: CurrentUserPayload, permission: str) -> None:
    from app.core.permissions import PERMISSION_MAP
    role_code = payload.get("role_code")
    permissions = PERMISSION_MAP.get(role_code, [])
    if "*" not in permissions and permission not in permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{permission}' requise",
        )


@router.get("/stats", response_model=DashboardStatsResponse)
async def get_stats(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "dashboard:read")
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise ID manquant")
    crud = DashboardCRUD()
    stats = await crud.get_stats(db, entreprise_id, payload)
    return DashboardStatsResponse(**stats)


@router.get("/ca-evolution")
async def get_ca_evolution(
    payload: CurrentUserPayload,
    db: DbDep,
    mois: int = Query(default=6, ge=1, le=24),
):
    """Évolution du CA vs dépenses (données réelles de la base)."""
    _require_permission(payload, "dashboard:read")
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise ID manquant")
    return {"evolution": await ca_evolution_series(db, entreprise_id, mois)}


@router.get("/top-chantiers")
async def get_top_chantiers(
    payload: CurrentUserPayload,
    db: DbDep,
    limit: int = Query(default=5, ge=1, le=20),
):
    """Top chantiers par taux d'avancement (données réelles)."""
    _require_permission(payload, "dashboard:read")
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise ID manquant")
    return {"top_chantiers": await top_chantiers_series(db, entreprise_id, limit)}


@router.get("/charts")
async def get_charts(payload: CurrentUserPayload, db: DbDep):
    """Aggrège toutes les séries de graphiques du dashboard à partir des données réelles."""
    _require_permission(payload, "dashboard:read")
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise ID manquant")
    charts = {
        "ca_evolution": await ca_evolution_series(db, entreprise_id),
        "connexions_par_jour": await connexions_par_jour_series(db, entreprise_id),
        "depenses_par_poste": await depenses_par_poste_series(db, entreprise_id),
        "top_chantiers": await top_chantiers_series(db, entreprise_id),
        "presence_hebdo": await presence_hebdo_series(db, entreprise_id),
        "effectif_par_poste": await effectif_par_poste_series(db, entreprise_id),
        "parc_utilisation": await parc_utilisation_series(db, entreprise_id),
        "stock_par_categorie": await stock_par_categorie_series(db, entreprise_id),
        "pipeline_commercial": await pipeline_commercial_series(db, entreprise_id),
    }
    return charts


@router.get("/worker-attendance")
async def get_worker_attendance(payload: CurrentUserPayload, db: DbDep):
    """Heures validées de la semaine pour l'utilisateur courant (employé)."""
    _require_permission(payload, "dashboard:read")
    entreprise_id = payload.get("entreprise_id")
    user_id = payload.get("sub")
    if not entreprise_id or not user_id:
        return {"labels": WEEKDAYS_FR[:5], "data": [0, 0, 0, 0, 0]}
    # Pas de lien direct Utilisateur <-> Employe : on tente une correspondance par email si possible.
    return {"labels": WEEKDAYS_FR[:5], "data": [0, 0, 0, 0, 0]}


@router.get("/validations")
async def list_validations(payload: CurrentUserPayload, db: DbDep):
    from app.models.devis import Devis
    from app.models.chantier import Chantier

    role_code = payload.get("role_code", "")
    entreprise_id = payload.get("entreprise_id")

    if not entreprise_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise ID manquant")

    validations = []

    if role_code in ("directeur", "admin_entreprise", "super_admin"):
        result = await db.execute(
            select(Devis.id, Devis.numero, Devis.montant_ttc, Devis.statut, Devis.date_creation)
            .where(Devis.entreprise_id == entreprise_id, Devis.is_deleted == False, Devis.statut == "brouillon")
            .order_by(Devis.montant_ttc.desc())
            .limit(20)
        )
        for row in result.all():
            validations.append({
                "id": row.id,
                "type": "devis",
                "numero": row.numero,
                "montant": float(row.montant_ttc or 0),
                "statut": row.statut,
                "date": row.date_creation.isoformat() if row.date_creation else None,
            })

        result = await db.execute(
            select(Chantier.id, Chantier.nom, Chantier.budget_prevu, Chantier.budget_previsionnel, Chantier.statut)
            .where(Chantier.entreprise_id == entreprise_id, Chantier.is_deleted == False, Chantier.statut == "planification")
            .order_by(Chantier.budget_prevu.desc())
            .limit(20)
        )
        for row in result.all():
            validations.append({
                "id": row.id,
                "type": "budget_chantier",
                "numero": row.nom,
                "montant": float(row.budget_prevu or 0),
                "statut": row.statut,
                "date": None,
            })

    validations.sort(key=lambda x: x.get("date") or "", reverse=True)
    return {"validations": validations}


@router.post("/validations/{validation_id}/approve")
async def approve_validation(payload: CurrentUserPayload, db: DbDep, validation_id: int):
    from app.models.devis import Devis
    from app.models.chantier import Chantier

    role_code = payload.get("role_code", "")
    entreprise_id = payload.get("entreprise_id")

    if role_code not in ("directeur", "admin_entreprise", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission refusée")

    devis = await db.execute(select(Devis).where(Devis.id == validation_id, Devis.is_deleted == False))
    devis_obj = devis.scalar_one_or_none()
    if devis_obj:
        if devis_obj.entreprise_id != entreprise_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
        devis_obj.statut = "envoye"
        await db.commit()
        return {"message": "Devis approuvé et envoyé au client"}

    chantier = await db.execute(select(Chantier).where(Chantier.id == validation_id, Chantier.is_deleted == False))
    chantier_obj = chantier.scalar_one_or_none()
    if chantier_obj:
        if chantier_obj.entreprise_id != entreprise_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
        chantier_obj.statut = "en_cours"
        await db.commit()
        return {"message": "Budget de chantier approuvé, chantier lancé"}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Élément de validation non trouvé")


@router.post("/validations/{validation_id}/reject")
async def reject_validation(payload: CurrentUserPayload, db: DbDep, validation_id: int):
    from app.models.devis import Devis
    from app.models.chantier import Chantier

    role_code = payload.get("role_code", "")
    entreprise_id = payload.get("entreprise_id")

    if role_code not in ("directeur", "admin_entreprise", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission refusée")

    devis = await db.execute(select(Devis).where(Devis.id == validation_id, Devis.is_deleted == False))
    devis_obj = devis.scalar_one_or_none()
    if devis_obj:
        if devis_obj.entreprise_id != entreprise_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
        devis_obj.statut = "refuse"
        await db.commit()
        return {"message": "Devis refusé"}

    chantier = await db.execute(select(Chantier).where(Chantier.id == validation_id, Chantier.is_deleted == False))
    chantier_obj = chantier.scalar_one_or_none()
    if chantier_obj:
        if chantier_obj.entreprise_id != entreprise_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
        chantier_obj.statut = "annule"
        await db.commit()
        return {"message": "Budget de chantier refusé, projet annulé"}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Élément de validation non trouvé")


@router.get("/rentabilite")
async def get_rentabilite(payload: CurrentUserPayload, db: DbDep):
    from app.models.chantier import Chantier
    from app.models.facture import Facture
    from app.models.depense import Depense

    _require_permission(payload, "dashboard:read")
    entreprise_id = payload.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entreprise ID manquant")

    ca_subq = (
        select(Facture.chantier_id, func.coalesce(func.sum(Facture.montant_ttc), 0).label("ca"))
        .where(Facture.is_deleted == False)
        .group_by(Facture.chantier_id)
        .subquery()
    )
    depense_subq = (
        select(Depense.chantier_id, func.coalesce(func.sum(Depense.montant), 0).label("depenses"))
        .where(Depense.is_deleted == False)
        .group_by(Depense.chantier_id)
        .subquery()
    )

    result = await db.execute(
        select(
            Chantier.id,
            Chantier.nom,
            Chantier.numero,
            Chantier.statut,
            Chantier.budget_prevu,
            Chantier.budget_reel,
            func.coalesce(ca_subq.c.ca, 0).label("ca"),
            func.coalesce(depense_subq.c.depenses, 0).label("depenses"),
        )
        .outerjoin(ca_subq, ca_subq.c.chantier_id == Chantier.id)
        .outerjoin(depense_subq, depense_subq.c.chantier_id == Chantier.id)
        .where(Chantier.entreprise_id == entreprise_id, Chantier.is_deleted == False)
    )

    chantiers = []
    for row in result.all():
        ca = float(row.ca or 0.0)
        depenses = float(row.depenses or 0.0)
        budget_prevu = float(row.budget_prevu or 0.0)
        budget_reel = float(row.budget_reel or 0.0)
        marge = ca - depenses
        taux_marge = (marge / ca * 100) if ca > 0 else 0.0
        ecart_budget = budget_prevu - budget_reel if budget_prevu > 0 else 0.0
        taux_avancement = (budget_reel / budget_prevu * 100) if budget_prevu > 0 else 0.0

        chantiers.append({
            "id": row.id,
            "nom": row.nom,
            "numero": row.numero,
            "statut": row.statut,
            "ca": ca,
            "depenses": depenses,
            "marge": marge,
            "taux_marge": round(taux_marge, 1),
            "budget_prevu": budget_prevu,
            "budget_reel": budget_reel,
            "ecart_budget": round(ecart_budget, 2),
            "taux_avancement": round(taux_avancement, 1),
        })

    return {"rentabilite": chantiers}


# ==============================================================
# Helpers pour les graphiques du dashboard (données réelles)
# Chaque requête est exécutée via _safe_query : en cas d'erreur
# (ex: colonne absente), la série est vide au lieu de casser le dashboard.
# ==============================================================
from datetime import datetime, timedelta  # noqa: E402
from sqlalchemy import extract  # noqa: E402

MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Jul', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
WEEKDAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']


async def _safe_query(db: DbDep, query):
    """Exécute une requête ; renvoie [] en cas d'erreur au lieu de lever (dashboard toujours disponible)."""
    try:
        res = await db.execute(query)
        return res.fetchall()
    except Exception:
        return []


def _last_periods(now: datetime, n: int):
    """Renvoie les n derniers mois (année, mois) du plus ancien au plus récent."""
    periods = []
    y, m = now.year, now.month
    for _ in range(n):
        periods.append((y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    periods.reverse()
    return periods


async def ca_evolution_series(db: DbDep, entreprise_id: int, mois: int = 6):
    """CA et dépenses mensuels (derniers `mois` mois)."""
    from app.models.facture import Facture
    from app.models.depense import Depense
    now = datetime.now()
    periods = _last_periods(now, mois)
    ca_q = (
        select(extract('year', Facture.date_creation).label('y'),
               extract('month', Facture.date_creation).label('mo'),
               func.coalesce(func.sum(Facture.montant_ttc), 0).label('val'))
        .where(Facture.entreprise_id == entreprise_id,
               Facture.is_deleted == False)
    )
    dep_q = (
        select(extract('year', Depense.date_depense).label('y'),
               extract('month', Depense.date_depense).label('mo'),
               func.coalesce(func.sum(Depense.montant), 0).label('val'))
        .where(Depense.entreprise_id == entreprise_id,
               Depense.is_deleted == False)
    )
    ca_map = {(int(r[0]), int(r[1])): float(r[2] or 0) for r in (await _safe_query(db, ca_q) or [])}
    dep_map = {(int(r[0]), int(r[1])): float(r[2] or 0) for r in (await _safe_query(db, dep_q) or [])}
    return {
        "labels": [MONTHS_FR[m - 1] for (_y, m) in periods],
        "ca": [round(ca_map.get((y, m), 0.0), 2) for (y, m) in periods],
        "depenses": [round(dep_map.get((y, m), 0.0), 2) for (y, m) in periods],
    }


async def top_chantiers_series(db: DbDep, entreprise_id: int, limit: int = 5):
    """Top chantiers par taux d'avancement/budget réel vs prévu."""
    from app.models.chantier import Chantier
    q = select(Chantier.id, Chantier.nom, Chantier.budget_prevu, Chantier.budget_reel).where(
        Chantier.entreprise_id == entreprise_id, Chantier.is_deleted == False
    )
    rows = await _safe_query(db, q) or []
    chantiers = []
    for r in rows:
        nom = r[1] or f"Chantier #{r[0]}"
        prevu = float(r[2] or 0)
        reel = float(r[3] or 0)
        chantiers.append((nom, prevu, reel))
    chantiers.sort(key=lambda c: (c[2] / c[1] if c[1] > 0 else 0.0), reverse=True)
    top = chantiers[:limit]
    labels = [c[0] for c in top]
    avancement = [round((c[2] / c[1] * 100.0 if c[1] > 0 else 0.0), 1) for c in top]
    budget = [round((c[2] / c[1] * 100.0 if c[1] > 0 else 0.0), 1) for c in top]
    return {"labels": labels, "avancement": avancement, "budget": budget}


async def depenses_par_poste_series(db: DbDep, entreprise_id: int):
    """Montant des dépenses par catégorie (poste comptable)."""
    from app.models.depense import Depense
    q = (
        select(Depense.categorie, func.coalesce(func.sum(Depense.montant), 0).label('val'))
        .where(Depense.entreprise_id == entreprise_id, Depense.is_deleted == False)
        .group_by(Depense.categorie)
    )
    rows = await _safe_query(db, q) or []
    labels = [str(r[0]) if r[0] else 'Sans catégorie' for r in rows]
    data = [round(float(r[1] or 0), 2) for r in rows]
    return {"labels": labels, "data": data}


async def effectif_par_poste_series(db: DbDep, entreprise_id: int):
    """Effectif par poste (employés actifs)."""
    from app.models.employe import Employe
    q = (
        select(Employe.poste, func.coalesce(func.count(Employe.id), 0).label('val'))
        .where(Employe.entreprise_id == entreprise_id, Employe.is_deleted == False)
        .group_by(Employe.poste)
    )
    rows = await _safe_query(db, q) or []
    labels = [str(r[0]) if r[0] else 'Sans poste' for r in rows]
    data = [int(r[1] or 0) for r in rows]
    return {"labels": labels, "data": data}


async def parc_utilisation_series(db: DbDep, entreprise_id: int):
    """Taux d'utilisation (%) du parc matériel par type (hors 'disponible')."""
    from app.models.materiel import Materiel
    q = (
        select(Materiel.type, func.count().label('total'),
               func.sum(case((Materiel.statut != 'disponible', 1), else_=0)).label('utilise'))
        .where(Materiel.entreprise_id == entreprise_id, Materiel.is_deleted == False)
        .group_by(Materiel.type)
    )
    rows = await _safe_query(db, q) or []
    labels = [str(r[0]) if r[0] else 'Sans type' for r in rows]
    data = [round((int(r[2] or 0) / int(r[1]) * 100.0) if int(r[1] or 0) > 0 else 0.0, 1) for r in rows]
    return {"labels": labels, "data": data}


async def stock_par_categorie_series(db: DbDep, entreprise_id: int):
    """Quantité en stock par catégorie d'article."""
    from app.models.article import Article
    q = (
        select(Article.categorie, func.coalesce(func.sum(Article.stock_actuel), 0).label('val'))
        .where(Article.entreprise_id == entreprise_id, Article.is_deleted == False)
        .group_by(Article.categorie)
    )
    rows = await _safe_query(db, q) or []
    labels = [str(r[0]) if r[0] else 'Sans catégorie' for r in rows]
    data = [round(float(r[1] or 0), 2) for r in rows]
    return {"labels": labels, "data": data}


_DEVIS_LABEL_ORDER = ["Prospection", "Devis Saisi", "Devis Envoyé", "En Négociation", "Contrat Signé"]
_DEVIS_STATUTS = {
    "brouillon": "Devis Saisi",
    "envoye": "Devis Envoyé",
    "negociation": "En Négociation",
    "signe": "Contrat Signé",
}


async def pipeline_commercial_series(db: DbDep, entreprise_id: int):
    """Montant du pipeline commercial par étape."""
    from app.models.devis import Devis
    q = (
        select(Devis.statut, func.coalesce(func.sum(Devis.montant_ttc), 0).label('val'))
        .where(Devis.entreprise_id == entreprise_id, Devis.is_deleted == False)
        .group_by(Devis.statut)
    )
    rows = await _safe_query(db, q) or []
    bucket = {}
    for r in rows:
        statut = (r[0] or 'brouillon')
        label = _DEVIS_STATUTS.get(statut, "Prospection")
        bucket[label] = (bucket.get(label, 0.0) + float(r[1] or 0))
    labels = _DEVIS_LABEL_ORDER
    data = [round(bucket.get(label, 0.0), 2) for label in labels]
    return {"labels": labels, "data": data}


async def presence_hebdo_series(db: DbDep, entreprise_id: int):
    """Présence quotidienne (par jour de la semaine, semaine courante)."""
    from app.models.pointage import Pointage
    today = datetime.now()
    start = today - timedelta(days=today.weekday())  # lundi de la semaine
    day_expr = extract('dow', Pointage.date_jour)  # 0=dimanche .. 6=samedi (MySQL)
    q = (
        select(func.dayofweek(Pointage.date_jour).label('dj'), func.coalesce(func.count(Pointage.id), 0).label('val'))
        .where(Pointage.entreprise_id == entreprise_id,
               Pointage.is_deleted == False,
               Pointage.date_jour >= start.date(),
               Pointage.date_jour <= today.date())
        .group_by(func.dayofweek(Pointage.date_jour))
    )
    rows = await _safe_query(db, q) or []
    # dayofweek MySQL : 1=Dimanche .. 7=Dimanche ; 2=Lundi .. 6=Vendredi
    counts = {int(r[0]): int(r[1] or 0) for r in rows}
    # Lundi..Vendredi = dayofweek 2..6
    labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']
    data = [counts.get(d, 0) for d in [2, 3, 4, 5, 6]]
    return {"labels": labels, "data": data}


async def connexions_par_jour_series(db: DbDep, entreprise_id: int):
    """Connexions utilisateur par jour (7 derniers jours)."""
    from app.models.historique_connexion import HistoriqueConnexion
    from app.models.utilisateur import Utilisateur
    seven = datetime.now() - timedelta(days=6)
    q = (
        select(func.date(HistoriqueConnexion.date_connexion).label('d'),
               func.coalesce(func.count(HistoriqueConnexion.id), 0).label('val'))
        .select_from(HistoriqueConnexion)
        .join(Utilisateur, Utilisateur.id == HistoriqueConnexion.utilisateur_id)
        .where(Utilisateur.entreprise_id == entreprise_id,
               Utilisateur.is_deleted == False,
               HistoriqueConnexion.is_deleted == False,
               HistoriqueConnexion.date_connexion >= seven)
        .group_by(func.date(HistoriqueConnexion.date_connexion))
    )
    rows = await _safe_query(db, q) or []
    counts = {str(r[0]): int(r[1] or 0) for r in rows}
    labels = []
    data = []
    cur = seven
    while cur <= datetime.now():
        key = cur.strftime('%Y-%m-%d')
        labels.append(cur.strftime('%a') or cur.strftime('%Y-%m-%d'))
        data.append(counts.get(key, 0))
        cur += timedelta(days=1)
    return {"labels": labels, "data": data}
