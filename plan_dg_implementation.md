# Plan Opérationnel : Direction Générale (DG) / DAF

**Rôle de référence :** `roles_tia_builds/02_direction_generale.md`
**Contexte :** TIA INFO BUILD — Application de gestion pour entreprise BTP (Madagascar)
**Objectif :** Rendre le rôle Direction Générale / DAF opérationnel sans modification code

---

## 1. Phase de Démarrage (Jour 1-2)

### 1.1 Création du compte Direction Générale

| Étape | Action | Détail |
|---|---|---|
| 1 | Créer le compte DG principal | Email professionnel, mot de passe fort, authentification 2FA si disponible |
| 2 | Attribuer le rôle "Direction Générale" | Via le module Paramètres > Gestion des utilisateurs (par l'Administrateur d'Entreprise) |
| 3 | Configurer les notifications | Alertes critiques, dépassements budgétaires, validations en attente |

> **Compte de démo existant :** `directeur@btppro.mg` / `Admin123!` (créé par `init_db.py`).

### 1.2 Paramétrage initial par l'Administrateur d'Entreprise

```
À configurer dans Paramètres > Configuration Entreprise (par l'Admin) :
├── Informations générales
│   ├── Nom / Raison sociale
│   ├── NIF / STAT (référence EDBM)
│   ├── Logo de l'entreprise
│   └── Adresse siège (Antananarivo / Toamasina / Autre)
│
├── Paramètres financiers
│   ├── Devise : Ariary (MGA)
│   ├── TVA : 20 %
│   ├── Régime fiscal : [Synthétique / Réel]
│   └── Modes de paiement activés :
│       ├── Virement bancaire
│       ├── Espèces
│       ├── MVola (Telma)
│       ├── Orange Money
│       └── Airtel Money
│
├── Seuils d'alerte et de validation (configurés par l'Admin pour la DG)
│   ├── Seuil validation devis/contrats DG : [X] Ariary
│   ├── Seuil alerte dépassement budget chantier : [X] %
│   ├── Seuil alerte stock minimum : [X] unités
│   └── Seuil alerte maintenance matériel : [X] jours avant échéance
│
└── Paramètres techniques
    ├── Unités de mesure (mètre, m², m³, kg, litre...)
    ├── Fuseau heure : GMT+3 (Madagascar)
    ├── Langue principale : Français
    └── Mode offline-first : Activé (consultation mobile DG en déplacement)
```

---

## 2. Gestion des Accès (Récurrent)

### 2.1 Rôle de la DG dans la gestion des accès

La DG/DAF **ne crée pas** les comptes utilisateurs et **ne modifie pas** les permissions. Son périmètre est strictement limité à la consultation et à la validation stratégique.

| Action | Qui ? | Quand ? |
|---|---|---|
| Créer / modifier / désactiver un compte | Administrateur d'Entreprise | À la demande de la DG ou du responsable hiérarchique |
| Attribuer le rôle "Direction Générale" | Administrateur d'Entreprise | Lors de l'arrivée d'un nouveau dirigeant |
| Révoquer l'accès DG | Administrateur d'Entreprise | Sur demande explicite de la DG ou en cas de départ |

### 2.2 Processus d'onboarding d'un nouveau membre DG

```
Nouveau dirigeant / DAF arrivant
          │
          ▼
┌─────────────────────────────────────┐
│ 1. Créer le compte utilisateur      │
│    - Nom, prénom, email pro         │
│    - Téléphone (WhatsApp pro)       │
│    - Poste : Direction Générale     │
└─────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 2. Attribuer le rôle "Direction     │
│    Générale" (code : directeur)     │
│    Par l'Administrateur d'Entreprise│
└─────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 3. Configurer les seuils de         │
│    validation dans les paramètres   │
│    globaux (Admin)                  │
└─────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 4. Former l'utilisateur             │
│    - Accès et connexion             │
│    - Dashboard décisionnel          │
│    - Procédure de validation        │
│    - Consultation mobile             │
└─────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 5. Journaliser la création          │
│    dans le registre d'audit         │
└─────────────────────────────────────┘
```

