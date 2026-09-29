#!/usr/bin/env python3
"""Génère le DDL SQLite complet du schéma métier du desktop offline-first.

Source de vérité : les modèles SQLAlchemy de ``Web/backend/app/models``.
Le script importe le package ``app.models`` (ce qui remplit ``Base.metadata``),
traduit chaque table en ``CREATE TABLE IF NOT EXISTS`` + ``CREATE INDEX IF NOT
EXISTS``, puis ajoute en fin de fichier les tables de synchronisation desktop
(UNION manuelle — hors modèles backend, voir docs/plan-desktop-tauri.md §6.1).

Traductions MySQL → SQLite appliquées :
  * BIGINT / INTEGER                    → INTEGER
    (PK entière autoincrement          → INTEGER PRIMARY KEY AUTOINCREMENT)
  * VARCHAR(n) / TEXT                   → TEXT
  * DATETIME / TIMESTAMP / DATE / TIME  → TEXT
  * DECIMAL(p, s)                       → TEXT  (montants stockés tels quels)
  * BOOLEAN                             → INTEGER (0/1)
  * JSON / enum SQLAlchemy               → TEXT
  * FLOAT                               → REAL
  * ForeignKey                          → clause table
    ``FOREIGN KEY (...) REFERENCES ...`` (ON DELETE / ON UPDATE repris si
    SQLite sait les interpréter, sinon omis et commenté ``-- ignoré:``)
  * UniqueConstraint                    → clause ``UNIQUE (...)`` dans le
    CREATE TABLE (les ``unique=True`` en colonne sont dédupliqués)
  * server_default                      → ``DEFAULT ...`` si exprimable en
    SQLite (littéraux, entiers, CURRENT_TIMESTAMP/CURRENT_DATE/CURRENT_TIME),
    sinon omis proprement avec un commentaire ``-- ignoré:``
  * contraintes non portées (CHECK exotiques, index fonctionnels…) →
    comment ``-- ignoré: ...``

Usage (depuis la racine du repo, venv backend activé) :
    . .\\Web\\backend\\env\\Scripts\\Activate.ps1
    python tools/gen_sqlite_schema.py --out desktop/schema_init.sql
    # régénérer par-dessus un fichier existant :
    python tools/gen_sqlite_schema.py --out desktop/schema_init.sql --force
"""

from __future__ import annotations

import argparse
import sys
import warnings
from datetime import datetime
from pathlib import Path

RACINE_REPO = Path(__file__).resolve().parents[1]
DOSSIER_BACKEND = RACINE_REPO / "Web" / "backend"

# ---------------------------------------------------------------------------
# Tables de synchronisation desktop — UNION MANUELLE.
#
# Ces tables n'existent PAS côté backend (elles ne viennent donc pas de
# Base.metadata) : elles appartiennent à la couche desktop — file d'écritures
# en attente (outbox), curseur d'état de sync, journal des conflits « le web
# gagne », et session locale pour le login offline.
# Source : docs/plan-desktop-tauri.md §6.1 + §5.1.
# ---------------------------------------------------------------------------
TABLES_SYNC_DESKTOP = """\
-- ---------------------------------------------------------------------------
-- Tables de synchronisation desktop — UNION MANUELLE
-- (hors modèles backend — source : docs/plan-desktop-tauri.md §6.1 / §5.1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS _sync_outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT NOT NULL, entity_id TEXT NOT NULL, op TEXT NOT NULL, payload TEXT NOT NULL, client_ts TEXT NOT NULL, pushed INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS _sync_state (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS _sync_conflicts (id INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT NOT NULL, entity_id TEXT NOT NULL, local_payload TEXT, server_payload TEXT, detected_at TEXT);
CREATE TABLE IF NOT EXISTS local_session (email TEXT PRIMARY KEY, entreprise_id INTEGER, user_json TEXT, password_hash TEXT, activated_at TEXT);
"""

# Contraintes ON DELETE / ON UPDATE comprises par SQLite.
ACTIONS_SQLITE = {"CASCADE", "SET NULL", "SET DEFAULT", "NO ACTION", "RESTRICT"}

