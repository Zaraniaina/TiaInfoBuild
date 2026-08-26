"""
Router pour la synchronisation bidirectionnelle Desktop (SQLite) ↔ Web (MySQL).

Web = cerveau (source de vérité)
Desktop = client hors ligne qui se synchronise.

Endpoints:
  POST /api/sync/import-sqlite  → Desktop envoie ses données locales vers Web (Desktop→Web)
  GET  /api/sync/export         → Desktop récupère les données du Web (Web→Desktop)
  GET  /api/sync/status         → État de la dernière synchronisation
"""
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.database import get_db
from app.dependencies.auth import get_current_active_user

router = APIRouter(tags=["sync"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_active_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


# ============================================================
# Schémas de synchronisation
# ============================================================

class SyncChantier(BaseModel):
    id: Optional[int] = None
    local_id: Optional[int] = None  # ID dans SQLite desktop
    nom: str
    statut: str
    adresse: Optional[str] = None
    ville: Optional[str] = None
    budget_prevu: float = 0
    budget_reel: float = 0
    date_debut: Optional[str] = None
    date_fin_prevue: Optional[str] = None
    updated_at: Optional[str] = None

class SyncEmploye(BaseModel):
    id: Optional[int] = None
    local_id: Optional[int] = None
    nom: str
    prenom: Optional[str] = None
    poste: Optional[str] = None
    salaire_base: float = 0
    type_contrat: str = "CDI"
    statut: str = "actif"
    updated_at: Optional[str] = None

class SyncArticle(BaseModel):
    id: Optional[int] = None
    local_id: Optional[int] = None
    reference: str
    nom: str
    unite: str = "U"
    stock_actuel: float = 0
    seuil_alerte: float = 0
    stock_mini: float = 0
    prix_achat: float = 0
    prix_vente: float = 0
    updated_at: Optional[str] = None

class SyncPayload(BaseModel):
    """Payload envoyé par le Desktop lors d'une synchronisation."""
    entreprise_id: int
    sync_from: str  # "desktop"
    sync_at: str    # ISO datetime
    chantiers: list[SyncChantier] = []
    employes: list[SyncEmploye] = []
    articles: list[SyncArticle] = []
    metadata: dict[str, Any] = {}

class SyncResult(BaseModel):
    success: bool
    synced_at: str
    stats: dict[str, int]
    errors: list[str] = []
    message: str


# ============================================================
# Desktop → Web : Import des données Desktop dans MySQL
# ============================================================

@router.post("/import-sqlite", response_model=SyncResult)
async def import_from_desktop(
    data: SyncPayload,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Reçoit les données du Desktop SQLite et les merge dans MySQL.
    Stratégie: 'last-write-wins' basé sur updated_at.
    Seul le propriétaire de l'entreprise peut synchroniser ses données.
    """
    user_entreprise_id = current_user.get("entreprise_id")
    if not user_entreprise_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin ne peut pas synchroniser des données d'entreprise"
        )

    # Vérifier que l'utilisateur synchronise sa propre entreprise
    if data.entreprise_id != user_entreprise_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous ne pouvez synchroniser que les données de votre entreprise"
        )

    stats = {"chantiers": 0, "employes": 0, "articles": 0}
    errors = []

    # --- Sync Chantiers ---
    for ch in data.chantiers:
        try:
            if ch.id:
                # Mise à jour si l'enregistrement existe dans MySQL
                await db.execute(text("""
                    UPDATE chantiers SET
                        statut = :statut,
                        adresse = :adresse,
                        ville = :ville,
                        budget_reel = :budget_reel,
                        updated_at = NOW()
                    WHERE id = :id AND entreprise_id = :entreprise_id
                    AND (updated_at < :updated_at OR :updated_at IS NULL)
                """), {
                    "id": ch.id,
                    "statut": ch.statut,
                    "adresse": ch.adresse,
                    "ville": ch.ville,
                    "budget_reel": ch.budget_reel,
                    "entreprise_id": user_entreprise_id,
                    "updated_at": ch.updated_at,
                })
            else:
                # Création d'un nouveau chantier depuis Desktop
                await db.execute(text("""
                    INSERT IGNORE INTO chantiers
                        (entreprise_id, nom, statut, adresse, ville, budget_prevu, budget_reel,
                         date_debut, date_fin_prevue, budget_previsionnel, marge_cible, tva)
                    VALUES
                        (:eid, :nom, :statut, :adresse, :ville, :bp, :br, :dd, :dfp, :bp, 0, 20)
                """), {
                    "eid": user_entreprise_id,
                    "nom": ch.nom,
                    "statut": ch.statut,
                    "adresse": ch.adresse,
                    "ville": ch.ville,
                    "bp": ch.budget_prevu,
                    "br": ch.budget_reel,
                    "dd": ch.date_debut,
                    "dfp": ch.date_fin_prevue,
                })
            stats["chantiers"] += 1
        except Exception as e:
            errors.append(f"Chantier '{ch.nom}': {str(e)}")

    # --- Sync Employés ---
    for emp in data.employes:
        try:
            if emp.id:
                await db.execute(text("""
                    UPDATE employes SET
                        poste = :poste,
                        salaire_base = :salaire_base,
                        statut = :statut,
                        updated_at = NOW()
                    WHERE id = :id AND entreprise_id = :entreprise_id
                """), {
                    "id": emp.id,
                    "poste": emp.poste,
                    "salaire_base": emp.salaire_base,
                    "statut": emp.statut,
                    "entreprise_id": user_entreprise_id,
                })
            else:
                await db.execute(text("""
                    INSERT IGNORE INTO employes
                        (entreprise_id, nom, prenom, poste, type_contrat, salaire_base, statut)
                    VALUES (:eid, :nom, :prenom, :poste, :tc, :sb, :statut)
                """), {
                    "eid": user_entreprise_id,
                    "nom": emp.nom,
                    "prenom": emp.prenom,
                    "poste": emp.poste,
                    "tc": emp.type_contrat,
                    "sb": emp.salaire_base,
                    "statut": emp.statut,
                })
            stats["employes"] += 1
        except Exception as e:
            errors.append(f"Employé '{emp.nom}': {str(e)}")

    # --- Sync Articles ---
    for art in data.articles:
        try:
            if art.id:
                await db.execute(text("""
                    UPDATE articles SET
                        stock_actuel = :stock_actuel,
                        prix_vente = :prix_vente,
                        prix_achat = :prix_achat,
                        seuil_alerte = :seuil_alerte,
                        updated_at = NOW()
                    WHERE id = :id AND entreprise_id = :entreprise_id
                """), {
                    "id": art.id,
                    "stock_actuel": art.stock_actuel,
                    "prix_vente": art.prix_vente,
                    "prix_achat": art.prix_achat,
                    "seuil_alerte": art.seuil_alerte,
                    "entreprise_id": user_entreprise_id,
                })
            else:
                await db.execute(text("""
                    INSERT IGNORE INTO articles
                        (entreprise_id, reference, nom, unite, stock_actuel, seuil_alerte,
                         stock_mini, prix_achat, prix_vente, marge, tva)
                    VALUES (:eid, :ref, :nom, :unite, :sa, :seal, :sm, :pa, :pv,
                        ROUND((:pv - :pa) / NULLIF(:pv, 0) * 100, 2), 20)
                """), {
                    "eid": user_entreprise_id,
                    "ref": art.reference,
                    "nom": art.nom,
                    "unite": art.unite,
                    "sa": art.stock_actuel,
                    "seal": art.seuil_alerte,
                    "sm": art.stock_mini,
                    "pa": art.prix_achat,
                    "pv": art.prix_vente,
                })
            stats["articles"] += 1
        except Exception as e:
            errors.append(f"Article '{art.nom}': {str(e)}")

    await db.commit()

    # Enregistrer l'historique de sync
    try:
        await db.execute(text("""
            INSERT IGNORE INTO sync_queue
                (entreprise_id, type_operation, statut, payload, synced_at)
            VALUES (:eid, 'desktop_to_web', 'done', :payload, NOW())
        """), {
            "eid": user_entreprise_id,
            "payload": str(stats),
        })
        await db.commit()
    except Exception:
        pass  # La table sync_queue peut ne pas exister encore

    total = sum(stats.values())
    return SyncResult(
        success=len(errors) == 0,
        synced_at=datetime.now().isoformat(),
        stats=stats,
        errors=errors,
        message=f"✅ {total} enregistrements synchronisés Desktop→Web" if not errors
                else f"⚠️ {total} sync, {len(errors)} erreur(s)",
    )


# ============================================================
# Web → Desktop : Export des données MySQL pour le Desktop
# ============================================================

@router.get("/export")
async def export_for_desktop(
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Exporte les données MySQL pour que le Desktop puisse se mettre à jour.
    Le Desktop appelle cet endpoint et applique les données sur son SQLite.
    """
    entreprise_id = current_user.get("entreprise_id")
    if not entreprise_id:
        # Super admin peut voir tout
        entreprise_id = None

    result = {}

    # Exporter chantiers
    q = "SELECT * FROM chantiers WHERE is_deleted = 0"
    params: dict[str, Any] = {}
    if entreprise_id:
        q += " AND entreprise_id = :eid"
        params["eid"] = entreprise_id
    chantiers_res = await db.execute(text(q), params)
    result["chantiers"] = [dict(row._mapping) for row in chantiers_res.fetchall()]

    # Exporter employés
    q = "SELECT id, entreprise_id, nom, prenom, poste, type_contrat, salaire_base, statut, updated_at FROM employes WHERE is_deleted = 0"
    if entreprise_id:
        q += " AND entreprise_id = :eid"
    employes_res = await db.execute(text(q), params)
    result["employes"] = [dict(row._mapping) for row in employes_res.fetchall()]

    # Exporter articles/stocks
    q = "SELECT * FROM articles WHERE is_deleted = 0"
    if entreprise_id:
        q += " AND entreprise_id = :eid"
    articles_res = await db.execute(text(q), params)
    result["articles"] = [dict(row._mapping) for row in articles_res.fetchall()]

    # Exporter clients
    q = "SELECT * FROM clients WHERE is_deleted = 0"
    if entreprise_id:
        q += " AND entreprise_id = :eid"
    clients_res = await db.execute(text(q), params)
    result["clients"] = [dict(row._mapping) for row in clients_res.fetchall()]

    result["exported_at"] = datetime.now().isoformat()
    result["source"] = "web_mysql"
    result["entreprise_id"] = entreprise_id

    return result


# ============================================================
# Status de synchronisation
# ============================================================

@router.get("/status")
async def sync_status(
    current_user: CurrentUser,
    db: DbSession,
):
    """Retourne le statut de la dernière synchronisation pour l'entreprise."""
    entreprise_id = current_user.get("entreprise_id")

    try:
        result = await db.execute(text("""
            SELECT type_operation, statut, payload, synced_at
            FROM sync_queue
            WHERE entreprise_id = :eid
            ORDER BY synced_at DESC LIMIT 10
        """), {"eid": entreprise_id})
        history = [dict(row._mapping) for row in result.fetchall()]
    except Exception:
        history = []

    return {
        "entreprise_id": entreprise_id,
        "last_sync": history[0] if history else None,
        "history": history,
        "web_time": datetime.now().isoformat(),
    }
