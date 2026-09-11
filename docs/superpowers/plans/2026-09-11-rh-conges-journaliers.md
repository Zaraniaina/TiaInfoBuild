# RH Congés & Journaliers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combler le module RH : congés/absences avec workflow de validation, employés journaliers (mode de rémunération), suivi CNAPS/OSTIE, documents RH, badge imprimable, rapport de paie calculé à la volée.

**Architecture:** Ajout additif au backend FastAPI existant (nouveau modèle `Conge` + colonnes sur `Employe`/`Document`, CRUD hérité de `BaseCRUD`, endpoints dans `routers/rh.py` et `routers/employe_terrain.py`). Frontend React : onglet Congés dans `RhPage`, page `EmployeCongesPage` dans l'espace terrain, badge imprimable. Solde de congés **calculé** (jamais stocké) = `solde_conges_annuel` − jours validés de l'année courante.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 async + Alembic + MySQL, Pydantic v2, React 18 + TypeScript + Bootstrap, pytest + aiosqlite + httpx (tests async SQLite en mémoire).

**Spec:** `docs/superpowers/specs/2026-09-11-rh-conges-journaliers-design.md` (à lire avec ce plan)

## Global Constraints

- Convention de noms : tables/colonnes en français, snake_case. Statuts en français sans accent (`en_attente`, `valide`, `refuse`, `annule`).
- Migration Alembic : fichier `020_rh_conges_employe.py`, `down_revision = "019_<nom_actuel>"` (vérifier le vrai nom du 019 avec `ls Web/backend/alembic/versions`), **idempotente** (gardes `_table_exists` / colonnes inspectées comme dans `017_espace_terrain.py`).
- Toute requête doit filtrer `is_deleted == False` et scoper par `entreprise_id` du token.
- Permissions backend : format `rh:read` / `rh:write` via `_require_permission(payload, ...)` (copié en tête de chaque router, déjà présent dans `rh.py` et `employe_terrain.py`). `Role.RH` a déjà `rh:read/write/delete` + `pointage:write` ; `Role.EMPLOYE` a déjà `employe_terrain:read/write` + `rh:read` → **aucun changement de `core/permissions.py` nécessaire**.
- Endpoints terrain self-only : l'employé ne peut agir que sur sa propre fiche, résolue par email via le helper existant `_get_employe(payload, db)` de `employe_terrain.py`.
- Montants en Ariary : `Numeric(12, 2)`, affichage sans centimes.
- Soft-delete uniquement (`is_deleted = True`), jamais de `DELETE` physique.
- Frontend : services dans `src/services/`, types dans `src/types`, pages lazy-loadées dans `App.tsx`, permission côté client via `utils/permissions.ts` (`PERMISSION_MAP`).
- Aucun bulletin de paie stocké : le rapport de paie est **calculé à la volée** (GET), export CSV via `StreamingResponse`.
- Vérification backend sans serveur : `python -c "from app.main import app"` doit passer ; tests pytest avec SQLite async (voir Task 0) — ne jamais se connecter au MySQL de dev depuis les tests.

---

## File Structure (décisions verrouillées)

```
Web/backend/
  alembic/versions/020_rh_conges_employe.py     # NOUVEAU : table conges + colonnes employes/documents
  app/models/conge.py                           # NOUVEAU : modèle Conge
  app/models/employe.py                         # MODIF : +8 colonnes (mode_remuneration, taux, cnaps, ostie…)
  app/models/document.py                        # MODIF : + employe_id (nullable) + index
  app/models/__init__.py                        # MODIF : export Conge
  app/schemas/conge.py                          # NOUVEAU : CongeCreate/Update/Response/List
  app/schemas/employe.py                        # MODIF : champs étendus + validateurs
  app/crud/conge.py                             # NOUVEAU : CongeCRUD(BaseCRUD) + requêtes métier
  app/routers/rh.py                             # MODIF : endpoints /conges + /paie
  app/routers/employe_terrain.py                # MODIF : endpoints /conges self-only
  tests/conftest.py                             # NOUVEAU : fixtures async SQLite + client httpx
  tests/test_rh_conges.py                       # NOUVEAU : tests TDD endpoints RH
  tests/test_employe_terrain_conges.py          # NOUVEAU : tests TDD endpoints terrain
Web/frontend/src/
  types/index.ts                                # MODIF : types Conge + Employe étendu
  services/rh.service.ts                        # MODIF : congés + paie
  services/employe-terrain.service.ts           # MODIF : congés self-only (si le fichier existe — sinon créer)
  pages/rh/RhPage.tsx                           # MODIF : onglet Congés & Absences + paie
  pages/rh/EmployeFormModal.tsx                 # NOUVEAU (si le form est inline dans RhPage, extraire ou étendre inline)
  pages/employe/EmployeCongesPage.tsx           # NOUVEAU : demande + solde + suivi
  pages/employe/EmployeBadgePage.tsx            # MODIF : badge imprimable photo + QR
  utils/permissions.ts                          # MODIF : entrées conges/paie
  App.tsx                                       # MODIF : route /employe/conges + lazy import
```

---

### Task 0: Infrastructure de tests backend (fixtures async SQLite + client httpx)

Le backend n'a **aucun test** aujourd'hui. On crée l'infra minimale : SQLite en mémoire (aiosqlite) + override de `DbDep` + client httpx authentifié par rôle. La DB de dev (MySQL XAMPP) n'est jamais touchée.

**Files:**
- Create: `Web/backend/tests/__init__.py` (fichier vide)
- Create: `Web/backend/tests/conftest.py`
- Create: `Web/backend/tests/test_smoke.py`

**Interfaces:**
- Produces (utilisées par Tasks 5–7) :
  - fixture `db_session: AsyncSession` (SQLite mémoire, schéma complet via `Base.metadata.create_all`)
  - fixture `client_factory` : `async def _make(role_code: str, entreprise_id: int = 1, user_email: str | None = None) -> AsyncClient` — injecte un payload `CurrentUserPayload` factice par override de dépendance

- [ ] **Step 1: Identifier les noms réels des dépendances**

Run: `Select-String -Path Web\backend\app\security.py -Pattern "DbDep|CurrentUserPayload|def get|Depends"`
Notez le nom exact de la fonction qui fournit la session (`get_db` probable) et celle qui fournit le payload JWT — les imports du conftest en dépendent. Ajuster le Step 2 en conséquence.

- [ ] **Step 2: Écrire `tests/conftest.py`**

```python
"""Fixtures de test : SQLite async en mémoire + client httpx authentifié."""
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.database import Base, get_db  # ajuster le nom de get_db si différent
import app.models  # noqa: F401 — enregistre tous les modèles dans Base.metadata
from app.main import app
import app.security as security


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def client_factory(db_session: AsyncSession):
    """Retourne une factory de clients httpx authentifiés par rôle."""
    async def _make(role_code: str, entreprise_id: int = 1, user_email: str | None = None):
        class _U:
            email = user_email
        payload = {
            "role_code": role_code,
            "entreprise_id": entreprise_id,
            "user": _U() if user_email else None,
        }
        app.dependency_overrides[get_db] = lambda: db_session
        dep_fn = security.get_current_user_payload  # AJUSTER au nom réel (étape 1)
        app.dependency_overrides[dep_fn] = lambda: payload
        return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    return _make
```

⚠️ Ajuster les deux imports signalés au nom réel trouvé à l'étape 1 ; ne pas garder les commentaires « AJUSTER ».

- [ ] **Step 3: Test de fumée (DB + modèle)**

```python
# tests/test_smoke.py
from sqlalchemy import select
from app.models.entreprise import Entreprise


async def test_smoke_db(db_session):
    db_session.add(Entreprise(nom="Test BTP"))
    await db_session.flush()
    rows = (await db_session.execute(select(Entreprise))).scalars().all()
    assert len(rows) == 1 and rows[0].nom == "Test BTP"
```

Run: `cd Web\backend; python -m pytest tests/test_smoke.py -v`
Expected: **PASS**. Si `app/database.py` tente de se connecter à MySQL à l'import, exporter `DATABASE_URL=sqlite+aiosqlite://` dans le conftest **avant** l'import de `app.database` (via `os.environ.setdefault` en toute première ligne).

- [ ] **Step 4: Commit**

```bash
git add Web/backend/tests
git commit -m "test: infra de tests backend (sqlite async + client auth)"
```

---

### Task 1: Migration Alembic `020_rh_conges_employe`

**Files:**
- Create: `Web/backend/alembic/versions/020_rh_conges_employe.py`

**Interfaces:**
- Produces (état du schéma attendu par les Tasks 2+) :
  - table `conges` : id, entreprise_id, employe_id, type, date_debut, date_fin, nb_jours, statut, motif, valide_par, date_validation, commentaire_refus, is_deleted, created_at, updated_at
  - `employes` + : `mode_remuneration` (String(20), default `mensuel`), `taux_journalier`, `taux_horaire`, `prix_tache` (Numeric(12,2), nullables), `numero_cnaps`, `numero_ostie` (String(50), nullables), `statut_declaration` (String(20), default `non_declare`), `solde_conges_annuel` (Numeric(5,1), default `30`)
  - `documents` + : `employe_id` (BigInteger, FK employes.id, nullable) + index `idx_documents_employe_id`

- [ ] **Step 1: Écrire la migration (idempotente, pattern 017)**