### 2.3 Processus d'offboarding d'un membre DG

Lors du départ d'un dirigeant :
1. **Désactiver** le compte (ne pas supprimer — conservation audit)
2. **Révoquer** tous les tokens de session
3. **Réaffecter** les validations en attente à un autre dirigeant ou à l'Admin
4. **Journaliser** la désactivation avec motif

---

## 3. Modules et Écrans Accessibles — Configuration par l'Admin

### 3.1 Vue d'ensemble des accès DG

| Module | Niveau d'accès DG | Actions possibles dans le système actuel |
|---|---|---|
| Dashboard décisionnel | Lecture complète | Consultation de tous les indicateurs consolidés |
| Finance & Marges | Lecture + Validation dépenses | Consultation rapports ; validation des dépenses via `POST /api/finance/depenses/{id}/valider` |
| Chantiers & Phases | Lecture (vue consolidée) | Consultation état des projets, budgets prévus/réels |
| RH & Pointage | Lecture (indicateurs consolidés) | Consultation effectifs, taux d'absentéisme, coûts RH |
| Matériel / Stocks | Lecture (indicateurs consolidés) | Consultation disponibilité, coûts maintenance, alertes stock |
| Commercial | Lecture + Validation procédurale | Consultation devis, contrats, pipeline ; validation stratégique via procédure documentée |
| Paramètres & Utilisateurs | Aucun accès | Réservé à l'Administrateur d'Entreprise |

> **Note importante :** Dans la version actuelle, la DG ne dispose pas de droits d'écriture sur les devis et contrats. La validation de ces documents se fait donc par **procédure métier** (voir section 3.6).

### 3.2 Dashboard décisionnel

```
Le Dashboard doit présenter à la DG :
├── Indicateurs financiers consolidés
│   ├── Chiffre d'affaires global et par chantier
│   ├── Marge brute et marge nette (prévue vs réalisée)
│   ├── Taux d'avancement physique vs financier
│   └── Nombre d'alertes critiques actives
│
├── Performance des équipes
│   ├── Effectifs par département
│   ├── Taux de présence / absentéisme
│   └── Heures supplémentaires par équipe
│
├── Rentabilité chantiers
│   ├── Comparaison entre chantiers
│   ├── Classement par marge réalisée
│   └── Délais d'exécution (prévus vs réels)
│
└── Alertes critiques
    ├── Dépassements budgétaires
    ├── Ruptures de stock
    ├── Retards chantiers
    └── Maintenance matériel en retard
```

### 3.3 Finance & Marges

```
Données accessibles à la DG :
├── Budgets chantiers (prévu, prévisionnel, réel)
├── Dépenses par catégorie et par chantier
├── Rapports mensuels de marge
├── Factures et paiements (lecture seule)
├── Alertes de dépassement budgétaire
└── Validation des dépenses
    └── POST /api/finance/depenses/{id}/valider (endpoint actif)
```

**Procédure de validation des dépenses :**
1. Le Comptable saisit la dépense
2. Si la dépense dépasse le seuil configuré, une alerte est remontée à la DG
3. La DG consulte le détail et valide ou rejette via l'endpoint de validation
4. Le résultat est tracé dans le journal d'audit

### 3.4 Chantiers & Phases

```
Données accessibles à la DG :
├── Liste de tous les chantiers (toutes équipes)
├── Budget prévu / prévisionnel / réel par chantier
├── Taux d'avancement physique et financier
├── Statuts des chantiers (en étude, en cours, en pause, terminé...)
├── Incidents et alertes par chantier
└── Comparaison consolidée entre chantiers
```

### 3.5 RH & Pointage

