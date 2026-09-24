"""Hooks SQLAlchemy génériques pour les colonnes de synchronisation desktop.

Positionnés sur les 3 tables synchronisées (pointages, chantiers, employes),
ils garantissent que TOUTE écriture serveur — insert/update émis par le sync
desktop comme par le web (React) — met à jour les colonnes de sync :

- ``sync_created_at`` : positionné à l'insertion (s'il était encore vide).
- ``sync_updated_at``  : remis à jour à chaque update → c'est le filtre du
  ``GET /api/sync/pull?since=…`` (curseur ISO 8601 UTC).
- ``sync_version``     : incrémentée à chaque update → c'est la détection
  « le web gagne » du ``POST /api/sync/push`` (base_version côté client).

Les hooks sont conditionnés à la présence des attributs (``hasattr``) pour
rester inoffensifs si un modèle est enregistré sans les colonnes de sync.

Importés depuis ``app/models/__init__.py`` : tout import de modèle actives
les écouteurs, quel que soit le point d'entrée (app, scripts, tests, alembic).
"""
from datetime import datetime, timezone

from sqlalchemy import event

from app.models.chantier import Chantier
from app.models.employe import Employe
from app.models.pointage import Pointage

# PHASE 4 : ajouter ici les modèles supplémentaires branchés à la sync.

# Les modèles cibles (importés ci-dessus) : n'importe quel import de modèle
# charge ce module via app.models.__init__ — donc les hooks sont toujours actifs.
SYNC_MODELS = (Pointage, Chantier, Employe)


def _maintenant_utc() -> datetime:
    """Horloge serveur en UTC naïf (colonne DATETIME sans fuseau)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _sync_before_insert(mapper, connection, target) -> None:
    """Fixe sync_created_at + sync_updated_at à chaque INSERT serveur."""
    ts = _maintenant_utc()
    if hasattr(target, "sync_created_at") and target.sync_created_at is None:
        target.sync_created_at = ts
    if hasattr(target, "sync_updated_at"):
        # Même horodatage que sync_created_at : permet de reconstruire le
        # marqueur « created » côté pull.
        target.sync_updated_at = ts


def _sync_before_update(mapper, connection, target) -> None:
    """À chaque UPDATE serveur : remet à jour l'horodatage et incrémente la version.

    Concerne aussi les écritures « web » classiques (écrans React) : sans ce
    bump, un desktop qui pousse un ``base_version`` périmé ne serait pas détecté
    en conflit puisque la version n'aurait pas bougé côté serveur.
    """
    if hasattr(target, "sync_updated_at"):
        target.sync_updated_at = _maintenant_utc()
    if hasattr(target, "sync_version"):
        target.sync_version = (target.sync_version or 0) + 1


# Enregistrement : event.listens_for cible UNIQUE par appel (pas de liste).
# Le module n'est importé qu'une fois → pas de double enregistrement.
for _modele in SYNC_MODELS:
    event.listens_for(_modele, "before_insert")(_sync_before_insert)
    event.listens_for(_modele, "before_update")(_sync_before_update)
del _modele