# Fonctions serveur connues de SQLite, traduites depuis func.now() & co.
FONCTIONS_SQLITE = {
    "now": "CURRENT_TIMESTAMP",
    "current_timestamp": "CURRENT_TIMESTAMP",
    "current_date": "CURRENT_DATE",
    "current_time": "CURRENT_TIME",
}


def _abandonner_dependances(exc: BaseException) -> None:
    """Message d'erreur clair si les dépendances backend sont indisponibles."""
    venv_actif = sys.prefix != sys.base_prefix
    lignes = [
        "",
        "ERREUR : impossible de charger les modèles du backend (app.models).",
        f"  Cause : {type(exc).__name__}: {exc}",
        "",
    ]
    if not venv_actif:
        lignes.append(
            "  → Aucun venv détecté : le venv backend (Web/backend/env) n'est pas activé."
        )
        lignes.append("")
    lignes += [
        "  Lancer ce script depuis la racine du repo, avec le venv backend activé :",
        f"      cd \"{RACINE_REPO}\"",
        r"      . .\Web\backend\env\Scripts\Activate.ps1",
        "      python tools/gen_sqlite_schema.py --out desktop/schema_init.sql",
        "",
    ]
    sys.stderr.write("\n".join(lignes))
    sys.exit(2)


# SQLAlchemy n'est présent que dans le venv backend → import gardé.
try:
    import sqlalchemy as sa
except ImportError as exc:  # pragma: no cover - dépend de l'environnement
    _abandonner_dependances(exc)


def charger_metadata():
    """Insère Web/backend dans sys.path, importe app.models, renvoie Base.metadata."""
    if not (DOSSIER_BACKEND / "app" / "models").is_dir():
        sys.stderr.write(
            "\nERREUR : dossier de modèles introuvable : "
            f"{DOSSIER_BACKEND / 'app' / 'models'}\n"
            "  Lancer ce script depuis la racine du repo "
            "(tools/gen_sqlite_schema.py attend Web/backend à côté de tools/).\n\n"
        )
        sys.exit(2)
    if str(DOSSIER_BACKEND) not in sys.path:
        sys.path.insert(0, str(DOSSIER_BACKEND))
    try:
        import app.models  # noqa: F401  — enregistre tous les modèles dans Base.metadata
        from app.database import Base
    except Exception as exc:
        _abandonner_dependances(exc)
    return Base.metadata


def _q(nom: str) -> str:
    """Quote un identifiant pour SQLite (guillemets doubles)."""
    return '"' + str(nom).replace('"', '""') + '"'


def _type_sqlite(type_sa) -> str:
    """Traduit un type SQLAlchemy (dialecte MySQL sous-jacent) vers un type SQLite.

    L'ordre des isinstance est important : Enum hérite de String,
    Boolean hérite d'Integer et Float hérite de Numeric.
    """
    if isinstance(type_sa, sa.Enum):  # enum SQLAlchemy → TEXT (pas de CHECK exotic)
        return "TEXT"
    if isinstance(type_sa, sa.JSON):
        return "TEXT"
    if isinstance(type_sa, sa.Boolean):
        return "INTEGER"
    if isinstance(type_sa, (sa.DateTime, sa.Date, sa.Time)):
        return "TEXT"
    if isinstance(type_sa, sa.Float):
        return "REAL"
    if isinstance(type_sa, sa.Numeric):  # DECIMAL(p, s) → TEXT (consignes)
        return "TEXT"
    if isinstance(type_sa, sa.Integer):  # BigInteger / SmallInteger / Integer
        return "INTEGER"
    if isinstance(type_sa, sa.LargeBinary):
        return "BLOB"
    # String, Text, Unicode, Uuid, Interval, ARRAY, types inconnus → TEXT
    return "TEXT"