```
Données accessibles à la DG (indicateurs consolidés uniquement) :
├── Effectifs total et par département
├── Masse salariale consolidée
├── Taux d'absentéisme
├── Heures supplémentaires par département
├── Alertes : contrats arrivant à échéance, déclarations CNAPS/OSTIE à faire
└── Coûts RH par chantier
```

### 3.6 Commercial — Validation procédurale des devis et contrats

> **Contexte :** Le système actuel ne permet pas à la DG de modifier/valider techniquement les devis et contrats (accès en lecture seule). La validation se fait par procédure métier.

**Workflow de validation procédurale :**

```
Commercial prépare un devis/contrat
          │
          ▼
┌─────────────────────────────────────┐
│ 1. Vérification automatique         │
│    - Montant > seuil DG ?           │
│    - Si OUI → alerte envoyée à la DG│
└─────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 2. Consultation DG                  │
│    - DG consulte le devis/contrat   │
│    - Via Dashboard ou module        │
│      Commercial (lecture seule)     │
└─────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 3. Validation stratégique           │
│    - DG approuve via :              │
│      • Email sécurisé au Commercial  │
│      • Réunion de validation        │
│      • Note de validation signée    │
└─────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 4. Enregistrement                  │
│    - Commercial met à jour le statut│
│    - DG référence la validation     │
│      dans ses notes/rapports        │
└─────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 5. Traçabilité                     │
│    - Date, montant, référence       │
│    - Conservée dans les rapports DG │
└─────────────────────────────────────┘
```

**Alternative technique (si modification code ultérieure) :** Ajout d'un endpoint `POST /api/commercial/devis/{id}/valider` avec vérification du rôle `directeur`.

### 3.7 Matériel & Stocks (lecture consolidée)

```
Données accessibles à la DG :
├── Parc matériel : disponibilité, statuts
├── Alertes maintenance préventive
├── Stocks : niveaux, seuils d'alerte, mouvements
├── Fournisseurs : évaluation, délais de livraison
└── Coûts associés (carburant, maintenance, approvisionnement)
```

---

## 4. Supervision et Sécurité (Quotidien / Hebdomadaire / Mensuel)

### 4.1 Checklist quotidienne

```
□ Vérifier les alertes critiques actives
  ├── Dépassement budgétaire chantier
  ├── Rupture de stock critique
  ├── Maintenance matériel en retard
  └── Retard chantier > [X] jours

□ Consulter le tableau de bord décisionnel
  ├── Évolution CA / marge du jour
  ├── Nouveaux devis/contrats en attente de validation
  └── Dépenses importantes à valider

□ Valider les demandes en attente
  ├── Dépenses dépassant le seuil
  ├── Devis/contrats stratégiques (procédure)
  └── Décisions de lancement / suspension chantier
```

### 4.2 Checklist hebdomadaire

```
□ Revue des indicateurs financiers
  ├── CA semaine vs prévisionnel
  ├── Dépenses par catégorie
  └── Marge chantiers en cours

□ Revue des chantiers
  ├── Avancement physique vs financier
  ├── Délais : risques de retard
  └── Arbitrage ressources si nécessaire

□ Revue des alertes
  ├── Alertes critiques non traitées
  ├── Actions correctives à lancer
  └── Escalade vers Chef de Projet si blocage

□ Validation des décisions stratégiques
  ├── Lancement / suspension / arrêt chantier
  └── Réaffectation budgétaire si nécessaire
```

### 4.3 Checklist mensuelle

```
□ Rapport financier mensuel
  ├── CA, dépenses, marge consolidés
  ├── Comparaison N-1
  └── Prévisions mois prochain

□ Revue de rentabilité des chantiers
  ├── Chantiers les plus/moins rentables
  ├── Actions correctives
  └── Décision d'arrêt si dépassement critique

□ Bilan des validations
  ├── Nombre de devis/contrats validés
  ├── Dépenses validées
  └── Taux de respect des seuils

□ Réunion de pilotage
  ├── Avec Comptable : résultats financiers
  ├── Avec Chef de Projet : avancement chantiers
  └── Avec Commercial : pipeline et contrats
```

