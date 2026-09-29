# Spec — Étape 1 : Module RH (Congés, Journaliers, CNAPS/OSTIE, Documents, Badge)

**Date :** 2026-09-11 · **Projet :** TiaInfoBuild · **Statut :** design approuvé en session

## 1. Contexte

Le graphe graphify (7 378 nœuds) montre que le backend dispose de `Employe`, `Pointage`
(+ `statut_validation` déjà présent), `HeureSupplementaire`, `HistoriquePoste`, `Document`
(orienté client) et d'un router `routers/rh.py` (70 connexions). Manquent : congés/absences,
distinction main d'œuvre journalière, suivi CNAPS/OSTIE, documents RH, badge avec photo,
et un rapport de paie calculé.

Séparation métier retenue (décision utilisateur) :
- **Pointage** = présence constatée (brut)
- **Journée validée** = pointage validé pour la paie (`statut_validation`)
- **Absence** = congé validé (justifiée) ou journée sans pointage ni congé (non justifiée)
- **Heures travaillées** = `HeureSupplementaire` + heures des pointages
- **Salaire** = calculé selon le contrat (`mode_remuneration`)

## 2. Périmètre

1. Nouveau modèle `Conge` + workflow Employé → RH valide → solde décrémenté
2. `Employe` étendu : `mode_remuneration`, taux, CNAPS/OSTIE
3. `Document` étendu : `employe_id` + catégories RH
4. `HistoriquePoste` auto-généré sur changement de poste/salaire/contrat
5. Badge imprimable avec photo (`EmployeBadgePage`)
6. Rapport de paie mensuel calculé à la volée + export CSV
7. Permissions RBAC mises à jour (backend + `permissions.ts`)

## 3. Modèle de données

### 3.1 Nouveau : `app/models/conge.py`

| Colonne | Type | Notes |
|---|---|---|
| id | BigInteger PK | |
| entreprise_id | FK entreprises.id CASCADE | nullable=False |
| employe_id | FK employes.id CASCADE | nullable=False |
| type | String(20) | `annuel`, `maladie`, `maternite`, `exceptionnel`, `sans_solde` (déf. `annuel`) |
| date_debut | Date | nullable=False |
| date_fin | Date | nullable=False |
| nb_jours | Integer | validé ≥ 1 au schéma |
| statut | String(20) | `en_attente` (déf.) → `valide` / `refuse` / `annule` |
| motif | Text | nullable |
| valide_par_id | FK utilisateurs.id | nullable |
| date_validation | DateTime | nullable |
| commentaire_refus | Text | nullable |
| is_deleted, created_at, updated_at | | pattern projet |

Indexes : `(entreprise_id, is_deleted)`, `(employe_id, statut)`. Relation inverse sur `Employe.conges`.

### 3.2 `Employe` (migration additive)

- `mode_remuneration` String(20) dft `mensuel` (`mensuel`, `journalier`, `horaire`, `a_la_tache`)
- `taux_journalier` Numeric(12,2) dft 0 · `taux_horaire` Numeric(10,2) dft 0
- `solde_conges_annuel` Integer dft 30 (Madagascar : 2,5 j/mois travaillé)
- `numero_cnaps` String(50) null · `numero_ostie` String(50) null
- `statut_declaration` String(20) dft `non_declare` (`non_declare`, `cnaps`, `cnaps_ostie`)

Solde courant = **calculé** : `solde_conges_annuel` − Σ nb_jours des `Conge` de type `annuel`
et statut `valide` dont l'année de `date_debut` = année courante. Aucune table de solde.

### 3.3 `Document` (extension)

- `employe_id` FK employes.id (nullable, ondelete CASCADE) + index
- `categorie` : valeurs RH ajoutées au domaine existant : `contrat_travail`, `cnaps`, `ostie`, `certificat`, `autre`

### 3.4 `Pointage` — aucun changement de schéma

`statut_validation` existe (dft `valide`). Nouvelle règle applicative :
- [2026-09-24] pointage créé par l'employé (terrain) → `attente` : **ligne obsolète** — l'auto-pointage employé a été supprimé, ce n'est plus un chemin du produit.
- pointage créé par RH/scan badge (rh.py `scan_badge_pointage`) → `valide` (inchangé) [2026-09-24] **mécanisme conservé** : c'est le scan du badge QR employé fait par le chef de chantier/RH.
- validation RH : `POST /rh/pointages/{id}/valider|refuser` → `valide` / `refuse`

> **[2026-09-24] Ménage :** qr-checkin, QR chantier et auto-pointage supprimés ; le pointage employé de terrain se fait par scan du badge (chef de chantier/RH) ou saisie manuelle.

### 3.5 `HistoriquePoste` — aucun changement de schéma