```python
"""vingtieme migration: rh - conges, journaliers, cnaps/ostie, documents rh

Revision ID: 020_rh_conges_employe
Revises: 019_add_platform_settings_table
Create Date: 2026-09-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "020_rh_conges_employe"
down_revision: Union[str, None] = "019_add_platform_settings_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(insp, name: str) -> bool:
    try:
        return name in insp.get_table_names()
    except Exception:
        return False


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if not _table_exists(insp, "conges"):
        op.create_table(
            "conges",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column("entreprise_id", sa.Integer(), sa.ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True),
            sa.Column("employe_id", sa.Integer(), sa.ForeignKey("employes.id", ondelete="CASCADE"), nullable=False),
            sa.Column("type", sa.String(30), server_default="annuel"),
            sa.Column("date_debut", sa.Date(), nullable=False),
            sa.Column("date_fin", sa.Date(), nullable=False),
            sa.Column("nb_jours", sa.Numeric(5, 1), nullable=False),
            sa.Column("statut", sa.String(20), server_default="en_attente"),
            sa.Column("motif", sa.Text(), nullable=True),
            sa.Column("valide_par", sa.Integer(), sa.ForeignKey("utilisateurs.id", ondelete="SET NULL"), nullable=True),
            sa.Column("date_validation", sa.DateTime(), nullable=True),
            sa.Column("commentaire_refus", sa.Text(), nullable=True),
            sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        )
        op.create_index("idx_conges_entreprise_id", "conges", ["entreprise_id"])
        op.create_index("idx_conges_employe_id", "conges", ["employe_id"])
        op.create_index("idx_conges_statut", "conges", ["statut"])
    # 2. colonnes employes
    cols_emp = {c["name"] for c in insp.get_columns("employes")}
    new_emp = {
        "mode_remuneration": sa.Column("mode_remuneration", sa.String(20), server_default="mensuel"),
        "taux_journalier": sa.Column("taux_journalier", sa.Numeric(12, 2), nullable=True),
        "taux_horaire": sa.Column("taux_horaire", sa.Numeric(12, 2), nullable=True),
        "prix_tache": sa.Column("prix_tache", sa.Numeric(12, 2), nullable=True),
        "numero_cnaps": sa.Column("numero_cnaps", sa.String(50), nullable=True),
        "numero_ostie": sa.Column("numero_ostie", sa.String(50), nullable=True),
        "statut_declaration": sa.Column("statut_declaration", sa.String(20), server_default="non_declare"),
        "solde_conges_annuel": sa.Column("solde_conges_annuel", sa.Numeric(5, 1), server_default="30"),
    }
    for name, col in new_emp.items():
        if name not in cols_emp:
            op.add_column("employes", col)

    # 3. documents -> employe
    cols_doc = {c["name"] for c in insp.get_columns("documents")}
    if "employe_id" not in cols_doc:
        op.add_column("documents", sa.Column("employe_id", sa.BigInteger(), nullable=True))
        op.create_foreign_key("fk_documents_employe", "documents", "employes", ["employe_id"], ["id"], ondelete="CASCADE")
        op.create_index("idx_documents_employe_id", "documents", ["employe_id"])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    cols_doc = {c["name"] for c in insp.get_columns("documents")}
    if "employe_id" in cols_doc:
        op.drop_index("idx_documents_employe_id", table_name="documents")
        op.drop_constraint("fk_documents_employe", "documents", type_="foreignkey")
        op.drop_column("documents", "employe_id")

    cols_emp = {c["name"] for c in insp.get_columns("employes")}
    for col in ("solde_conges_annuel", "statut_declaration", "numero_ostie", "numero_cnaps",
                "prix_tache", "taux_horaire", "taux_journalier", "mode_remuneration"):
        if col in cols_emp:
            op.drop_column("employes", col)

    if _table_exists(insp, "conges"):
        op.drop_table("conges")
```

- [ ] **Step 2: Vérifier la chaîne de révisions (une seule tête)**

Run: `cd Web\backend; python -c "from alembic.config import Config; from alembic.script import ScriptDirectory; print(ScriptDirectory.from_config(Config('alembic.ini')).get_heads())"`
Expected: `['020_rh_conges_employe']`

- [ ] **Step 3: Appliquer sur la DB de dev**

Run: `cd Web\backend; alembic upgrade head`
Expected: OK sans erreur (MySQL XAMPP doit tourner).

- [ ] **Step 4: Commit**

```bash
git add Web/backend/alembic/versions/020_rh_conges_employe.py
git commit -m "feat(rh): migration 020 - conges, journaliers, cnaps/ostie"
```

---

### Task 2: Modèle `Conge` + extension `Employe` + `Document.employe_id`

**Files:**
- Create: `Web/backend/app/models/conge.py`
- Modify: `Web/backend/app/models/employe.py` (ajout de 8 colonnes, après `adresse`, avant `statut`)
- Modify: `Web/backend/app/models/document.py` (ajout `employe_id`)
- Modify: `Web/backend/app/models/__init__.py` (export `Conge`)

**Interfaces:**
- Produces : `Conge(entreprise_id, employe_id, type, date_debut, date_fin, nb_jours, statut, motif, valide_par, date_validation, commentaire_refus, is_deleted, created_at, updated_at)` — relation `Conge.employe` (lazy selectin), `Employe.conges` (back_populates)
- Produces : colonnes `Employe.mode_remuneration, taux_journalier, taux_horaire, prix_tache, numero_cnaps, numero_ostie, statut_declaration, solde_conges_annuel`
- Produces : `Document.employe_id` nullable

- [ ] **Step 1: Écrire `app/models/conge.py`**

```python
"""Modèle Conge (demandes de congés & absences, module RH)."""
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.employe import Employe


class Conge(Base):
    """Demande de congé d'un employé, avec workflow RH (validation)."""

    __tablename__ = "conges"

    TYPE_ANNUEL = "annuel"
    TYPE_MALADIE = "maladie"
    TYPE_MATERNITE = "maternite"
    TYPE_EXCEPTIONNEL = "exceptionnel"
    TYPE_SANS_SOLDE = "sans_solde"

    STATUT_EN_ATTENTE = "en_attente"
    STATUT_VALIDE = "valide"
    STATUT_REFUSE = "refuse"
    STATUT_ANNULE = "annule"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entreprise_id: Mapped[int | None] = mapped_column(ForeignKey("entreprises.id", ondelete="CASCADE"))
    employe_id: Mapped[int] = mapped_column(ForeignKey("employes.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(30), server_default=TYPE_ANNUEL)
    date_debut: Mapped[date] = mapped_column(Date, nullable=False)
    date_fin: Mapped[date] = mapped_column(Date, nullable=False)
    nb_jours: Mapped[float] = mapped_column(Numeric(5, 1), nullable=False)
    statut: Mapped[str] = mapped_column(String(20), server_default=STATUT_EN_ATTENTE)
    motif: Mapped[str | None] = mapped_column(Text)
    valide_par: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id", ondelete="SET NULL"))
    date_validation: Mapped[datetime | None] = mapped_column(DateTime)
    commentaire_refus: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_conges_entreprise_id", "entreprise_id"),
        Index("idx_conges_employe_id", "employe_id"),
        Index("idx_conges_statut", "statut"),
    )

    employe: Mapped["Employe"] = relationship("Employe", back_populates="conges", lazy="selectin")
```

- [ ] **Step 2: Étendre `Employe` (8 colonnes + relation `conges`)**

Dans `app/models/employe.py`, insérer après la ligne `adresse` :

```python
    mode_remuneration: Mapped[str] = mapped_column(String(20), server_default="mensuel")
    taux_journalier: Mapped[float | None] = mapped_column(Numeric(12, 2))
    taux_horaire: Mapped[float | None] = mapped_column(Numeric(12, 2))
    prix_tache: Mapped[float | None] = mapped_column(Numeric(12, 2))
    numero_cnaps: Mapped[str | None] = mapped_column(String(50))
    numero_ostie: Mapped[str | None] = mapped_column(String(50))
    statut_declaration: Mapped[str] = mapped_column(String(20), server_default="non_declare")
    solde_conges_annuel: Mapped[float] = mapped_column(Numeric(5, 1), server_default="30")
```

Et à la fin de la classe (avec les autres relationships) :

```python
    conges: Mapped[list["Conge"]] = relationship("Conge", back_populates="employe", lazy="selectin")
```

- [ ] **Step 3: Étendre `Document`**

Dans `app/models/document.py`, après `chantier_id` :

```python
    employe_id: Mapped[int | None] = mapped_column(BigInteger)
```

et dans `__table_args__` : `Index("idx_documents_employe_id", "employe_id"),`

- [ ] **Step 4: Exporter `Conge` dans `app/models/__init__.py`**

Ajouter `from app.models.conge import Conge` et l'entrée dans `__all__` (ou la liste d'exports du fichier).

- [ ] **Step 5: Vérifier les imports**

Run: `cd Web\backend; python -c "from app.main import app; from app.models import Conge; print('OK')"`
Expected: `OK` (aucun import MySQL à ce stade ; sinon voir note DATABASE_URL de la Task 0)

- [ ] **Step 6: Commit**

```bash
git add Web/backend/app/models
git commit -m "feat(rh): modele Conge + colonnes journaliers/cnaps sur Employe, documents RH"
```

---

### Task 3: Schémas Pydantic (congé + employé étendu)

**Files:**
- Create: `Web/backend/app/schemas/conge.py`
- Modify: `Web/backend/app/schemas/employe.py`

**Interfaces:**
- Produces (consommés par les routers Tasks 5–7) :
  - `CongeCreate(employe_id: int, type: str, date_debut: date, date_fin: date, nb_jours: float, motif: str | None)`
  - `CongeDecision(commentaire: str | None)`
  - `CongeResponse` / `CongeList` (from_attributes)
  - `EmployeCreate`/`EmployeUpdate`/`EmployeResponse` + champs : `mode_remuneration`, `taux_journalier`, `taux_horaire`, `prix_tache`, `numero_cnaps`, `numero_ostie`, `statut_declaration`, `solde_conges_annuel` ; `type_contrat` accepte en plus `JOURNALIER`

- [ ] **Step 1: Écrire `app/schemas/conge.py`**

```python
"""Schémas Pydantic pour les congés (module RH)."""
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

TYPES_VALIDES = {"annuel", "maladie", "maternite", "exceptionnel", "sans_solde"}


class CongeCreate(BaseModel):
    """Corps de la requête pour créer une demande de congé."""

    employe_id: int = Field(..., ge=1)
    type: str = Field(default="annuel", max_length=30)
    date_debut: date
    date_fin: date
    nb_jours: float = Field(..., gt=0)
    motif: str | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in TYPES_VALIDES:
            raise ValueError(f"Type de congé invalide. Valeurs autorisées: {sorted(TYPES_VALIDES)}")
        return v

    @model_validator(mode="after")
    def validate_dates(self):
        if self.date_fin < self.date_debut:
            raise ValueError("date_fin doit être postérieure ou égale à date_debut")
        return self


class CongeDecision(BaseModel):
    """Corps de la requête pour valider/refuser un congé."""

    commentaire: str | None = None


class CongeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entreprise_id: int | None = None
    employe_id: int
    type: str
    date_debut: date
    date_fin: date
    nb_jours: float
    statut: str
    motif: str | None = None
    valide_par: int | None = None
    date_validation: datetime | None = None
    commentaire_refus: str | None = None
    is_deleted: bool | None = None
    created_at: datetime | None = None
    employe_nom: str | None = None
    employe_prenom: str | None = None


class CongeList(BaseModel):
    """Liste paginée des congés."""

    items: list[CongeResponse]
    total: int
    page: int
    size: int
```