def _defaut_sqlite(col, type_sql: str) -> tuple[str | None, str | None]:
    """Rend le server_default en SQL SQLite.

    Renvoie (fragment_SQL, None) si exprimable, ou (None, motif_d_omission).
    """
    sd = col.server_default
    if sd is None:
        return None, None
    arg = getattr(sd, "arg", sd)

    # Littéraux Python (cas le plus fréquent : server_default="0", "Madagascar"…)
    if isinstance(arg, bool):
        return ("1" if arg else "0"), None
    if isinstance(arg, (int, float)):
        return str(arg), None
    if isinstance(arg, str):
        brut = arg.strip()
        # Colonne numérique/entière avec défaut numérique → littéral nu.
        if type_sql in ("INTEGER", "REAL") and brut.replace(".", "", 1).replace("-", "", 1).isdigit():
            return brut, None
        return "'" + arg.replace("'", "''") + "'", None

    # Expressions SQL : uniquement les fonctions date/heure connues de SQLite.
    nom_fonction = str(getattr(arg, "name", "") or "").lower()
    if nom_fonction in FONCTIONS_SQLITE:
        return FONCTIONS_SQLITE[nom_fonction], None
    if callable(getattr(arg, "compile", None)):
        return None, f"expression {nom_fonction or type(arg).__name__!r} non applicable à SQLite"
    if hasattr(arg, "text"):  # text(...) brut non vérifiable
        return None, f"expression texte non vérifiée ({arg.text!r})"
    return None, f"valeur de type {type(arg).__name__} non exprimable"


def _clause_fk(fc) -> list[str]:
    """Contrainte ForeignKeyConstraint → clause table SQLite (+ comments d'ignoré)."""
    colonnes = [_q(e.parent.name) for e in fc.elements]
    refs = []
    for e in fc.elements:
        pleine = getattr(e, "target_fullname", "") or ""
        _table, _sep, col_ref = pleine.partition(".")
        refs.append(_q(col_ref or pleine))
    table_cible, _s, _c = (
        getattr(fc.elements[0], "target_fullname", "") or ""
    ).partition(".")

    morceaux = [
        f"FOREIGN KEY ({', '.join(colonnes)}) "
        f"REFERENCES {_q(table_cible)} ({', '.join(refs)})"
    ]
    commentaires: list[str] = []

    on_delete = getattr(fc, "ondelete", None) or getattr(
        fc.elements[0], "ondelete", None
    )
    on_update = getattr(fc, "onupdate", None) or getattr(
        fc.elements[0], "onupdate", None
    )
    for libelle, valeur in (("ON DELETE", on_delete), ("ON UPDATE", on_update)):
        if not valeur:
            continue
        if isinstance(valeur, str) and valeur.strip().upper() in ACTIONS_SQLITE:
            # SQLite comprend CASCADE / SET NULL / RESTRICT / NO ACTION / SET DEFAULT.
            morceaux.append(f"{libelle} {valeur.strip().upper()}")
        else:
            commentaires.append(
                f"-- ignoré: {libelle}={valeur!r} sur FK ({', '.join(colonnes)}) "
                "non applicable à SQLite"
            )
    return [" ".join(morceaux)] + commentaires


def _generer_index(idx) -> str:
    """Index SQLAlchemy → CREATE [UNIQUE] INDEX IF NOT EXISTS (ou -- ignoré:)."""
    try:
        elements = list(idx.columns)
    except Exception as exc:  # pragma: no cover - index exotiques
        return f"-- ignoré: index « {idx.name} » inexploitable ({type(exc).__name__})"
    if not all(isinstance(e, sa.Column) for e in elements):
        return f"-- ignoré: index fonctionnel « {idx.name} » non porté vers SQLite"
    uniq = "UNIQUE " if idx.unique else ""
    cols = ", ".join(_q(e.name) for e in elements)
    return (
        f"CREATE {uniq}INDEX IF NOT EXISTS {_q(idx.name)} "
        f"ON {_q(idx.table.name)} ({cols});"
    )