---

## 5. KPIs suivis par la DG

### 5.1 Indicateurs de pilotage stratégique

| KPI | Fréquence | Source | Action si hors cible |
|---|---|---|---|
| Chiffre d'affaires global et par chantier | Mensuel | Finance & Marges | Arbitrage commercial / arrêt chantier déficitaire |
| Marge brute et marge nette (prévue vs réalisée) | Mensuel | Finance & Marges | Révision budgets, renégociation fournisseurs |
| Taux d'avancement physique vs financier | Hebdo | Chantiers & Phases | Alerte Chef de Projet, arbitrage ressources |
| Nombre d'alertes critiques actives | Quotidien | Alertes | Traitement prioritaire, escalade si nécessaire |
| Rentabilité comparée entre chantiers | Mensuel | Finance & Marges | Réaffectation investissements |
| Taux de validation DG (délai moyen) | Mensuel | Procédures internes | Optimisation du processus de validation |
| Dépenses validées par la DG | Mensuel | Finance | Contrôle de la dérive budgétaire |

### 5.2 Tableau de bord de supervision

```
┌─────────────────────────────────────────────────────────────────┐
│           TABLEAU DE BORD DIRECTION GÉNÉRALE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ CHIFFRE AFFAIRES│  │ MARGE GLOBALE   │  │ ALERTES CRITIQUES│ │
│  │     XXX M MGA   │  │     XX.X %      │  │       X         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ RENTABILITÉ PAR CHANTIER                                     ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ Chantier A    : Marge 25%  ✓                              ││
│  │ Chantier B    : Marge -5%  ✗ (dépassement budget)          ││
│  │ Chantier C    : Marge 18%  ⚠ (surveillance)               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │ VALIDATIONS EN ATTENTE│  │ ÉVOLUTION CA / MARGE             │ │
│  │ ───────────────────  │  │ ─────────────────────────────── │ │
│  │ • Devis X : 45M MGA  │  │  [Graphique d'évolution]        │ │
│  │ • Dépense Y : 12M MGA│  │                                  │ │
│  │ • Contrat Z : 80M MGA│  │                                  │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Interactions avec les Autres Rôles

### 6.1 Avec l'Administrateur d'Entreprise

| Situation | Action de la DG | Action de l'Admin | Livrable |
|---|---|---|---|
| Configuration initiale | Définir les besoins métier, les seuils de validation | Configurer techniquement les seuils dans le système | Paramètres documentés |
| Demande de nouvel accès | Valider la pertinence métier | Créer le compte, configurer les droits | Accès opérationnel |
| Anomalie de sécurité | Alerter, demander investigation | Investiguer, documenter, prendre mesures | Rapport incident |
| Changement stratégique | Définir la nouvelle direction | Adapter les permissions et configurations si besoin | Mise à jour système |
| Revue mensuelle | Analyser les KPIs sécurité et opérationnels | Présenter les données d'audit | Rapport mensuel conjoint |

### 6.2 Avec le Comptable / Responsable Financier

| Situation | Action de la DG | Action du Comptable |
|---|---|---|
| Revue financière mensuelle | Analyser, arbitrer, décider | Préparer les rapports, expliquer les écarts |
| Validation de dépenses importantes | Valider ou rejeter via endpoint | Saisir, soumettre à validation |
| Alerte de dépassement budgétaire | Arbitrer (couper / réaffecter / accepter) | Alerter, proposer des correctifs |
| Définition des seuils de validation | Fixer les seuils stratégiques | Configurer dans le système (avec Admin) |
| Clôture comptable | Valider les écritures de fin de période | Préparer, soumettre pour validation |

### 6.3 Avec le Chef de Projet / Directeur Technique

| Situation | Action de la DG | Action du Chef de Projet |
|---|---|---|
| Arbitrage des priorités entre chantiers | Décider des priorités, allouer les ressources | Proposer, exécuter, reporter l'avancement |
| Lancement / suspension / arrêt chantier | Décider | Mettre en œuvre, informer les équipes |
| Revue d'avancement hebdomadaire | Analyser, valider les jalons | Présenter l'avancement, les risques, les besoins |
| Affectation des ressources | Valider l'allocation (budget, matériel, équipes) | Proposer l'allocation optimale |

### 6.4 Avec le Commercial

| Situation | Action de la DG | Action du Commercial |
|---|---|---|
| Validation devis/contrats > seuil | Approuver / rejeter (procédure) | Préparer, soumettre, enregistrer la validation |
| Définition de la politique commerciale | Valider les conditions générales | Appliquer, négocier avec les clients |
| Pipeline de vente | Valider les opportunités stratégiques | Prospector, qualifier, convertir |
| Revue mensuelle commerciale | Analyser CA, marge, pipeline | Présenter résultats, forecast |

### 6.5 Avec le Responsable RH

| Situation | Action de la DG | Action du RH |
|---|---|---|
| Masse salariale | Valider les augmentations, les embauches cadres | Proposer, mettre en œuvre, déclarer CNAPS/OSTIE |
| Effectifs chantiers | Valider les affectations stratégiques | Gérer les contrats, le pointage, les déclarations |
| Départ d'un cadre | Valider les indemnités, le préavis | Gérer la procédure administrative |

---

## 7. Procédures d'Urgence

### 7.1 Décision d'arrêt ou de suspension d'un chantier

```
SITUATION CRITIQUE DÉTECTÉE
        │
        ▼
