# Amélioration Gestion des Employés — Plan d'implémentation

## Objectif

Permettre à un employé de changer de poste au cours de sa carrière, avec traçabilité de l'historique, et ajouter le type de contrat (CDI, CDD, Intérim, Stage, etc.).

---

## Changements Base de Données

### [MODIFY] Table `Employe`
Ajouter 3 colonnes via migration `ensureColumn` (compatibilité bases existantes) :
- `typeContrat TEXT DEFAULT 'CDI'` → type de contrat actuel
- `dateDebutContrat DATE` → date début du contrat en cours
- `dateFinContrat DATE` → date fin (NULL si CDI)

### [NEW] Table `HistoriquePoste`
Nouvelle table pour tracer chaque changement de poste ou de contrat :

```sql
CREATE TABLE IF NOT EXISTS HistoriquePoste (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entrepriseId INTEGER NOT NULL,
  employeId INTEGER NOT NULL,
  poste TEXT NOT NULL,           -- Intitulé du poste
  typeContrat TEXT,              -- CDI, CDD, Intérim, Stage
  salaireBase REAL DEFAULT 0,    -- Salaire à ce poste
  dateDebut DATE NOT NULL,       -- Début de cette période
  dateFin DATE,                  -- Fin (NULL = poste actuel)
  motifChangement TEXT,          -- Raison du changement (Promotion, Mutation, etc.)
  is_deleted INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employeId) REFERENCES Employe(id) ON DELETE CASCADE,
  FOREIGN KEY (entrepriseId) REFERENCES Entreprise(id)
)
```

---

## Proposed Changes

### Base de données — `init.js`
#### [MODIFY] [init.js](file:///d:/Tia_info_projet/projet%202/TiaInfoBuild/Desktop/models/init.js)
- Ajouter la table `HistoriquePoste`
- Ajouter les migrations `ensureColumn` pour `Employe` (typeContrat, dateDebutContrat, dateFinContrat)

---

### Repository — `EmployeRepository.js`
#### [MODIFY] [EmployeRepository.js](file:///d:/Tia_info_projet/projet%202/TiaInfoBuild/Desktop/models/repositories/EmployeRepository.js)
- `createWithValidation()` : lors de la création, créer automatiquement un enregistrement dans `HistoriquePoste`
- `changerPoste(employeId, newData)` : fermer le poste actuel (`dateFin`) et créer le nouveau dans `HistoriquePoste`, mettre à jour `Employe`
- `getWithRelations()` : inclure l'historique de carrière

### [NEW] `HistoriquePosteRepository.js`
- `getByEmploye(employeId)` : retourne l'historique complet trié par date
- `getPosteActuel(employeId)` : retourne la ligne sans `dateFin`
- `changerPoste(data)` : ferme l'ancien, crée le nouveau

---

### Controllers — `main.js`
#### [MODIFY] [main.js](file:///d:/Tia_info_projet/projet%202/TiaInfoBuild/Desktop/main.js)
- Ajouter repo `historiquePostes` dans `repos`
- Ajouter handlers IPC :
  - `employes:changerPoste` → `(employeId, data)` — change de poste + historique
  - `employes:historiquePoste` → `(employeId)` — liste l'historique

---

### Vue Employés — `index.html` + `index.js`
#### [MODIFY] [index.html](file:///d:/Tia_info_projet/projet%202/TiaInfoBuild/Desktop/views/rh/employes/index.html)
- **Formulaire de création/édition** : ajout des champs `typeContrat`, `dateEmbauche`, `dateDebutContrat`, `dateFinContrat`
- **Colonne "Contrat"** dans le tableau de liste
- **Bouton "Changer de poste"** dans les actions de chaque ligne
- **Modale "Changement de poste"** : champs `nouveauPoste`, `typeContrat`, `nouveauSalaire`, `dateDebut`, `motifChangement`
- **Onglet "Carrière"** dans la modale d'édition affichant l'historique des postes

#### [MODIFY] [index.js](file:///d:/Tia_info_projet/projet%202/TiaInfoBuild/Desktop/views/rh/employes/index.js)
- `openModalChangerPoste(id)` : charger l'employé et ouvrir la modale de changement de poste
- `handleChangerPoste()` : soumettre IPC `employes:changerPoste`
- `renderHistoriquePoste(historique)` : afficher le timeline de carrière

---

## Types de contrats gérés
| Code | Libellé |
|---|---|
| CDI | Contrat à durée indéterminée |
| CDD | Contrat à durée déterminée |
| INTERIM | Intérim |
| STAGE | Stage |
| APPRENTISSAGE | Apprentissage / Alternance |
| JOURNALIER | Journalier (fréquent en BTP Madagascar) |
| SAISONNIER | Saisonnier |

## Verification Plan
- Tester la création d'un employé → vérifier entrée dans `HistoriquePoste`
- Tester "Changer de poste" → vérifier que l'ancien a `dateFin` et le nouveau a `dateFin = NULL`
- Vérifier l'historique de carrière affiché dans la vue
- Tester le filtre par type de contrat dans la liste
