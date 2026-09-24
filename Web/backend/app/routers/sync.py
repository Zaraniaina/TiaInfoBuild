"""
Router pour la synchronisation bidirectionnelle Desktop (SQLite) ↔ Web (MySQL).

Web = cerveau (source de vérité)
Desktop = client hors ligne qui se synchronise.

Endpoints (contrat Tauri 2, docs/plan-desktop-tauri.md §6) :
  POST /api/sync/push            → batch d'opérations desktop (règle « le web gagne »)
  GET  /api/sync/pull?since=…    → delta web → desktop depuis un curseur ISO 8601 UTC
  POST /api/sync/import-sqlite   → (legacy) Desktop envoie ses données locales vers Web (Desktop→Web)
  GET  /api/sync/export          → (legacy) Desktop récupère les données du Web (Web→Desktop)
  GET  /api/sync/status          → (legacy) état de la dernière synchronisation

GET /api/sync/push n'existe pas : seul POST /push est déclaré (405 sinon).
"""
from datetime import date, datetime, time, timezone
import logging
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

import sqlalchemy as sa

from app.core.serializers import model_to_dict
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.chantier import Chantier
from app.models.employe import Employe
from app.models.pointage import Pointage
from app.models.sync_applied import SyncApplied
from app.security import get_current_user

router = APIRouter(tags=["sync"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_active_user)]
# Les endpoints push/pull dépendent directement de get_current_user (et non
# get_current_active_user) : get_current_user rejette déjà les comptes inactifs.
SyncUser = Annotated[dict[str, Any], Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]

logger = logging.getLogger("tia")


# ============================================================
# Contrat desktop Tauri 2 : push (Desktop→Web) et pull (Web→Desktop)
# ============================================================

# --- Table des entités synchronisées (singular → modèle) ---
# PHASE 4 : ajouter les entités restantes ici (stocks, tâches, finance,
# commercial, achats, RH complet, alertes, …). Le reste du moteur (push/pull)
# est déjà générique : il n'y a rien d'autre à toucher.
ENTITES_SYNC: dict[str, type] = {
    "pointage": Pointage,
    "chantier": Chantier,
    "employe": Employe,
}

# Colonnes que le client desktop ne fournit JAMAIS : gérées par le serveur
# (PK autoincrement, tenant forcé depuis le JWT, colonnes de sync via les
# hooks de app/core/sync_cols.py).
COLONNES_SERVEUR = {
    "id",
    "entreprise_id",
    "client_ref",
    "sync_version",
    "sync_created_at",
    "sync_updated_at",
}


class SyncChange(BaseModel):
    """Un changement issu de l'outbox desktop (`_sync_outbox`)."""

    seq: int
    entity: str
    entity_id: str
    op: Literal["create", "update", "delete"]
    payload: dict[str, Any] = Field(default_factory=dict)
    client_ts: str | None = None
    base_version: int | None = None

    @field_validator("entity_id", mode="before")
    @classmethod
    def _entity_id_en_chaine(cls, v: Any) -> Any:
        """Tolère un entity_id numérique JSON (l'UUID client reste la norme)."""
        return str(v) if v is not None else v


class SyncPushRequest(BaseModel):
    """Corps de POST /api/sync/push."""

    device_id: str = Field(..., min_length=1, max_length=128)
    changes: list[SyncChange]


def _parseur_curseur(since: str) -> datetime:
    """Parse un curseur ISO 8601 (UTC) ; 400 si illisible."""
    try:
        dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Curseur `since` invalide : un horodatage ISO 8601 UTC est attendu.",
        )
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _coerce_valeur(col, valeur: Any) -> Any:
    """Convertit les chaînes ISO du desktop en types date/heure (meilleur effort).

    Une valeur illisible est telle quelle : le rejet éventuel est capturé en
    `rejected` (raison `erreur_application`) sans faire échouer le batch.
    """
    if isinstance(valeur, str):
        type_col = col.type
        try:
            if isinstance(type_col, sa.Date) and len(valeur) >= 10:
                return date.fromisoformat(valeur[:10])
            if isinstance(type_col, sa.Time):
                return time.fromisoformat(valeur)
            if isinstance(type_col, sa.DateTime):
                dt = datetime.fromisoformat(valeur.replace("Z", "+00:00"))
                if dt.tzinfo is not None:
                    dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
                return dt
        except ValueError:
            return valeur
    return valeur