┌──────────────────────────────────────┐
│ 1. Constat                           │
│    ├── Dépassement budget > [X] %    │
│    ├── Retard critique > [X] jours   │
│    ├── Incident sécurité grave        │
│    └── Problème de solvabilité client │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 2. Consultation des données          │
│    ├── Dashboard décisionnel         │
│    ├── Rapports financiers           │
│    └── Avis Chef de Projet           │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 3. Décision DG                       │
│    ├── SUSPENSION temporaire         │
│    ├── ARRÊT définitif               │
│    └── POURSUITE avec correctifs     │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 4. Mise en œuvre                     │
│    ├── Chef de Projet : exécution    │
│    ├── Commercial : information client│
│    ├── RH : réaffectation équipes    │
│    └── Comptable : arrêt des dépenses│
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 5. Traçabilité                       │
│    ├── Décision datée et signée      │
│    ├── Motif documenté               │
│    └── Communication à l'Admin       │
└──────────────────────────────────────┘
```

### 7.2 Alerte de dépassement budgétaire

```
ALERTE DÉPASSEMENT BUDGÉTAIRE
        │
        ▼
┌──────────────────────────────────────┐
│ 1. Réception alerte                  │
│    (automatique via Dashboard)       │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 2. Analyse DG                        │
│    ├── Consulter le détail des       │
│    │   dépenses par catégorie        │
│    ├── Évaluer l'écart               │
│    └── Consulter le Chef de Projet   │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 3. Arbitrage                         │
│    ├── Réaffectation d'enveloppe     │
│    ├── Réduction des dépenses        │
│    └── Acceptation du dépassement    │
│       (si justifié)                  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 4. Instruction                        │
│    ├── Au Comptable : gel / révision │
│    └── Au Chef de Projet : mesures   │
│       correctives                    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 5. Suivi                             │
│    └── Vérifier retour à la normale  │
│        dans les [X] jours            │
└──────────────────────────────────────┘
```

### 7.3 Perte d'identifiants / urgence DG

```
DEMANDE DE RÉINITIALISATION DG
        │
        ▼