- [ ] **Step 2: Étendre `app/schemas/employe.py`**

Ajouter aux validators de `EmployeCreate` :

```python
    @field_validator("type_contrat")
    @classmethod
    def validate_type_contrat(cls, v: str | None) -> str | None:
        allowed = {"CDI", "CDD", "INTERIM", "STAGE", "TEMPS_PARTIEL", "JOURNALIER"}
        if v is not None and v.upper() not in allowed:
            raise ValueError(f"Type de contrat invalide. Valeurs autorisées: {sorted(allowed)}")
        return v.upper() if v else v
```

⚠️ Ce validator existe déjà avec `allowed` sans `JOURNALIER` : **remplacer** l'existant plutôt que d'ajouter un doublon.

Ajouter aux classes `EmployeCreate`, `EmployeUpdate` et `EmployeResponse` (champs optionnels) :

```python
    mode_remuneration: str | None = Field(default="mensuel", max_length=20)
    taux_journalier: float | None = Field(default=None, ge=0)
    taux_horaire: float | None = Field(default=None, ge=0)
    prix_tache: float | None = Field(default=None, ge=0)
    numero_cnaps: str | None = Field(default=None, max_length=50)
    numero_ostie: str | None = Field(default=None, max_length=50)
    statut_declaration: str | None = Field(default="non_declare", max_length=20)
    solde_conges_annuel: float | None = Field(default=None, ge=0)
```

Plus, dans `EmployeCreate` uniquement :

```python
    @field_validator("mode_remuneration")
    @classmethod
    def validate_mode_remuneration(cls, v: str | None) -> str | None:
        allowed = {"mensuel", "journalier", "horaire", "a_la_tache"}
        if v is not None and v not in allowed:
            raise ValueError(f"Mode de rémunération invalide. Valeurs autorisées: {sorted(allowed)}")
        return v

    @field_validator("statut_declaration")
    @classmethod
    def validate_statut_declaration(cls, v: str | None) -> str | None:
        allowed = {"non_declare", "cnaps", "cnaps_ostie"}
        if v is not None and v not in allowed:
            raise ValueError(f"Statut de déclaration invalide. Valeurs autorisées: {sorted(allowed)}")
        return v
```

- [ ] **Step 3: Vérifier les imports**

Run: `cd Web\backend; python -c "from app.schemas.conge import CongeCreate, CongeList; from app.schemas.employe import EmployeCreate; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add Web/backend/app/schemas
git commit -m "feat(rh): schemas conge + employe etendu (journalier, cnaps/ostie)"
```

---

### Task 4: CRUD `CongeCRUD` + calcul du solde

**Files:**
- Create: `Web/backend/app/crud/conge.py`
- Create: `Web/backend/tests/test_conge_crud.py`

**Interfaces:**
- Consumes : `BaseCRUD` (`app/crud/base.py`), modèle `Conge` (Task 2)
- Produces (consommé par les routers Tasks 5–7) :
  - `CongeCRUD(BaseCRUD)` :
    - `async def list_for_entreprise(db, entreprise_id, *, statut=None, employe_id=None, page=1, size=25) -> tuple[Sequence[Conge], int]`
    - `async def list_for_employe(db, employe_id, *, page=1, size=25) -> tuple[Sequence[Conge], int]`
    - `async def solde_restant(db, employe) -> float` — `solde_conges_annuel − Σ nb_jours (type=annuel, statut=valide, année courante)`
    - `async def decide(db, conge, *, statut: str, valide_par: int | None, commentaire: str | None) -> Conge` — garde anti double-validation (409)

- [ ] **Step 1: Écrire le test d'abord `tests/test_conge_crud.py`**

```python
from datetime import date
from fastapi import HTTPException
import pytest
from sqlalchemy import select

from app.crud.conge import CongeCRUD
from app.models.conge import Conge
from app.models.entreprise import Entreprise
from app.models.employe import Employe


async def _employe(db, **over) -> Employe:
    ent = Entreprise(nom="BTP Test")
    db.add(ent)
    await db.flush()
    emp = Employe(entreprise_id=ent.id, nom="Rakoto", mode_remuneration="journalier",
                  taux_journalier=40000, solde_conges_annuel=30, **over)
    db.add(emp)
    await db.flush()
    return emp


async def test_create_et_solde(db_session):
    emp = await _employe(db_session)
    crud = CongeCRUD()
    c = await crud.create(db_session, {
        "employe_id": emp.id, "type": "annuel", "date_debut": date(2026, 10, 5),
        "date_fin": date(2026, 10, 9), "nb_jours": 5, "statut": "valide",
    })
    assert c.id is not None
    assert await crud.solde_restant(db_session, emp) == 25.0  # 30 - 5


async def test_solde_ignore_refuses_et_autres_types(db_session):
    emp = await _employe(db_session)
    crud = CongeCRUD()
    await crud.create(db_session, {"employe_id": emp.id, "type": "annuel",
                                   "date_debut": date(2026, 10, 5), "date_fin": date(2026, 10, 9),
                                   "nb_jours": 5, "statut": "refuse"})
    await crud.create(db_session, {"employe_id": emp.id, "type": "sans_solde",
                                   "date_debut": date(2026, 10, 5), "date_fin": date(2026, 10, 6),
                                   "nb_jours": 2, "statut": "valide"})
    assert await crud.solde_restant(db_session, emp) == 30.0


async def test_decide_anti_double(db_session):
    emp = await _employe(db_session)
    crud = CongeCRUD()
    c = await crud.create(db_session, {"employe_id": emp.id, "type": "annuel",
                                       "date_debut": date(2026, 10, 5), "date_fin": date(2026, 10, 6),
                                       "nb_jours": 1})
    await crud.decide(db_session, c, statut="valide", valide_par=1, commentaire=None)
    assert c.statut == "valide"
    with pytest.raises(HTTPException):
        await crud.decide(db_session, c, statut="refuse", valide_par=1, commentaire="deja valide")
```

Run: `cd Web\backend; python -m pytest tests/test_conge_crud.py -v`
Expected: **FAIL** (`ModuleNotFoundError: app.crud.conge`).

- [ ] **Step 2: Implémenter `app/crud/conge.py`**

```python
"""CRUD Congé : listes scope entreprise/employé, solde calculé, décision."""
from datetime import date, datetime
from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import select, func

from app.crud.base import BaseCRUD
from app.models.conge import Conge


class CongeCRUD(BaseCRUD[Conge]):
    """CRUD pour les demandes de congés."""

    async def list_for_entreprise(self, db, entreprise_id: int, *, statut: str | None = None,
                                  employe_id: int | None = None, page: int = 1, size: int = 25
                                  ) -> tuple[Sequence[Conge], int]:
        query = select(Conge).where(Conge.is_deleted == False, Conge.entreprise_id == entreprise_id)
        if statut:
            query = query.where(Conge.statut == statut)
        if employe_id:
            query = query.where(Conge.employe_id == employe_id)
        return await self._paginate_query(db, query, page, size)

    async def list_for_employe(self, db, employe_id: int, *, page: int = 1, size: int = 25):
        query = select(Conge).where(Conge.is_deleted == False, Conge.employe_id == employe_id)
        return await self._paginate_query(db, query, page, size)

    async def solde_restant(self, db, employe) -> float:
        annee = date.today().year
        total = (await db.execute(
            select(func.coalesce(func.sum(Conge.nb_jours), 0)).where(
                Conge.employe_id == employe.id,
                Conge.type == Conge.TYPE_ANNUEL,
                Conge.statut == Conge.STATUT_VALIDE,
                Conge.is_deleted == False,
                func.extract("year", Conge.date_debut) == annee,
            )
        )).scalar_one()
        return float(employe.solde_conges_annuel or 30) - float(total)

    async def decide(self, db, conge: Conge, *, statut: str, valide_par: int | None,
                     commentaire: str | None) -> Conge:
        if conge.statut != Conge.STATUT_EN_ATTENTE:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail=f"Ce congé a déjà été traité (statut: {conge.statut})")
        conge.statut = statut
        conge.valide_par = valide_par
        conge.date_validation = datetime.utcnow()
        if statut == Conge.STATUT_REFUSE and commentaire:
            conge.commentaire_refus = commentaire
        await db.flush()
        await db.refresh(conge)
        return conge

    async def _paginate_query(self, db, query, page: int, size: int) -> tuple[Sequence[Conge], int]:
        total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
        result = await db.execute(query.order_by(Conge.created_at.desc()).offset((page - 1) * size).limit(size))
        return result.scalars().all(), total
```

- [ ] **Step 3: Relancer les tests**

Run: `cd Web\backend; python -m pytest tests/test_conge_crud.py tests/test_smoke.py -v`
Expected: **PASS** (tous).

- [ ] **Step 4: Commit**

```bash
git add Web/backend/app/crud/conge.py Web/backend/tests/test_conge_crud.py
git commit -m "feat(rh): CongeCRUD avec solde calcule et decision anti-double"
```

---

### Task 5: Endpoints RH `/rh/conges` (création, liste, validation, refus)

**Files:**
- Modify: `Web/backend/app/routers/rh.py`
- Create: `Web/backend/tests/test_rh_conges.py`

**Interfaces:**
- Consumes : `CongeCRUD` (Task 4), `CongeCreate`/`CongeDecision`/`CongeList` (Task 3), pattern `_require_permission` déjà dans `rh.py`
- Produces (consommé par le frontend Task 8) :
  - `POST /rh/conges` → 201 `CongeResponse` (permission `rh:write` ; vérifie que l'employé existe et appartient à l'entreprise)
  - `GET /rh/conges?statut=&employe_id=&page=&size=` → `CongeList` (`rh:read`)
  - `POST /rh/conges/{id}/valider` → `CongeResponse` (`rh:write`) — body optionnel `CongeDecision`
  - `POST /rh/conges/{id}/refuser` → `CongeResponse` (`rh:write`) — body optionnel `CongeDecision`
  - `GET /rh/conges/{employe_id}/solde` → `{"solde_restant": float, "solde_annuel": float}` (`rh:read`)