def _valeurs_payload(model: type, payload: dict[str, Any] | None) -> dict[str, Any]:
    """Filtre le payload aux colonnes réelles de la table (sans les colonnes
    réservées au serveur) et convertit les dates/heures ISO."""
    colonnes = {c.name: c for c in model.__table__.columns}
    valeurs: dict[str, Any] = {}
    for nom, valeur in (payload or {}).items():
        if nom in colonnes and nom not in COLONNES_SERVEUR:
            valeurs[nom] = _coerce_valeur(colonnes[nom], valeur)
    return valeurs


async def _trouve_ligne(db: AsyncSession, model: type, entreprise_id: int, entity_id: str):
    """Cherche la ligne serveur pour une entité desktop, TOUJOURS scopée au
    tenant : aucune manipulation cross-entreprise possible via `client_ref`.

    1) par `client_ref` (UUID généré côté client) ;
    2) sinon par PK si `entity_id` est numérique (lignes créées côté web).
    """
    ligne = (
        await db.execute(
            select(model)
            .where(model.entreprise_id == entreprise_id, model.client_ref == entity_id)
            .limit(1)
        )
    ).scalar_one_or_none()
    if ligne is not None:
        return ligne
    if entity_id.isdigit():
        return (
            await db.execute(
                select(model)
                .where(model.entreprise_id == entreprise_id, model.id == int(entity_id))
                .limit(1)
            )
        ).scalar_one_or_none()
    return None