def _generer_bloc_table(table) -> str:
    """CREATE TABLE IF NOT EXISTS + index d'une table SQLAlchemy, en SQL SQLite."""
    pk = [c for c in table.columns if c.primary_key]
    # PK entière unique (BigInteger inclus) → alias de rowid → AUTOINCREMENT.
    autoincrement = (
        len(pk) == 1
        and isinstance(pk[0].type, sa.Integer)
        and pk[0].autoincrement is not False
    )

    items: list[str] = []
    uniques_vus: set[frozenset[str]] = set()

    for col in table.columns:
        type_sql = _type_sqlite(col.type)
        if autoincrement and col is pk[0]:
            items.append(f"{_q(col.name)} INTEGER PRIMARY KEY AUTOINCREMENT")
            continue
        morceaux = [_q(col.name), type_sql]
        if len(pk) == 1 and col.primary_key:
            morceaux.append("PRIMARY KEY")
        if not col.nullable:
            morceaux.append("NOT NULL")
        if col.unique:
            morceaux.append("UNIQUE")
            uniques_vus.add(frozenset({col.name}))
        defaut, motif = _defaut_sqlite(col, type_sql)
        if defaut is not None:
            morceaux.append(f"DEFAULT {defaut}")
        elif motif is not None:
            morceaux.append(
                f"-- ignoré: server_default de {col.name} omis : {motif}"
            )
        items.append(" ".join(morceaux))

    # PK composite → clause table (SQLite refuse l'AUTOINCREMENT composite).
    if len(pk) > 1:
        items.append(
            "PRIMARY KEY (" + ", ".join(_q(c.name) for c in pk) + ")"
        )

    # Contraintes (UNIQUE, FK, CHECK…) dans un ordre déterministe.
    for contrainte in sorted(
        table.constraints, key=lambda c: (type(c).__name__, c.name or "")
    ):
        if isinstance(contrainte, sa.PrimaryKeyConstraint):
            continue  # déjà traité colonne par colonne
        if isinstance(contrainte, sa.UniqueConstraint):
            noms = frozenset(c.name for c in contrainte.columns)
            if noms in uniques_vus:
                continue  # doublon du unique=True déjà émis en colonne
            uniques_vus.add(noms)
            cols = ", ".join(_q(c.name) for c in contrainte.columns)
            if contrainte.name:
                items.append(f"CONSTRAINT {_q(contrainte.name)} UNIQUE ({cols})")
            else:
                items.append(f"UNIQUE ({cols})")
        elif isinstance(contrainte, sa.ForeignKeyConstraint):
            items.extend(_clause_fk(contrainte))
        elif isinstance(contrainte, sa.CheckConstraint):
            items.append(
                "-- ignoré: contrainte CHECK "
                f"« {contrainte.name or '?'} » non portée vers SQLite"
            )
        else:
            items.append(
                "-- ignoré: contrainte "
                f"{type(contrainte).__name__} non portée vers SQLite"
            )

    # Rendu : virgule après chaque élément réel sauf le dernier, les commentaires
    # -- ignoré: ne portent jamais de virgule (ils avaleraient la ponctuation).
    reels = [i for i, it in enumerate(items) if not it.lstrip().startswith("--")]
    dernier_reel = reels[-1] if reels else -1
    lignes_corps: list[str] = []
    for i, it in enumerate(items):
        if it.lstrip().startswith("--"):
            lignes_corps.append("    " + it)
            continue
        virgule = "" if i == dernier_reel else ","
        if " -- " in it:  # définition suivie de son commentaire d'ignoré
            tete, queue = it.split(" -- ", 1)
            lignes_corps.append(f"    {tete}{virgule} -- {queue}")
        else:
            lignes_corps.append(f"    {it}{virgule}")

    entete = f"-- Table « {table.name} »"
    if table.comment:
        entete += f" — {table.comment}"
    bloc = (
        f"{entete}\n"
        f"CREATE TABLE IF NOT EXISTS {_q(table.name)} (\n"
        + "\n".join(lignes_corps)
        + "\n);"
    )

    index_lignes = [
        _generer_index(ix)
        for ix in sorted(table.indexes, key=lambda ix: ix.name or "")
    ]
    if index_lignes:
        bloc += "\n" + "\n".join(index_lignes)
    return bloc