- [ ] **Step 1: Écrire le test API d'abord `tests/test_rh_conges.py`**

```python
from datetime import date

from app.models.employe import Employe
from app.models.entreprise import Entreprise


async def _setup_entreprise_employe(db_session):
    ent = Entreprise(nom="BTP Test")
    db_session.add(ent)
    await db_session.flush()
    emp = Employe(entreprise_id=ent.id, nom="Rabe", mode_remuneration="mensuel",
                  salaire_base=900000, solde_conges_annuel=30)
    db_session.add(emp)
    await db_session.flush()
    return ent, emp


BODY = {"employe_id": 1, "type": "annuel", "date_debut": "2026-10-05",
        "date_fin": "2026-10-09", "nb_jours": 5, "motif": "Repos annuel"}


async def test_rh_cree_et_valide_un_conge(db_session, client_factory):
    ent, emp = await _setup_entreprise_employe(db_session)
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        body = dict(BODY, employe_id=emp.id)
        r = await client.post("/rh/conges", json=body)
        assert r.status_code == 201, r.text
        cid = r.json()["id"]
        assert r.json()["statut"] == "en_attente"

        r = await client.post(f"/rh/conges/{cid}/valider", json={})
        assert r.status_code == 200 and r.json()["statut"] == "valide"

        r = await client.get(f"/rh/conges/{emp.id}/solde")
        assert r.json() == {"solde_restant": 25.0, "solde_annuel": 30.0}


async def test_rh_refuse_employe_autre_entreprise(db_session, client_factory):
    ent, emp = await _setup_entreprise_employe(db_session)
    async with await client_factory("rh", entreprise_id=ent.id + 999) as client:
        r = await client.post("/rh/conges", json=dict(BODY, employe_id=emp.id))
        assert r.status_code == 404


async def test_employe_n_a_pas_le_droit_rh_conges(db_session, client_factory):
    ent, _ = await _setup_entreprise_employe(db_session)
    async with await client_factory("employe", entreprise_id=ent.id) as client:
        r = await client.get("/rh/conges")
        assert r.status_code == 403
```

Run: `cd Web\backend; python -m pytest tests/test_rh_conges.py -v`
Expected: **FAIL** (404 / route inexistante).

- [ ] **Step 2: Implémenter les endpoints dans `routers/rh.py`**

Ajouter aux imports existants :

```python
from app.crud.conge import CongeCRUD
from app.models.conge import Conge
from app.schemas.conge import CongeCreate, CongeDecision, CongeResponse, CongeList
from app.models.notification import Notification
```

Ajouter en fin de fichier :

```python
# --- Congés ---


async def _get_employe_rh(db, id: int, entreprise_id: int | None) -> Employe:
    employe = await EmployeCRUD().get(db, id)
    if not employe or employe.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employé non trouvé")
    if entreprise_id is not None and employe.entreprise_id != entreprise_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employé non trouvé")
    return employe


def _conge_response(c: Conge) -> CongeResponse:
    resp = CongeResponse.model_validate(c)
    if c.employe is not None:
        resp.employe_nom = c.employe.nom
        resp.employe_prenom = c.employe.prenom
    return resp


@router.post("/conges", response_model=CongeResponse, status_code=status.HTTP_201_CREATED)
async def create_conge(payload: CurrentUserPayload, obj_in: CongeCreate, db: DbDep):
    _require_permission(payload, "rh:write")
    entreprise_id = payload.get("entreprise_id")
    employe = await _get_employe_rh(db, obj_in.employe_id, entreprise_id)
    crud = CongeCRUD()
    conge = await crud.create(db, {
        "entreprise_id": entreprise_id,
        "employe_id": employe.id,
        "type": obj_in.type,
        "date_debut": obj_in.date_debut,
        "date_fin": obj_in.date_fin,
        "nb_jours": obj_in.nb_jours,
        "motif": obj_in.motif,
        "statut": Conge.STATUT_EN_ATTENTE,
    })
    await db.refresh(conge)
    return _conge_response(conge)


@router.get("/conges", response_model=CongeList)
async def list_conges(
    payload: CurrentUserPayload,
    db: DbDep,
    statut: str | None = Query(default=None),
    employe_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=25, ge=1, le=100),
):
    _require_permission(payload, "rh:read")
    entreprise_id = payload.get("entreprise_id")
    if entreprise_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Entreprise requise")
    items, total = await CongeCRUD().list_for_entreprise(
        db, entreprise_id, statut=statut, employe_id=employe_id, page=page, size=size
    )
    return {"items": [_conge_response(c) for c in items], "total": total, "page": page, "size": size}


async def _decide_conge(payload, db, id: int, statut: str, decision: CongeDecision) -> CongeResponse:
    _require_permission(payload, "rh:write")
    entreprise_id = payload.get("entreprise_id")
    conge = await CongeCRUD().get(db, id)
    if not conge or conge.is_deleted or (entreprise_id is not None and conge.entreprise_id != entreprise_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Congé non trouvé")
    user = payload.get("user")
    valide_par = getattr(user, "id", None)
    conge = await CongeCRUD().decide(db, conge, statut=statut, valide_par=valide_par,
                                     commentaire=decision.commentaire)
    # Notification in-app pour l'employé concerné
    libelle = "validé" if statut == Conge.STATUT_VALIDE else "refusé"
    db.add(Notification(
        utilisateur_id=None, entreprise_id=entreprise_id, employe_id=conge.employe_id,
        titre=f"Congé {libelle}", message=f"Votre congé du {conge.date_debut} au {conge.date_fin} a été {libelle}.",
        type="conge",
    ))
    await db.flush()
    return _conge_response(conge)


@router.post("/conges/{id}/valider", response_model=CongeResponse)
async def valider_conge(payload: CurrentUserPayload, db: DbDep, id: int, decision: CongeDecision | None = None):
    return await _decide_conge(payload, db, id, Conge.STATUT_VALIDE, decision or CongeDecision())


@router.post("/conges/{id}/refuser", response_model=CongeResponse)
async def refuser_conge(payload: CurrentUserPayload, db: DbDep, id: int, decision: CongeDecision | None = None):
    return await _decide_conge(payload, db, id, Conge.STATUT_REFUSE, decision or CongeDecision())


@router.get("/conges/{employe_id}/solde")
async def get_solde_conges(payload: CurrentUserPayload, db: DbDep, employe_id: int):
    _require_permission(payload, "rh:read")
    employe = await _get_employe_rh(db, employe_id, payload.get("entreprise_id"))
    solde = await CongeCRUD().solde_restant(db, employe)
    return {"solde_restant": solde, "solde_annuel": float(employe.solde_conges_annuel or 30)}
```

⚠️ Vérifier les champs réels du modèle `Notification` (`app/models/notification.py`) et adapter l'instanciation à ses colonnes exactes — ne pas inventer de colonnes.

- [ ] **Step 3: Relancer les tests**

Run: `cd Web\backend; python -m pytest tests/test_rh_conges.py tests/test_conge_crud.py -v`
Expected: **PASS** (tous).

- [ ] **Step 4: Commit**

```bash
git add Web/backend/app/routers/rh.py Web/backend/tests/test_rh_conges.py
git commit -m "feat(rh): endpoints conges (creation, liste, validation, refus, solde)"
```

---

### Task 6: Rapport de paie calculé à la volée (`GET /rh/paie`) + export CSV

**Files:**
- Modify: `Web/backend/app/routers/rh.py`
- Create: `Web/backend/tests/test_rh_paie.py`

**Interfaces:**
- Consumes : colonnes `Employe.mode_remuneration / salaire_base / taux_journalier / taux_horaire` (Task 2), `Pointage` + `HeureSupplementaire` (existants — **vérifier les noms exacts des colonnes dans `app/models/pointage.py`** : date, heures, pauses)
- Produces (consommé par le frontend Task 8) :
  - `GET /rh/paie?mois=9&annee=2026&employe_id=` → `{"mois", "annee", "lignes": [PaieLigne], "total": float}` (`rh:read`)
  - `PaieLigne = {employe_id, nom, prenom, mode_remuneration, jours_valides: float, heures_sup: float, brut: float}`
  - `GET /rh/paie/export?mois=&annee=` → CSV (`StreamingResponse`, séparateur `;`, BOM UTF-8, décimales virgule)
  - Formules (spec §Paie) :
    - `journalier` : `jours_valides × taux_journalier` (jours = pointages distincts du mois)
    - `horaire` : `(Σ heures travaillées) × taux_horaire`
    - `mensuel` : `salaire_base` proratisé sur 26 j si jours_valides < 26, sinon plein ; `+ heures_sup validées × taux_majoration`
    - `a_la_tache` : 0 en v1 (calcul par tâche en v2, hors périmètre)

- [ ] **Step 1: Écrire le test d'abord `tests/test_rh_paie.py`**

```python
from datetime import date, time

from app.models.entreprise import Entreprise
from app.models.employe import Employe
from app.models.pointage import Pointage


async def _ent(db_session):
    ent = Entreprise(nom="BTP Test")
    db_session.add(ent)
    await db_session.flush()
    return ent


async def test_paie_journalier_jours_valides(db_session, client_factory):
    ent = await _ent(db_session)
    emp = Employe(entreprise_id=ent.id, nom="Rakoto", mode_remuneration="journalier",
                  taux_journalier=40000)
    db_session.add(emp)
    await db_session.flush()
    for day in (1, 2, 3):
        db_session.add(Pointage(
            entreprise_id=ent.id, employe_id=emp.id,
            date_pointage=date(2026, 9, day), heure_arrivee=time(8, 0), heure_depart=time(17, 0),
        ))
    await db_session.flush()
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.get("/rh/paie?mois=9&annee=2026")
        assert r.status_code == 200, r.text
        ligne = next(l for l in r.json()["lignes"] if l["employe_id"] == emp.id)
        assert ligne["jours_valides"] == 3
        assert ligne["brut"] == 120000.0  # 3 × 40 000 Ar
        assert r.json()["total"] == 120000.0


async def test_paie_mensuel_plein(db_session, client_factory):
    ent = await _ent(db_session)
    db_session.add(Employe(entreprise_id=ent.id, nom="Mensu", mode_remuneration="mensuel",
                           salaire_base=900000))
    await db_session.flush()
    async with await client_factory("rh", entreprise_id=ent.id) as client:
        r = await client.get("/rh/paie?mois=9&annee=2026")
        ligne = next(l for l in r.json()["lignes"] if l["nom"] == "Mensu")
        assert ligne["brut"] == 900000.0
```