@router.post("/push")
async def sync_push(payload: SyncPushRequest, user: SyncUser, db: DbSession):
    """Reçoit un batch de changements desktop et applique le contrat « le web gagne ».

    - Idempotence par (device_id, seq) via la table `sync_applied` (rejeté dans
      `skipped` si déjà traité) — seul un change **appliqué** y est enregistré,
      un conflit ou un rejet reste donc rejouable.
    - `base_version` fournie et ≠ `sync_version` serveur → PAS d'application :
      le change part dans `conflicts` avec `server_record` (la valeur web) que
      le desktop réappliquera en local.
    - Entité inconnue / ligne absente / erreur DB → `rejected` pour CE change
      uniquement : le reste du batch s'applique quand même.
    - Le tenant est imposé par le JWT : les lignes d'une autre entreprise ne
      sont jamais lues ni modifiées.
    """
    entreprise_id = user.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin ne peut pas synchroniser des données d'entreprise",
        )

    applied = 0
    skipped = 0
    applied_changes: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    maintenant = datetime.now(timezone.utc).isoformat()

    for change in payload.changes:
        # --- Idempotence : (device_id, seq) déjà traité ? ---
        deja_traite = (
            await db.execute(
                select(SyncApplied)
                .where(SyncApplied.device_id == payload.device_id, SyncApplied.seq == change.seq)
                .limit(1)
            )
        ).scalar_one_or_none()
        if deja_traite is not None:
            skipped += 1
            continue

        model = ENTITES_SYNC.get(change.entity)
        if model is None:
            rejected.append(
                {
                    "seq": change.seq,
                    "entity": change.entity,
                    "entity_id": change.entity_id,
                    "status": "rejected",
                    "reason": "entite_inconnue",
                }
            )
            continue

        ligne = await _trouve_ligne(db, model, entreprise_id, change.entity_id)

        # --- Règle « le web gagne » : version serveur périmée → conflit ---
        if (
            change.op != "create"
            and ligne is not None
            and change.base_version is not None
            and (ligne.sync_version or 0) != change.base_version
        ):
            conflicts.append(
                {
                    "seq": change.seq,
                    "entity": change.entity,
                    "entity_id": change.entity_id,
                    "server_record": model_to_dict(ligne),
                }
            )
            continue

        # --- delete d'une ligne absente : rien à supprimer (hors tenant ou
        #     déjà purgée) → rejet, jamais de modification involontaire. ---
        if change.op == "delete" and ligne is None:
            rejected.append(
                {
                    "seq": change.seq,
                    "entity": change.entity,
                    "entity_id": change.entity_id,
                    "status": "rejected",
                    "reason": "ligne_absente",
                }
            )
            continue

        try:
            # Savepoint par change : une contrainte violée (unique, FK) ne
            # doit pas empoisonner le reste du batch.
            async with db.begin_nested():
                if ligne is None:
                    # `create` (ou `update` dont la ligne a disparue → create).
                    # L'identité desktop devient la colonne `client_ref`.
                    valeurs = _valeurs_payload(model, change.payload)
                    ligne = model(entreprise_id=entreprise_id, client_ref=change.entity_id, **valeurs)
                    db.add(ligne)
                    await db.flush()
                elif change.op == "delete":
                    # Soft delete (les 3 tables ont `is_deleted`) ; le hook
                    # before_update bump sync_version + sync_updated_at.
                    ligne.is_deleted = True
                    await db.flush()
                else:
                    # `update` (ou `create` déjà connu → upsert par client_ref)
                    for nom, valeur in _valeurs_payload(model, change.payload).items():
                        setattr(ligne, nom, valeur)
                    await db.flush()
                # Déduplication enregistrée UNIQUEMENT sur application réussie.
                db.add(
                    SyncApplied(device_id=payload.device_id, seq=change.seq, applied_at=maintenant)
                )
                await db.flush()
            applied += 1
            applied_changes.append(
                {
                    "seq": change.seq,
                    "entity": change.entity,
                    "entity_id": change.entity_id,
                    "server_id": ligne.id,
                    "op": change.op,
                    "sync_version": ligne.sync_version or 1,
                }
            )
        except Exception as exc:
            logger.warning(
                "sync push: change seq=%s (%s/%s) refusé : %s",
                change.seq, change.entity, change.entity_id, exc,
            )
            rejected.append(
                {
                    "seq": change.seq,
                    "entity": change.entity,
                    "entity_id": change.entity_id,
                    "status": "rejected",
                    "reason": "erreur_application",
                }
            )

    await db.commit()

    return {
        "applied": applied,
        "skipped": skipped,
        "applied_changes": applied_changes,
        "conflicts": conflicts,
        "rejected": rejected,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/pull")
async def sync_pull(
    user: SyncUser,
    db: DbSession,
    since: str | None = None,
    limit: int = Query(200, ge=1),
):
    """Delta web → desktop : lignes des tables synchronisées modifiées depuis `since`.

    - `since` : curseur ISO 8601 UTC renvoyé au pull précédent (filtre strict
      `sync_updated_at > since`) ; absent → tout, limité.
    - `limit` borné à 500 ; ordre stable `sync_updated_at, id` entre les tables.
    - `op` reconstruit : `delete` si `is_deleted`, sinon `update` (+ marqueur
      `created` = ligne jamais modifiée depuis sa création).
    - `cursor` = max(`sync_updated_at`) des changements renvoyés (sinon
      `server_time`) : le prochain `since` étant strict (`>`), aucune ligne
      déjà délivrée n'est renvoyée deux fois.
    """
    entreprise_id = user.get("entreprise_id")
    if not entreprise_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin ne peut pas synchroniser des données d'entreprise",
        )

    limite = min(limit, 500)
    depuis = _parseur_curseur(since) if since else None
    serveur_maintenant = datetime.now(timezone.utc)

    candidats: list[tuple[datetime, int, dict[str, Any]]] = []
    for nom_entite, model in ENTITES_SYNC.items():
        requete = select(model).where(model.entreprise_id == entreprise_id)
        if depuis is not None:
            requete = requete.where(
                model.sync_updated_at.isnot(None),
                model.sync_updated_at > depuis,
            )
        requete = requete.order_by(model.sync_updated_at.asc(), model.id.asc()).limit(limite)
        for ligne in (await db.execute(requete)).scalars().all():
            horodatage = ligne.sync_updated_at or datetime.min  # NULL en tête (MySQL/SQLite)
            candidats.append(
                (
                    horodatage,
                    ligne.id,
                    {
                        "entity": nom_entite,
                        "entity_id": ligne.id,
                        "op": "delete" if ligne.is_deleted else "update",
                        "created": bool(
                            ligne.sync_created_at
                            and ligne.sync_updated_at
                            and ligne.sync_created_at == ligne.sync_updated_at
                        ),
                        "version": ligne.sync_version or 0,
                        "payload": model_to_dict(ligne),
                    },
                )
            )

    # Ordre stable global : sync_updated_at puis id (la clé n'inclut pas le
    # dict → aucun risque de comparaison de dictionaires à égalité).
    candidats.sort(key=lambda candidat: (candidat[0], candidat[1]))
    retenus = candidats[:limite]
    changes = [candidat[2] for candidat in retenus]

    horodatages = [candidat[0] for candidat in retenus if candidat[0] != datetime.min]
    curseur = (
        max(horodatages).replace(tzinfo=timezone.utc).isoformat()
        if horodatages
        else serveur_maintenant.isoformat()
    )

    return {
        "changes": changes,
        "cursor": curseur,
        "server_time": serveur_maintenant.isoformat(),
    }


# ============================================================
# Schémas de synchronisation (endpoints legacy import-sqlite/export)
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