Création automatique : toute modification par RH de `poste`, `salaire_base` ou
`type_contrat` sur un employé existant insère une ligne `HistoriquePoste`
(`date_debut` = aujourd'hui, `date_fin` = aujourd'hui sur l'entrée précédente, `motif_changement` saisi).

### 3.6 Relations déclarées

- `Employe.conges` → list[`Conge`] · `Conge.valide_par` → `Utilisateur | None`
- `Entreprise.conges` (back_populates) · `Utilisateur.conges_validees`
- Modèle enregistré dans `app/models/__init__.py` (pattern projet)

## 4. Endpoints

### routers/rh.py (RH, admin_entreprise)

| Méthode | Route | Effet |
|---|---|---|
| POST | `/rh/conges` | créer une demande (pour un employé) |
| GET | `/rh/conges` | liste + filtres `statut`, `employe_id`, période ; pagination pattern projet |
| POST | `/rh/conges/{id}/valider` | statut → `valide`, renseigne `valide_par_id`/`date_validation` |
| POST | `/rh/conges/{id}/refuser` | statut → `refuse` + `commentaire_refus` |
| PATCH | `/rh/employes/{id}` | étendu (mode rémun., taux, CNAPS/OSTIE, solde annuel) → auto `HistoriquePoste` |
| POST | `/rh/employes/{id}/documents` | métadonnées + fichier → `Document` (`employe_id`) |
| GET | `/rh/employes/{id}/documents` | liste documents RH |
| POST | `/rh/pointages/{id}/valider` / `/refuser` | validation des pointages `attente` |
| GET | `/rh/paie?mois=&annee=` | rapport calculé (§6) |
| GET | `/rh/paie/export.csv` | même calcul, réponse CSV |

### routers/employe_terrain.py (employé, garde `employe_id == self`)

| Méthode | Route | Effet |
|---|---|---|
| POST | `/employe-terrain/conges` | demander un congé (`statut` dft `en_attente`) |
| GET | `/employe-terrain/conges` | ses demandes + solde courant |
| POST | `/employe-terrain/conges/{id}/annuler` | annuler ses demandes `en_attente` |

Chaque validation/refus crée une `Notification` in-app pour l'employé (modèle existant).

## 5. Permissions

- `permissions.ts` : `PERMISSION_MODULES` + `conges: "conges"` ; `PERMISSION_MAP` :
  - `rh` : `conges: "*"` · `admin_entreprise`/`super_admin` : couverts par `*` existant
  - `employe` : `conges: "read,write"` (création self-only, garde backend)
  - `chef_chantier` : `conges: "read"` (visibilité équipe)
- Backend : `_require_permission("conges", action)` — pattern existant ; en plus, toute
  écriture sur un congé par le rôle `employe` est restreinte à son propre `employe_id`.

## 6. Rapport de paie (calculé, non stocké)

GET `/rh/paie?mois=&annee=` renvoie, par employé actif :
- `journalier` : Σ journées validées (1 pointage présent validé = 1 jour) du mois × `taux_journalier`
- `horaire` : Σ heures pointées validées × `taux_horaire` ; + heures sup × taux applicable
- `mensuel` : `salaire_base` − absences non justifiées proratées au taux journalier
  (`salaire_base / nb_jours_mois_ouvrés_simple = 26`) — pas de règle légale encodée en v1
- `a_la_tache` : Σ `TravailRealise` validé du mois
- Colonnes par employé : congés validés (absences justifiées), absences non justifiées,
  heures sup, CNAPS/OSTIE déclarés ou non, montant dû
- CSV : séparateur `;`, montants entiers Ariary, `Content-Disposition: attachment`

## 7. Frontend

- **RhPage** — onglets :
  - « Congés & Absences » : liste (filtres statut/période), actions valider/refuser (modals pattern projet), soldes par employé
  - Fiche employé étendue : mode rémunération, taux, CNAPS/OSTIE, solde annuel
  - Timeline « Historique de poste » dans la fiche employé (lecture)
  - Section « Documents RH » dans la fiche employé (upload + liste, composants existants)
  - Validation des pointages `attente` (valider/refuser)
  - « Rapport de paie » : sélection mois/année, tableau, export CSV
- **EmployeCongesPage** (nouvelle, route `/employe/conges`) : demande, liste, solde, statuts
- **EmployeBadgePage** : photo (`emp.photo` si présent), bouton « Imprimer » (CSS print sur le bloc badge)
- `rh.service.ts` / `employeTerrain.service.ts` : nouvelles méthodes ; `types/index.ts` : `Conge`, extensions `Employe`
- Garde de route `/employe/conges` : rôle `employe` (pattern `EmployeLayout`)

## 8. Migration & seed

- Alembic `020_rh_conges_employe.py` (nom ≤ 32 caractères — règle projet) : table `conges`,
  colonnes `employes`, colonne `documents.employe_id` + index
- `app/scripts/init_db` : rien à ajouter (seed hérite des défauts) ; reste idempotent
- Rétrocompatibilité : colonnes ajoutées nullable/avec défaut → zéro coupure

## 9. Tests (minimal, pattern projet)

- Backend : script de vérification `/rh/paie` sur données seed ; valider/refuser (rôle RH) ;
  garde self-only employé ; `nb_jours >= 1` rejeté en 422
- Vérification existante : `python -m app.scripts.init_db` idempotent toujours OK

## 10. Hors périmètre (ponytail — ajoutés quand le besoin apparaît)

Bulletin de paie stocké, jours fériés paramétrés, report automatique de solde, validation
à 2 niveaux (RH + chef), email/notification externe (in-app existe déjà, réutilisée).