⚠️ Adapter au schéma réel de `Pointage` : lire `app/models/pointage.py` et corriger les noms (ex. `date_pointage`, `heure_arrivee`, `heure_depart`, `entreprise_id`). Si `statut_validation` n'existe pas, compter tous les pointages non supprimés.

Run: `cd Web\backend; python -m pytest tests/test_rh_paie.py -v`
Expected: **FAIL** (404).

- [ ] **Step 2: Implémenter `rapport_paie` dans `routers/rh.py`**

Ajouter aux imports du fichier :

```python
import csv
import io
from fastapi.responses import StreamingResponse
```

Ajouter en fin de fichier (section `# --- Paie ---`) :

```python
@router.get("/paie")
async def rapport_paie(
    payload: CurrentUserPayload,
    db: DbDep,
    mois: int = Query(..., ge=1, le=12),
    annee: int = Query(..., ge=2000, le=2100),
    employe_id: int | None = Query(default=None),
):
    _require_permission(payload, "rh:read")
    entreprise_id = payload.get("entreprise_id")
    if entreprise_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Entreprise requise")

    debut = date(annee, mois, 1)
    fin_exclu = date(annee + 1, 1, 1) if mois == 12 else date(annee, mois + 1, 1)

    q_emp = select(Employe).where(Employe.is_deleted == False, Employe.entreprise_id == entreprise_id)
    if employe_id:
        q_emp = q_emp.where(Employe.id == employe_id)
    employes = (await db.execute(q_emp)).scalars().all()

    q_pt = select(Pointage).where(
        Pointage.is_deleted == False,
        Pointage.entreprise_id == entreprise_id,
        Pointage.date_pointage >= debut,
        Pointage.date_pointage < fin_exclu,
    )
    pointages = (await db.execute(q_pt)).scalars().all()

    q_hs = select(HeureSupplementaire).where(
        HeureSupplementaire.is_deleted == False,
        HeureSupplementaire.statut == "validee",
        HeureSupplementaire.date_hs >= debut,
        HeureSupplementaire.date_hs < fin_exclu,
    )
    heures_sup = (await db.execute(q_hs)).scalars().all()

    # Indexation des pointages
    jours_par_emp: dict[int, set] = {}
    heures_par_emp: dict[int, float] = {}
    for pt in pointages:
        if pt.date_pointage is not None:
            jours_par_emp.setdefault(pt.employe_id, set()).add(pt.date_pointage)
        if pt.heure_arrivee and pt.heure_depart:
            delta = (datetime.combine(date.min, pt.heure_depart)
                     - datetime.combine(date.min, pt.heure_arrivee)).total_seconds() / 3600
            pauses = 0.0
            if pt.heure_pause_debut and pt.heure_pause_fin:
                pauses = (datetime.combine(date.min, pt.heure_pause_fin)
                          - datetime.combine(date.min, pt.heure_pause_debut)).total_seconds() / 3600
            heures_par_emp[pt.employe_id] = heures_par_emp.get(pt.employe_id, 0.0) + max(delta - pauses, 0.0)

    hs_par_emp: dict[int, float] = {}
    for hs in heures_sup:
        if hs.employe_id:
            hs_par_emp[hs.employe_id] = hs_par_emp.get(hs.employe_id, 0.0) + (hs.nb_heures or 0) * (hs.taux_majoration or 1.5)

    lignes = []
    total = 0.0
    for emp in employes:
        mode = emp.mode_remuneration or "mensuel"
        jours_valides = float(len(jours_par_emp.get(emp.id, set())))
        h_sup = hs_par_emp.get(emp.id, 0.0)
        if mode == "journalier":
            brut = jours_valides * float(emp.taux_journalier or 0)
        elif mode == "horaire":
            brut = heures_par_emp.get(emp.id, 0.0) * float(emp.taux_horaire or 0)
        elif mode == "a_la_tache":
            brut = 0.0  # v1 : calcul par tache reporte en v2
        else:  # mensuel : proraté sur 26 jours ouvrés moyens si incomplet
            brut = float(emp.salaire_base or 0) if jours_valides >= 26 \
                else round(float(emp.salaire_base or 0) * jours_valides / 26, 2)
            brut += h_sup
        lignes.append({
            "employe_id": emp.id, "nom": emp.nom, "prenom": emp.prenom,
            "mode_remuneration": mode, "jours_valides": jours_valides,
            "heures_sup": round(h_sup, 2), "brut": round(brut, 2),
        })
        total += brut

    return {"mois": mois, "annee": annee, "lignes": lignes, "total": round(total, 2)}
```

- [ ] **Step 3: Implémenter l'export CSV + lancer les tests**

```python
@router.get("/paie/export")
async def export_paie_csv(payload: CurrentUserPayload, db: DbDep,
                          mois: int = Query(..., ge=1, le=12), annee: int = Query(..., ge=2000, le=2100)):
    _require_permission(payload, "rh:read")
    rapport = await rapport_paie(payload, db, mois=mois, annee=annee)
    buf = io.StringIO()
    buf.write("\ufeff")  # BOM pour Excel
    writer = csv.writer(buf, delimiter=";")
    writer.writerow(["Employe ID", "Nom", "Prenom", "Mode", "Jours valides", "Heures sup", "Brut (Ar)"])
    for l in rapport["lignes"]:
        writer.writerow([l["employe_id"], l["nom"], l["prenom"], l["mode_remuneration"],
                         str(l["jours_valides"]).replace(".", ","),
                         str(l["heures_sup"]).replace(".", ","),
                         str(l["brut"]).replace(".", ",")])
    writer.writerow(["", "", "", "", "", "TOTAL", str(rapport["total"]).replace(".", ",")])
    buf.seek(0)
    return StreamingResponse(iter([buf.read()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename=paie_{annee}_{mois:02d}.csv"})
```

⚠️ ⚠️ **Important** : déclarer ces routes `/paie` **avant** la route générique `GET /employes/{id}` n'est pas nécessaire (préfixes distincts), mais vérifier qu'aucune route `/employes/{paie}` ne capture — et corriger les noms de colonnes `Pointage` selon le modèle réel lu à l'étape 1.

Run: `cd Web\backend; python -m pytest tests/test_rh_paie.py tests/test_rh_conges.py tests/test_conge_crud.py -v`
Expected: **PASS** (tous).

- [ ] **Step 4: Commit**

```bash
git add Web/backend/app/routers/rh.py Web/backend/tests/test_rh_paie.py
git commit -m "feat(rh): rapport de paie calcule a la volee + export CSV"
```

---

### Task 7: Endpoints terrain `/employe-terrain/conges` (self-only)

**Files:**
- Modify: `Web/backend/app/routers/employe_terrain.py`
- Create: `Web/backend/tests/test_employe_terrain_conges.py`

**Interfaces:**
- Consumes : `CongeCRUD` (Task 4), `CongeResponse` (Task 3), helper `_get_employe(payload, db)` déjà présent dans `employe_terrain.py`, permissions `employe_terrain:read/write` (déjà dans `Role.EMPLOYE`)
- Produces (consommé par `EmployeCongesPage` Task 10) :
  - `POST /employe-terrain/conges` → 201 `CongeResponse` — demande créée **pour l'employé connecté** (`employe_id` forcé côté serveur, jamais lu du body)
  - `GET /employe-terrain/conges` → `{"items", "total_items", "solde_restant", "solde_annuel"}`
  - `POST /employe-terrain/conges/{id}/annuler` → `CongeResponse` — uniquement ses propres demandes en `en_attente` (sinon 404/409)

- [ ] **Step 1: Écrire le test d'abord `tests/test_employe_terrain_conges.py`**

```python
from app.models.entreprise import Entreprise
from app.models.employe import Employe


async def _setup(db_session, email="rakoto@btp.mg"):
    ent = Entreprise(nom="BTP Test")
    db_session.add(ent)
    await db_session.flush()
    emp = Employe(entreprise_id=ent.id, nom="Rakoto", email=email, solde_conges_annuel=30)
    db_session.add(emp)
    await db_session.flush()
    return ent, emp


BODY = {"type": "annuel", "date_debut": "2026-11-02", "date_fin": "2026-11-03",
        "nb_jours": 2, "motif": "Raison familiale"}


async def test_employe_demande_son_conge(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("employe", entreprise_id=ent.id, user_email=emp.email) as client:
        r = await client.post("/employe-terrain/conges", json=BODY)
        assert r.status_code == 201, r.text
        assert r.json()["employe_id"] == emp.id  # forcé côté serveur
        r = await client.get("/employe-terrain/conges")
        assert r.json()["solde_restant"] == 30.0 and r.json()["total_items"] == 1


async def test_employe_annule_sa_propre_demande(db_session, client_factory):
    ent, emp = await _setup(db_session)
    async with await client_factory("employe", entreprise_id=ent.id, user_email=emp.email) as client:
        r = await client.post("/employe-terrain/conges", json=BODY)
        cid = r.json()["id"]
        r = await client.post(f"/employe-terrain/conges/{cid}/annuler")
        assert r.status_code == 200 and r.json()["statut"] == "annule"


async def test_employe_ne_voit_pas_les_autres(db_session, client_factory):
    ent, emp = await _setup(db_session, email="a@b.mg")
    await _setup(db_session, email="c@d.mg")
    async with await client_factory("employe", entreprise_id=ent.id, user_email=emp.email) as client:
        r = await client.get("/employe-terrain/conges")
        assert all(i["employe_id"] == emp.id for i in r.json()["items"])
```

Run: `cd Web\backend; python -m pytest tests/test_employe_terrain_conges.py -v`
Expected: **FAIL** (404).

- [ ] **Step 2: Implémenter dans `routers/employe_terrain.py`**

⚠️ `CongeCreate` exige `employe_id` : pour le terrain, créer un schéma dédié **local au router** (mêmes validators, sans `employe_id`) pour éviter la fuite d'un employe_id contrôlable par le client.

Ajouter aux imports :