def _tables_triées(metadata) -> tuple[list, str | None]:
    """Tables dans l'ordre topologique des FK, avec repli si cycle strict.

    Un cycle FK (ex. clients ↔ utilisateurs) n'est pas bloquant : SQLite ne
    valide les clés étrangères qu'à l'INSERT, pas au CREATE TABLE. Le warning
    SQLAlchemy est alors reporté en commentaire dans l'en-tête du SQL généré.
    """
    with warnings.catch_warnings(record=True) as avertissements:
        warnings.simplefilter("always")
        try:
            tables = list(metadata.sorted_tables)
        except Exception as exc:  # pragma: no cover - cycle non géré
            tables = sorted(metadata.tables.values(), key=lambda t: t.name)
            return (
                tables,
                f"-- Note : tri topologique impossible ({type(exc).__name__}: {exc}) "
                "→ ordre alphabétique. SQLite ne valide les FK qu'à l'INSERT.",
            )
    if avertissements:
        return (
            tables,
            "-- Note : cycles de FK non ordonnables (clients ↔ utilisateurs) — "
            "sans impact sous SQLite, qui ne valide les FK qu'à l'INSERT.",
        )
    return tables, None


def generer_sql(metadata) -> str:
    """Assemble le fichier SQL complet (entête + backend + tables sync)."""
    tables, note_tri = _tables_triées(metadata)
    date_fr = datetime.now().strftime("%d/%m/%Y %H:%M")

    entetes = [
        "-- Généré par tools/gen_sqlite_schema.py — source de vérité : "
        "Web/backend app/models. Ne pas éditer à la main.",
        f"-- Date de génération : {date_fr}",
        f"-- Tables backend : {len(tables)} · Tables sync desktop : 4 "
        "(UNION manuelle, voir la fin du fichier)",
        "-- Régénérer : python tools/gen_sqlite_schema.py "
        "--out desktop/schema_init.sql --force",
    ]
    if note_tri:
        entetes.append(note_tri)

    blocs = [_generer_bloc_table(t) for t in tables]
    return "\n".join(entetes) + "\n\n" + "\n\n".join(blocs) + "\n\n" + TABLES_SYNC_DESKTOP


def main() -> None:
    # Console Windows potentiellement en cp1252 : on force UTF-8 pour les
    # messages FR (accents, →) sans planter sur l'encodage de sortie.
    for flux in (sys.stdout, sys.stderr):
        reconfigure = getattr(flux, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(
        description=(
            "Génère le DDL SQLite du schéma métier à partir des modèles "
            "SQLAlchemy du backend (Web/backend/app/models)."
        )
    )
    parser.add_argument(
        "--out",
        default="desktop/schema_init.sql",
        help="fichier de sortie (défaut : desktop/schema_init.sql)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="écrase le fichier de sortie s'il existe déjà",
    )
    args = parser.parse_args()

    sortie = Path(args.out)
    if sortie.exists() and not args.force:
        sys.stderr.write(
            f"ERREUR : {sortie} existe déjà — refus d'écraser sans consentement.\n"
            "  Passer --force pour régénérer : "
            f"python tools/gen_sqlite_schema.py --out {args.out} --force\n"
        )
        sys.exit(1)

    metadata = charger_metadata()
    try:
        sql = generer_sql(metadata)
    except Exception as exc:
        sys.stderr.write(
            "\nERREUR : échec de la génération du DDL SQLite.\n"
            f"  Cause : {type(exc).__name__}: {exc}\n"
            "  Vérifier l'installation du venv backend "
            "(pip install -r Web/backend/requirements.txt) puis relancer.\n\n"
        )
        sys.exit(3)

    sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie.write_text(sql, encoding="utf-8")

    nb_tables = len(metadata.tables)
    nb_index = sql.count("INDEX IF NOT EXISTS")
    nb_ignores = sql.count("-- ignoré:")
    print(
        f"OK : {nb_tables} tables backend + 4 tables sync desktop "
        f"= {nb_tables + 4} tables → {sortie} "
        f"({nb_index} index, {nb_ignores} élément(s) ignoré(s))"
    )


if __name__ == "__main__":
    main()