┌──────────────────────────────────────┐
│ 1. Vérification renforcée            │
│    ├── Appel téléphonique confirmé   │
│    ├── Vérification identité         │
│    │   (second dirigeant ou Admin)   │
│    └── Email professionnel vérifié   │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 2. Réinitialisation                  │
│    ├── Par l'Administrateur          │
│    ├── Mot de passe temporaire       │
│    └── Envoi par canal sécurisé      │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 3. Forcer le changement              │
│    ├── À la prochaine connexion      │
│    └── Journaliser l'opération       │
└──────────────────────────────────────┘
```

---

## 8. Spécificités Madagascar — Obligations DG

### 8.1 Paramètres financiers (OBLIGATOIRE)

```
À vérifier dans le module Finance (configuré par l'Admin) :
├── Devise : Ariary (MGA) — pas de centimes
├── TVA : 20 % (conforme DGI)
├── Modes de paiement :
│   ├── Virement bancaire (BMOI, BFV, BNI, ABA...)
│   ├── Espèces
│   ├── MVola (Telma) — OBLIGATOIRE pour paiements terrain
│   ├── Orange Money
│   └── Airtel Money
├── Types de documents :
│   ├── Devis (validité 15-30 jours, clause révision prix)
│   ├── Facture (conforme DGI — mention TVA, NIF, STAT)
│   ├── Avoir
│   └── Situation de travaux (décompte mensuel marchés)
└── Retenue de garantie : [X] % (marchés publics)
```

### 8.2 Seuils de validation DG (à configurer par l'Admin)

```
Seuils globaux à définir :
├── Validation DG pour devis : [X] MGA
│   └── Recommandation : > 10 000 000 MGA (~2 500 EUR)
├── Validation DG pour contrats : [X] MGA
│   └── Recommandation : > 50 000 000 MGA (~12 500 EUR)
├── Validation DG pour dépenses : [X] MGA
│   └── Recommandation : > 5 000 000 MGA (~1 250 EUR)
└── Alerte dépassement budget chantier : [X] %
    └── Recommandation : 10 %
```

### 8.3 Main d'œuvre et conformité sociale

```
À superviser par la DG :
├── Distinction employés déclarés / journaliers
│   ├── Déclarés : CNAPS + OSTIE obligatoires
│   └── Journaliers : paiement Mobile Money / Espèces
├── Alerte :
│   └── Si journalier > 90 jours → régularisation recommandée
└── Déclarations mensuelles CNAPS/OSTIE
    └── Vérifier dans le module RH (lecture seule)
```

### 8.4 Paramètres climatiques et logistiques

```
À prendre en compte dans les décisions DG :
├── Saison des pluies : Novembre → Mars
├── Saison cyclonique : Décembre → Mars (côte Est)
├── Zones à risque :
│   ├── Côte Est (Toamasina) : cyclones
│   ├── Hauts plateaux (Antananarivo) : coupures route RN2
│   └── Sud (Toliara) : sécheresse
├── Délais d'approvisionnement :
│   ├── Matériaux locaux : [X] jours
│   └── Matériaux importés (Toamasina) : [X] jours + douane
└── Retard "force majeure climatique" : documenté dans le système
```

### 8.5 Consultation mobile

```
Configuration pour la DG en déplacement :
├── Accès mobile au Dashboard décisionnel
├── Notifications push (alertes critiques)
├── Validation des dépenses via endpoint mobile
└── Consultation offline du dashboard (si mode offline activé)
```

---

## 9. Documentation et Traçabilité

### 9.1 Registre des décisions stratégiques

Chaque décision de la DG doit être tracée :

| Champ | Description |
|---|---|
| Date/Heure | Horodatage automatique |
| Dirigeant | Qui a pris la décision |
| Type de décision | Validation budget / devis / contrat / arrêt chantier / etc. |
| Montant / référence | Montant en jeu ou référence document |
| Justification | Motif stratégique ou financier |
| Impact attendu | Sur le chantier / l'entreprise |
| Suivi | Date de revue prévue |

### 9.2 Documents à produire

| Document | Fréquence | Destinataire | Contenu |
|---|---|---|---|
| Rapport de pilotage mensuel | Mensuel | Conseil / Assemblée | CA, marge, rentabilité chantiers, alertes |
| Rapport des validations | Mensuel | Comptable / Admin | Liste des devis/contrats/dépenses validés |
| Bilan chantier | Par chantier terminé | Direction | Rentabilité finale, écarts, enseignements |
| Registre des décisions stratégiques | Continu | Audit interne | Toutes les décisions avec justification |

---

## 10. Plan de Progression

### Semaine 1 : Mise en place
- [ ] Création du compte DG (ou utilisation du compte de démo)
- [ ] Configuration des seuils de validation par l'Admin
- [ ] Test de connexion et d'accès au Dashboard
- [ ] Configuration des notifications DG

### Semaine 2 : Prise en main des modules
- [ ] Consultation du Dashboard décisionnel (vue d'ensemble)
- [ ] Revue des budgets et marges par chantier
- [ ] Revue des alertes et indicateurs RH consolidés
- [ ] Revue du pipeline commercial et des devis en cours

### Semaine 3 : Activation des validations
- [ ] Test de validation d'une dépense via endpoint
- [ ] Mise en place de la procédure de validation devis/contrats
- [ ] Validation du premier budget chantier (procédure)
- [ ] Revue hebdomadaire avec Chef de Projet

### Semaine 4 : Pilotage actif
- [ ] Premier rapport de pilotage mensuel
- [ ] Arbitrage d'une alerte de dépassement budgétaire
- [ ] Ajustement des seuils de validation si nécessaire
- [ ] Procédures d'urgence testées

---

## Annexes

### Annexe A — Modèle de validation stratégique

```
VALIDATION STRATÉGIQUE — DIRECTION GÉNÉRALE
────────────────────────────────────────────
Date : [JJ/MM/AAAA]
Dirigeant : [Nom, Fonction]
Type : [Budget / Devis / Contrat / Dépense / Arrêt chantier]
Référence : [N° devis / contrat / chantier]
Montant : [X] MGA
Objet : [Description courte]

Décision : [APPROUVÉ / REJETÉ / AJOURNÉ]
Conditions si approbation : [Liste si applicable]

Signature : [Nom]
Date : [JJ/MM/AAAA]
```

### Annexe B — Contacts utiles

| Organisme | Usage | Contact |
|---|---|---|
| DGI | Fiscalité, conformité facturation | Vérifier site officiel |
| CNAPS | Déclarations sociales salariés | Agence locale |
| OSTIE | Santé entreprise | Agence locale |
| EDBM | Formalités entreprise (NIF, STAT) | Guichet unique |
| Support TIA INFO BUILD | Technique plateforme | [À compléter] |

### Annexe C — Récapitulatif des endpoints utiles pour la DG

| Action | Endpoint | Méthode | Rôle requis |
|---|---|---|---|
| Consulter le dashboard | `/api/dashboard/resume` | GET | `directeur` |
| Valider une dépense | `/api/finance/depenses/{id}/valider` | POST | `directeur` |
| Liste des dépenses | `/api/finance/depenses` | GET | `directeur` |
| Rapports mensuels | `/api/finance/rapports/mensuel` | GET | `directeur` |
| Liste des chantiers | `/api/chantiers/` | GET | `directeur` |
| Liste des devis | `/api/commercial/devis` | GET | `directeur` |
| Liste des contrats | `/api/commercial/contrats` | GET | `directeur` |
| Alertes actives | `/api/alertes/` | GET | `directeur` |

---

**Document créé pour :** TIA INFO BUILD — Rôle Direction Générale / DAF
**Contexte :** Entreprise BTP à Madagascar
**Version :** 1.0
**Prochaine révision :** Après 3 mois d'opération