```python
from pydantic import BaseModel, Field, field_validator, model_validator
from app.crud.conge import CongeCRUD
from app.models.conge import Conge
from app.schemas.conge import CongeResponse
```

Schéma local + endpoints (fin de fichier) :

```python
# ==================== CONGES (self-only) ====================


class CongeDemandeCreate(BaseModel):
    """Demande de congé par l'employé lui-même (self-only)."""

    type: str = Field(default="annuel", max_length=30)
    date_debut: date
    date_fin: date
    nb_jours: float = Field(..., gt=0)
    motif: str | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        from app.schemas.conge import TYPES_VALIDES
        if v not in TYPES_VALIDES:
            raise ValueError(f"Type invalide: {sorted(TYPES_VALIDES)}")
        return v

    @model_validator(mode="after")
    def validate_dates(self):
        if self.date_fin < self.date_debut:
            raise ValueError("date_fin doit être postérieure ou égale à date_debut")
        return self


@router.post("/conges", response_model=CongeResponse, status_code=status.HTTP_201_CREATED)
async def demander_conge(payload: CurrentUserPayload, obj_in: CongeDemandeCreate, db: DbDep):
    _require_permission(payload, "employe_terrain:write")
    employe = await _get_employe(payload, db)
    conge = await CongeCRUD().create(db, {
        "entreprise_id": employe.entreprise_id, "employe_id": employe.id,
        "type": obj_in.type, "date_debut": obj_in.date_debut, "date_fin": obj_in.date_fin,
        "nb_jours": obj_in.nb_jours, "motif": obj_in.motif, "statut": Conge.STATUT_EN_ATTENTE,
    })
    await db.refresh(conge)
    return CongeResponse.model_validate(conge)


@router.get("/conges")
async def mes_conges(payload: CurrentUserPayload, db: DbDep):
    _require_permission(payload, "employe_terrain:read")
    employe = await _get_employe(payload, db)
    items, total = await CongeCRUD().list_for_employe(db, employe.id, page=1, size=100)
    solde = await CongeCRUD().solde_restant(db, employe)
    return {
        "items": [CongeResponse.model_validate(c) for c in items],
        "total_items": total,
        "solde_restant": solde,
        "solde_annuel": float(employe.solde_conges_annuel or 30),
    }


@router.post("/conges/{id}/annuler", response_model=CongeResponse)
async def annuler_mon_conge(payload: CurrentUserPayload, db: DbDep, id: int):
    _require_permission(payload, "employe_terrain:write")
    employe = await _get_employe(payload, db)
    conge = await CongeCRUD().get(db, id)
    if not conge or conge.is_deleted or conge.employe_id != employe.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Congé non trouvé")
    if conge.statut != Conge.STATUT_EN_ATTENTE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Seule une demande en attente peut être annulée")
    conge.statut = Conge.STATUT_ANNULE
    await db.flush()
    await db.refresh(conge)
    return CongeResponse.model_validate(conge)
```

- [ ] **Step 3: Relancer tous les tests backend**

Run: `cd Web\backend; python -m pytest tests/ -v`
Expected: **PASS** (tous).

- [ ] **Step 4: Commit**

```bash
git add Web/backend/app/routers/employe_terrain.py Web/backend/tests/test_employe_terrain_conges.py
git commit -m "feat(rh): conges self-only pour l'employe terrain (demande, liste, annulation)"
```

---

### Task 8: Frontend — types + services (rh.service, employeTerrain.service)

**Files:**
- Modify: `Web/frontend/src/types/index.ts`
- Modify: `Web/frontend/src/services/rh.service.ts`
- Modify: `Web/frontend/src/services/employeTerrain.service.ts`

**Interfaces:**
- Consumes : endpoints des Tasks 5–7
- Produces (consommés par les Tasks 9–11) :
  - types `Conge`, `CongeListeTerrain`, `LignePaie`, `RapportPaie`
  - `rhService.getConges(params?)`, `rhService.createConge(data)`, `rhService.validerConge(id)`, `rhService.refuserConge(id, commentaire?)`, `rhService.getSoldeConge(employeId)`, `rhService.getPaie(mois, annee)`, `rhService.exportPaie(mois, annee)` (téléchargement blob)
  - `employeTerrainService.demanderConge(data)`, `employeTerrainService.getMesConges()`, `employeTerrainService.annulerConge(id)`

- [ ] **Step 1: Ajouter les types dans `types/index.ts`** (après `HeureSupplementaire`)

```typescript
export type TypeConge = "annuel" | "maladie" | "maternite" | "exceptionnel" | "sans_solde";
export type StatutConge = "en_attente" | "valide" | "refuse" | "annule";
export type ModeRemuneration = "mensuel" | "journalier" | "horaire" | "a_la_tache";

export interface Conge {
  id: number;
  entreprise_id?: number;
  employe_id: number;
  type: TypeConge;
  date_debut: string;
  date_fin: string;
  nb_jours: number;
  statut: StatutConge;
  motif?: string;
  valide_par?: number;
  date_validation?: string;
  commentaire_refus?: string;
  is_deleted?: boolean;
  created_at?: string;
  employe_nom?: string;
  employe_prenom?: string;
}

export interface CongeListe {
  items: Conge[];
  total: number;
  page: number;
  size: number;
}

export interface SoldeConge {
  solde_restant: number;
  solde_annuel: number;
}

export interface LignePaie {
  employe_id: number;
  nom: string;
  prenom?: string;
  mode_remuneration: ModeRemuneration;
  jours_valides: number;
  heures_sup: number;
  brut: number;
}

export interface RapportPaie {
  mois: number;
  annee: number;
  lignes: LignePaie[];
  total: number;
}
```

Étendre `Employe` (champs optionnels, avant `is_deleted`) :

```typescript
  mode_remuneration?: ModeRemuneration;
  taux_journalier?: number;
  taux_horaire?: number;
  prix_tache?: number;
  numero_cnaps?: string;
  numero_ostie?: string;
  statut_declaration?: "non_declare" | "cnaps" | "cnaps_ostie";
  solde_conges_annuel?: number;
```

- [ ] **Step 2: Étendre `services/rh.service.ts`** (à la fin de l'objet)

```typescript
  // Congés (RH)
  async getConges(params?: { statut?: string; employe_id?: number; page?: number; size?: number }) {
    const res = await api.get<CongeListe>('/rh/conges', { params })
    return res.data
  },

  async createConge(data: Partial<Conge>) {
    const res = await api.post<Conge>('/rh/conges', data)
    return res.data
  },

  async validerConge(id: number) {
    const res = await api.post<Conge>(`/rh/conges/${id}/valider`, {})
    return res.data
  },

  async refuserConge(id: number, commentaire?: string) {
    const res = await api.post<Conge>(`/rh/conges/${id}/refuser`, { commentaire })
    return res.data
  },

  async getSoldeConge(employeId: number) {
    const res = await api.get<SoldeConge>(`/rh/conges/${employeId}/solde`)
    return res.data
  },

  // Paie
  async getPaie(mois: number, annee: number) {
    const res = await api.get<RapportPaie>('/rh/paie', { params: { mois, annee } })
    return res.data
  },

  async exportPaie(mois: number, annee: number) {
    const res = await api.get('/rh/paie/export', { params: { mois, annee }, responseType: 'blob' })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `paie_${annee}_${String(mois).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  },
```

Et étendre les imports de types en tête : `import type { Conge, CongeListe, SoldeConge, RapportPaie } from '@/types'` (fusionner avec l'import existant).

- [ ] **Step 3: Étendre `services/employeTerrain.service.ts`** (même objet)

```typescript
  // Congés (self-only)
  async demanderConge(data: { type: string; date_debut: string; date_fin: string; nb_jours: number; motif?: string }) {
    const res = await api.post<Conge>('/employe-terrain/conges', data)
    return res.data
  },

  async getMesConges() {
    const res = await api.get<{ items: Conge[]; total_items: number; solde_restant: number; solde_annuel: number }>(
      '/employe-terrain/conges'
    )
    return res.data
  },

  async annulerConge(id: number) {
    const res = await api.post<Conge>(`/employe-terrain/conges/${id}/annuler`, {})
    return res.data
  },
```

- [ ] **Step 4: Vérifier la compilation TypeScript**

Run: `cd Web\frontend; npx tsc --noEmit`
Expected: **0 erreur**.

- [ ] **Step 5: Commit**

```bash
git add Web/frontend/src/types/index.ts Web/frontend/src/services
git commit -m "feat(frontend): types et services conges + paie"
```

---

### Task 9: RhPage — onglet Congés & Absences + onglet Paie

**Files:**
- Modify: `Web/frontend/src/pages/rh/RhPage.tsx`

**Interfaces:**
- Consumes : `rhService.getConges/createConge/validerConge/refuserConge/getSoldeConge/getPaie/exportPaie` (Task 8), types `Conge`, `RapportPaie`
- Produces : UI de gestion RH — onglets existants conservés, deux nouveaux onglets :
  - **Congés** : filtre statut, tableau (employé, type, dates, jours, statut), boutons Valider/Refuser sur les `en_attente` (Refuser → prompt commentaire), bouton « Nouvelle demande » (modal : select employé, type, dates, nb_jours, motif)
  - **Paie** : sélecteurs mois/année, tableau des lignes (mode, jours valides, heures sup, brut Ar), total général, bouton Export CSV
- Format monnaie : `new Intl.NumberFormat('fr-MG', { maximumFractionDigits: 0 }).format(brut) + ' Ar'` (cellules brut + total)

- [ ] **Step 1: Vérifier la structure d'onglets existante de `RhPage.tsx`** et suivre le même pattern (state `activeTab`, boutons `.nav-link`, rendu conditionnel).

- [ ] **Step 2: Ajouter le state + les loaders**

```tsx
const [conges, setConges] = useState<Conge[]>([])
const [congeStatut, setCongeStatut] = useState<string | undefined>()
const [paie, setPaie] = useState<RapportPaie | null>(null)
const [paieMois, setPaieMois] = useState(new Date().getMonth() + 1)
const [paieAnnee, setPaieAnnee] = useState(new Date().getFullYear())

const loadConges = useCallback(async () => {
  const res = await rhService.getConges({ statut: congeStatut })
  setConges(res.items)
}, [congeStatut])

const loadPaie = useCallback(async () => {
  setPaie(await rhService.getPaie(paieMois, paieAnnee))
}, [paieMois, paieAnnee])
```

Appeler `loadConges`/`loadPaie` quand l'onglet correspondant devient actif (même mécanique que les autres onglets).

- [ ] **Step 3: Ajouter les deux boutons d'onglet**

```tsx
<li className="nav-item">
  <button className={`nav-link ${activeTab === 'conges' ? 'active' : ''}`} onClick={() => { setActiveTab('conges'); loadConges() }}>
    <i className="bi bi-calendar2-week me-1"></i> Congés
  </button>
</li>
<li className="nav-item">
  <button className={`nav-link ${activeTab === 'paie' ? 'active' : ''}`} onClick={() => { setActiveTab('paie'); loadPaie() }}>
    <i className="bi bi-cash-coin me-1"></i> Paie
  </button>
</li>
```

- [ ] **Step 4: Contenu de l'onglet Congés**

```tsx
{activeTab === 'conges' && (
  <>
    <div className="d-flex justify-content-between mb-3">
      <select className="form-select w-auto" value={congeStatut ?? ''} onChange={(e) => setCongeStatut(e.target.value || undefined)}>
        <option value="">Tous statuts</option>
        <option value="en_attente">En attente</option>
        <option value="valide">Validés</option>
        <option value="refuse">Refusés</option>
        <option value="annule">Annulés</option>
      </select>
      <button className="btn btn-primary" onClick={() => setShowCongeModal(true)}>
        <i className="bi bi-plus-lg me-1"></i> Nouvelle demande
      </button>
    </div>
    <div className="table-responsive">
      <table className="table table-hover">
        <thead><tr><th>Employé</th><th>Type</th><th>Du</th><th>Au</th><th>Jours</th><th>Statut</th><th>Actions</th></tr></thead>
        <tbody>
          {conges.map((c) => (
            <tr key={c.id}>
              <td>{c.employe_prenom} {c.employe_nom}</td>
              <td>{c.type}</td>
              <td>{c.date_debut}</td>
              <td>{c.date_fin}</td>
              <td>{c.nb_jours}</td>
              <td><span className={`badge bg-${c.statut === 'valide' ? 'success' : c.statut === 'refuse' ? 'danger' : c.statut === 'annule' ? 'secondary' : 'warning text-dark'}`}>{c.statut}</span></td>
              <td>
                {c.statut === 'en_attente' && (
                  <>
                    <button className="btn btn-sm btn-success me-1" onClick={() => rhService.validerConge(c.id).then(loadConges)}>Valider</button>
                    <button className="btn btn-sm btn-danger" onClick={() => {
                      const cm = window.prompt('Motif du refus (optionnel) :') ?? undefined
                      rhService.refuserConge(c.id, cm).then(loadConges)
                    }}>Refuser</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {conges.length === 0 && <tr><td colSpan={7} className="text-muted">Aucun congé</td></tr>}
        </tbody>
      </table>
    </div>
  </>
)}
```

- [ ] **Step 5: Contenu de l'onglet Paie**

```tsx
{activeTab === 'paie' && paie && (
  <>
    <div className="d-flex align-items-center gap-2 mb-3">
      <select className="form-select w-auto" value={paieMois} onChange={(e) => setPaieMois(Number(e.target.value))}>
        {['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'].map((m, i) => (
          <option key={i + 1} value={i + 1}>{m}</option>
        ))}
      </select>
      <select className="form-select w-auto" value={paieAnnee} onChange={(e) => setPaieAnnee(Number(e.target.value))}>
        {[paieAnnee - 1, paieAnnee, paieAnnee + 1].map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <button className="btn btn-outline-primary ms-auto" onClick={() => rhService.exportPaie(paieMois, paieAnnee)}>
        <i className="bi bi-download me-1"></i> Export CSV
      </button>
    </div>
    <div className="table-responsive">
      <table className="table table-hover">
        <thead><tr><th>Employé</th><th>Mode</th><th>Jours valides</th><th>Heures sup</th><th className="text-end">Brut (Ar)</th></tr></thead>
        <tbody>
          {paie.lignes.map((l) => (
            <tr key={l.employe_id}>
              <td>{l.prenom} {l.nom}</td>
              <td>{l.mode_remuneration}</td>
              <td>{l.jours_valides}</td>
              <td>{l.heures_sup}</td>
              <td className="text-end">{new Intl.NumberFormat('fr-MG', { maximumFractionDigits: 0 }).format(l.brut)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><th colSpan={4} className="text-end">Total</th>
              <th className="text-end">{new Intl.NumberFormat('fr-MG', { maximumFractionDigits: 0 }).format(paie.total)}</th></tr>
        </tfoot>
      </table>
    </div>
  </>
)}
```

Modal « Nouvelle demande » : formulaire Bootstrap classique (select employé depuis `rhService.getEmployes()`, select type, deux `input type="date"`, `nb_jours` number, motif texte) dont le submit appelle `rhService.createConge(congeForm).then(() => { setShowCongeModal(false); loadConges() })` — suivre le pattern de modal existant de `RhPage.tsx`.

- [ ] **Step 6: Vérifier compilation + build**

Run: `cd Web\frontend; npx tsc --noEmit; npm run build`
Expected: **0 erreur**.

- [ ] **Step 7: Commit**

```bash
git add Web/frontend/src/pages/rh/RhPage.tsx
git commit -m "feat(frontend): onglets Conges et Paie dans RhPage"
```

---

### Task 10: `EmployeCongesPage` — demande de congé pour l'employé terrain

**Files:**
- Create: `Web/frontend/src/pages/employe/EmployeCongesPage.tsx`
- Modify: `Web/frontend/src/components/layout/Sidebar.tsx` (entrée de nav)

**Interfaces:**
- Consumes : `employeTerrainService.getMesConges/demanderConge/annulerConge` (Task 8), type `Conge`
- Produces : route `/employe/conges` dans l'espace employé — liste de ses demandes (badge statut), solde (`solde_restant` / `solde_annuel`), bouton « Demander » (modal), bouton « Annuler » sur ses demandes `en_attente`

- [ ] **Step 1: Créer la page — constantes + état**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { employeTerrainService } from '@/services/employeTerrain.service'
import type { Conge } from '@/types'
import { PageSkeleton } from '@/components/ui/Skeleton'

const TYPES: { value: string; label: string }[] = [
  { value: 'annuel', label: 'Congé annuel' },
  { value: 'maladie', label: 'Maladie' },
  { value: 'maternite', label: 'Maternité' },
  { value: 'exceptionnel', label: 'Exceptionnel' },
  { value: 'sans_solde', label: 'Sans solde' },
]

const badgeClass: Record<string, string> = {
  en_attente: 'warning text-dark', valide: 'success', refuse: 'danger', annule: 'secondary',
}

export function EmployeCongesPage() {
  const [data, setData] = useState<{ items: Conge[]; solde_restant: number; solde_annuel: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ type: 'annuel', date_debut: '', date_fin: '', nb_jours: 1, motif: '' })
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await employeTerrainService.getMesConges())
    } catch {
      setErr('Impossible de charger vos congés')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    try {
      await employeTerrainService.demanderConge({ ...form, nb_jours: Number(form.nb_jours) })
      setShowModal(false)
      setForm({ type: 'annuel', date_debut: '', date_fin: '', nb_jours: 1, motif: '' })
      await load()
    } catch {
      setErr('Demande refusée : vérifiez vos dates et votre solde')
    }
  }

  if (loading) return <PageSkeleton />
  if (err && !data) return <div className="alert alert-danger m-3">{err}</div>
  if (!data) return null

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0"><i className="bi bi-calendar2-week"></i> Mes congés</h5>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <i className="bi bi-plus-lg me-1"></i> Demander
        </button>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-6">
          <div className="card border-0 shadow-sm"><div className="card-body">
            <div className="text-muted small">Solde restant</div>
            <div className="fs-4 fw-bold">{data.solde_restant} jours</div>
          </div></div>
        </div>
        <div className="col-6">
          <div className="card border-0 shadow-sm"><div className="card-body">
            <div className="text-muted small">Droit annuel</div>
            <div className="fs-4 fw-bold">{data.solde_annuel} jours</div>
          </div></div>
        </div>
      </div>

      {data.items.length === 0 ? <div className="text-muted">Aucune demande</div> : (
        <div className="table-responsive">
          <table className="table table-sm">
            <thead><tr><th>Type</th><th>Du</th><th>Au</th><th>Jours</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td>{TYPES.find((t) => t.value === c.type)?.label ?? c.type}</td>
                  <td>{c.date_debut}</td>
                  <td>{c.date_fin}</td>
                  <td>{c.nb_jours}</td>
                  <td><span className={`badge bg-${badgeClass[c.statut] ?? 'secondary'}`}>{c.statut}</span></td>
                  <td>
                    {c.statut === 'en_attente' && (
                      <button className="btn btn-sm btn-outline-secondary"
                              onClick={() => employeTerrainService.annulerConge(c.id).then(load)}>Annuler</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,.4)' }} onClick={() => setShowModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header"><h6 className="modal-title">Demande de congé</h6>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button></div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label small">Type</label>
                  <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-6"><label className="form-label small">Du</label>
                    <input type="date" className="form-control" value={form.date_debut}
                           onChange={(e) => setForm({ ...form, date_debut: e.target.value })} /></div>
                  <div className="col-6"><label className="form-label small">Au</label>
                    <input type="date" className="form-control" value={form.date_fin}
                           onChange={(e) => setForm({ ...form, date_fin: e.target.value })} /></div>
                </div>
                <div className="mb-2"><label className="form-label small">Nombre de jours</label>
                  <input type="number" min={1} step="0.5" className="form-control" value={form.nb_jours}
                         onChange={(e) => setForm({ ...form, nb_jours: Number(e.target.value) })} /></div>
                <div className="mb-2"><label className="form-label small">Motif</label>
                  <textarea className="form-control" rows={2} value={form.motif}
                            onChange={(e) => setForm({ ...form, motif: e.target.value })} /></div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                <button className="btn btn-primary" onClick={submit}>Envoyer la demande</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Ajouter la navigation dans `Sidebar.tsx`** (même map que `/employe/badge`) :

```typescript
'/employe/conges': { label: 'Mes congés', icon: 'bi-calendar2-week', section: 'Espace Terrain' },
```

- [ ] **Step 3: Vérifier compilation + build**

Run: `cd Web\frontend; npx tsc --noEmit; npm run build`
Expected: **0 erreur**.

- [ ] **Step 4: Commit**

```bash
git add Web/frontend/src/pages/employe/EmployeCongesPage.tsx Web/frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(frontend): page de demande de conges pour l'employe terrain"
```

---

### Task 11: Badge QR imprimable avec photo (`EmployeBadgePage`)

**Files:**
- Modify: `Web/frontend/src/pages/employe/EmployeBadgePage.tsx`
- Modify: feuille de styles globale (localiser où vont les styles globaux — `index.scss` ou équivalent)

**Interfaces:**
- Consumes : `badge.employe` (photo, nom, prénom, matricule, poste) déjà renvoyé par `employeTerrainService.getMonBadge()`
- Produces : carte badge au format paysage (ratio 85×54) avec photo à gauche + QR à droite, bouton « Imprimer » (`window.print()` + media query `.badge-card`)

- [ ] **Step 1: Restructurer le bloc badge** — remplacer le bloc `card-body text-center` existant par :

```tsx
<div className="card border-0 shadow-sm mb-3">
  <div className="card-body">
    <div className="badge-card d-flex align-items-center justify-content-between p-3 rounded border">
      <div className="d-flex align-items-center gap-3">
        {emp.photo ? (
          <img src={emp.photo} alt={`${emp.prenom} ${emp.nom}`}
               className="rounded" style={{ width: 72, height: 72, objectFit: 'cover' }} />
        ) : (
          <div className="rounded d-flex align-items-center justify-content-center bg-light"
               style={{ width: 72, height: 72 }}>
            <i className="bi bi-person-fill fs-1 text-secondary"></i>
          </div>
        )}
        <div>
          <div className="fw-bold">{emp.prenom} {emp.nom}</div>
          <div className="small text-muted">{emp.poste || '—'}</div>
          <div className="small">Matricule : {emp.matricule || `EMP-${emp.id}`}</div>
        </div>
      </div>
      <div className="text-center">
        <i className="bi bi-qr-code" style={{ fontSize: 72 }}></i>
        <div className="small text-muted">{badge.code_qr}</div>
      </div>
    </div>
    <button className="btn btn-outline-primary mt-3 d-print-none" onClick={() => window.print()}>
      <i className="bi bi-printer me-1"></i> Imprimer
    </button>
  </div>
</div>
```

- [ ] **Step 2: Style impression** (feuille de styles globale) :

```scss
@media print {
  body * { visibility: hidden; }
  .badge-card, .badge-card * { visibility: visible; }
  .badge-card { position: absolute; top: 0; left: 0; width: 100%; }
}
```

- [ ] **Step 3: Vérifier compilation + build**

Run: `cd Web\frontend; npx tsc --noEmit; npm run build`
Expected: **0 erreur**.

- [ ] **Step 4: Commit**

```bash
git add Web/frontend/src/pages/employe/EmployeBadgePage.tsx
git commit -m "feat(frontend): badge QR imprimable avec photo"
```

---

### Task 12: Routing `/employe/conges` + fiche employé étendue (rémunération / CNAPS-OSTIE)

**Files:**
- Modify: fichier de routes frontend (localiser où `/employe/badge` est déclaré — `App.tsx` ou équivalent)
- Modify: `Web/frontend/src/pages/rh/RhPage.tsx` (formulaire employé : nouveaux champs + vérifier que la timeline `historique_postes` est affichée — l'endpoint `changer-poste` crée déjà l'historique)

**Interfaces:**
- Consumes : `EmployeCongesPage` (Task 10), champs étendus `Employe` (Task 8), endpoint `PUT /rh/employes/{id}` étendu (Task 3)
- Produces : route `/employe/conges` protégée par `EmployeLayout` ; fiche employé RH complète

- [ ] **Step 1: Ajouter la route** — à côté de `/employe/badge`, même layout :

```tsx
<Route path="/employe/conges" element={<EmployeCongesPage />} />
```

(suivre la structure exacte des routes existantes — import `EmployeCongesPage` depuis `@/pages/employe/EmployeCongesPage`)

- [ ] **Step 2: Étendre le formulaire employé de `RhPage.tsx`** — section « Rémunération & Conformité » (adapter aux noms réels du state du formulaire existant) :

```tsx
<div className="row g-2">
  <div className="col-md-4">
    <label className="form-label small">Mode de rémunération</label>
    <select className="form-select" value={form.mode_remuneration ?? 'mensuel'}
            onChange={(e) => setForm({ ...form, mode_remuneration: e.target.value })}>
      <option value="mensuel">Mensuel</option>
      <option value="journalier">Journalier</option>
      <option value="horaire">Horaire</option>
      <option value="a_la_tache">À la tâche</option>
    </select>
  </div>
  <div className="col-md-4">
    <label className="form-label small">Taux journalier (Ar)</label>
    <input type="number" className="form-control" value={form.taux_journalier ?? ''}
           onChange={(e) => setForm({ ...form, taux_journalier: Number(e.target.value) })} />
  </div>
  <div className="col-md-4">
    <label className="form-label small">Taux horaire (Ar)</label>
    <input type="number" className="form-control" value={form.taux_horaire ?? ''}
           onChange={(e) => setForm({ ...form, taux_horaire: Number(e.target.value) })} />
  </div>
  <div className="col-md-4">
    <label className="form-label small">N° CNAPS</label>
    <input type="text" className="form-control" value={form.numero_cnaps ?? ''}
           onChange={(e) => setForm({ ...form, numero_cnaps: e.target.value })} />
  </div>
  <div className="col-md-4">
    <label className="form-label small">N° OSTIE</label>
    <input type="text" className="form-control" value={form.numero_ostie ?? ''}
           onChange={(e) => setForm({ ...form, numero_ostie: e.target.value })} />
  </div>
  <div className="col-md-4">
    <label className="form-label small">Déclaration</label>
    <select className="form-select" value={form.statut_declaration ?? 'non_declare'}
            onChange={(e) => setForm({ ...form, statut_declaration: e.target.value })}>
      <option value="non_declare">Non déclaré</option>
      <option value="cnaps">CNAPS</option>
      <option value="cnaps_ostie">CNAPS + OSTIE</option>
    </select>
  </div>
  <div className="col-md-4">
    <label className="form-label small">Solde congés annuel (jours)</label>
    <input type="number" min={0} className="form-control" value={form.solde_conges_annuel ?? 30}
           onChange={(e) => setForm({ ...form, solde_conges_annuel: Number(e.target.value) })} />
  </div>
</div>
```

- [ ] **Step 3: Vérifier compilation + build**

Run: `cd Web\frontend; npx tsc --noEmit; npm run build`
Expected: **0 erreur**.

- [ ] **Step 4: Commit**

```bash
git add -A Web/frontend/src
git commit -m "feat(frontend): routing conges terrain + fiche employe remuneration/CNAPS-OSTIE"
```

---

### Task 13: Migration BD + vérification finale + graphify update

**Files:**
- Verify: `Web/backend/alembic/versions/020_rh_conges_employe.py` (créée en Task 3)

**Interfaces:**
- Consumes : toutes les tâches précédentes
- Produces : base migrée, zéro régression, graphe à jour

- [ ] **Step 1: Exécuter la migration sur la base locale**

Run: `cd Web\backend; alembic upgrade head`
Expected: `020_rh_conges_employe` appliquée sans erreur.

- [ ] **Step 2: Lancer TOUS les tests backend**

Run: `cd Web\backend; python -m pytest tests/ -v`
Expected: **PASS** (aucune régression).

- [ ] **Step 3: Build frontend complet**

Run: `cd Web\frontend; npm run build`
Expected: succès.

- [ ] **Step 4: Mettre à jour le graphe de connaissance**

Run: `cd "d:\Tia_info_projet\projet 2\TiaInfoBuild"; graphify update .`
Expected: update AST-only, nouveaux nœuds (`Conge`, `CongeCRUD`, endpoints congés/paie).

- [ ] **Step 5: Checklist de vérification manuelle (dev servers)**

1. Backend : `uvicorn app.main:app --reload` → `/docs` montre `/rh/conges*`, `/rh/paie*`, `/employe-terrain/conges*`
2. Login `rh` → RhPage : créer un congé, le valider → solde décrémenté
3. Login `employe` → Mes congés : demander, annuler
4. Onglet Paie : lignes cohérentes avec les pointages du mois, export CSV téléchargeable
5. Badge : l'impression n'affiche que la carte badge

- [ ] **Step 6: Commit final (éventuels ajustements)**

```bash
git add -A
git commit -m "chore(rh): verification finale etape 1 - conges, journaliers, CNAPS/OSTIE, paie"
```

---

## Self-Review (exécutée à la rédaction du plan)

1. **Couverture spec** :
   - Modèle `Conge` → T2 ; solde calculé → T4 ; Employe étendu + `Document.employe_id` + migration → T3
   - Endpoints RH congés/solde → T5 ; paie + CSV → T6 ; terrain self-only → T7
   - Types/services → T8 ; RhPage congés+paie → T9 ; EmployeCongesPage → T10 ; badge imprimable → T11 ; routing + fiche employé → T12 ; migration + validation → T13
   - Historique de poste : **existe déjà** via `POST /rh/employes/{id}/changer-poste` (crée `HistoriquePoste`) — T12 vérifie l'affichage UI timeline
   - Documents RH par employé : le champ `Document.employe_id` est créé (T3) ; l'upload dédié par employé est reporté en tâche de suivi si le pattern générique de `Document` ne permet pas de le brancher simplement (à confirmer à l'exécution de T5)
2. **Placeholders** : aucun « TBD » ; les ⚠️ marquent des vérifications obligatoires du code réel (colonnes `Pointage`, champs `Notification`, structure modal/onglets existante) — l'exécuteur lit d'abord le fichier réel avant d'implémenter.
3. **Cohérence des types/signatures** : `Conge`, `CongeListe`, `SoldeConge`, `LignePaie`, `RapportPaie` (T8) utilisés à l'identique en T9/T10 ; `CongeCRUD.solde_restant(db, employe)` et `decide(db, conge, *, statut, valide_par, commentaire)` (T4) consommés en T5/T7 ; `TYPES_VALIDES` (T3) réutilisé par le schéma terrain (T7).

