# Plan Opérationnel : Administrateur d'Entreprise

**Rôle de référence :** `roles_tia_builds/01_admin_entreprise.md`
**Contexte :** TIA INFO BUILD — Application de gestion pour entreprise BTP (Madagascar)
**Objectif :** Rendre le rôle Administrateur d'Entreprise opérationnel sans modification code

---

## 1. Phase de Démarrage (Jour 1-2)

### 1.1 Création du compte Administrateur

| Étape | Action | Détail |
|---|---|---|
| 1 | Créer le compte admin principal | Email professionnel, mot de passe fort, authentification 2FA si disponible |
| 2 | Attribuer le rôle "Administrateur d'Entreprise" | Via le module Paramètres > Gestion des utilisateurs |
| 3 | Configurer les notifications | Alertes sécurité, activité suspecte, modifications de permissions |

### 1.2 Paramétrage initial de l'entreprise

```
À configurer dans Paramètres > Configuration Entreprise :
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
├── Paramètres techniques
│   ├── Unités de mesure (mètre, m², m³, kg, litre...)
│   ├── Fuseau heure : GMT+3 (Madagascar)
│   ├── Langue principale : Français
│   └── Mode offline-first : Activé (connectivité terrain)
│
└── Seuils d'alerte globaux
    ├── Seuil alerte budget chantier : [X] % de dépassement
    ├── Seuil alerte stock minimum : [X] unités
    ├── Seuil alerte maintenance matériel : [X] jours avant échéance
    └── Seuil validation devis DG : [X] Ariary
```

---

## 2. Gestion des Comptes et Accès (Récurrent)

### 2.1 Processus d'onboarding d'un nouvel employé

```
Nouvel employé arrivant
         │
         ▼
┌─────────────────────────────────────┐
│ 1. Créer le compte utilisateur      │
│    - Nom, prénom, email pro         │
│    - Téléphone (WhatsApp pro)       │
│    - Poste / Fonction               │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ 2. Attribuer le rôle approprié      │
│    (voir matrice des rôles)         │
│    - Direction Générale             │
│    - Chef de Chantier               │
│    - Comptable / Responsable Fin.   │
│    - RH / Gestion personnel         │
│    - Commercial                     │
│    - Gestionnaire de stock          │
│    - Conducteur de matériel         │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ 3. Configurer les permissions       │
│    module par module                │
│    (voir section 3 ci-dessous)      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ 4. Former l'utilisateur             │
│    - Accès et connexion             │
│    - Module(s) dont il est responsable│
│    - Procédures spécifiques         │
│    - Mode offline si terrain        │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ 5. Journaliser la création          │
│    dans le registre d'audit         │
└─────────────────────────────────────┘
```

### 2.2 Matrice des rôles et permissions

| Module | DG/DAF | Chef Chantier | Comptable | RH | Commercial | Gestionnaire Stock |
|---|---|---|---|---|---|---|
| **Dashboard** | Lecture complète | Lecture chantiers assignés | Lecture financiers | Lecture RH | Lecture commercial | Lecture stocks |
| **Chantiers** | Lecture | Lecture/Écriture (si assigné) | Lecture | Aucun | Lecture | Lecture |
| **Finance** | Lecture/Validation | Lecture budget chantier | Lecture/Écriture | Aucun | Lecture | Aucun |
| **RH/Pointage** | Lecture | Lecture équipe | Aucun | Lecture/Écriture | Aucun | Aucun |
| **Matériel** | Lecture | Lecture/Écriture | Aucun | Aucun | Aucun | Lecture |
| **Stocks** | Lecture | Lecture | Aucun | Aucun | Lecture | Lecture/Écriture |
| **Commercial** | Lecture/Validation | Aucun | Lecture | Aucun | Lecture/Écriture | Aucun |
| **Paramètres** | Aucun | Aucun | Aucun | Aucun | Aucun | Aucun |
| **Utilisateurs** | Aucun | Aucun | Aucun | Aucun | Aucun | Aucun |
| **Audit/Logs** | Aucun | Aucun | Aucun | Aucun | Aucun | Aucun |

> **Note :** L'Administrateur d'Entreprise est le seul avec accès aux modules "Paramètres", "Utilisateurs" et "Audit/Logs".

### 2.3 Processus d'offboarding

Lors du départ d'un employé :
1. **Désactiver** le compte (ne pas supprimer — conservation audit)
2. **Révoquer** tous les tokens de session
3. **Réaffecter** les chantiers/ressources en cours à un autre utilisateur
4. **Journaliser** la désactivation avec motif (démission, fin contrat, autre)

---

## 3. Configuration Métier par Module

### 3.1 Module Finance

```
Configuration Finance :
├── Plan comptable simplifié
│   ├── Produits (ventes, prestations)
│   ├── Charges (matériaux, main d'œuvre, sous-traitance)
│   └── Charges indirectes (loyer, électricité, carburant)
│
├── Modes de paiement (MANDATORY pour Madagascar)
│   ├── Virement bancaire (BMOI, BFV, BNI...)
│   ├── Espèces
│   ├── MVola (référence opérateur Telma)
│   ├── Orange Money
│   └── Airtel Money
│
├── Types de documents
│   ├── Devis (validité 15-30 jours, clause révision prix)
│   ├── Facture (conforme DGI - mention TVA, NIF)
│   ├── Avoir
│   └── Situation de travaux (décompte mensuel marchés)
│
└── Seuils de validation
    ├── Seuil validation DG pour devis : [X] MGA
    └── Seuil alerte dépassement budget : [X] %
```

### 3.2 Module Chantiers

```
Configuration Chantiers :
├── Structure type des phases
│   ├── Études / Conception
│   ├── Terrassement / Fondations
│   ├── Gros œuvre
│   ├── Second œuvre (électricité, plomberie)
│   └── Finitions / Réception
│
├── Types de chantier
│   ├── Construction neuve
│   ├── Rénovation / Réhabilitation
│   ├── Infrastructure (voirie, réseaux)
│   └── Marché public (cautions, retenue garantie)
│
├── Statuts
│   ├── En étude
│   ├── En attente validation DG
│   ├── En cours
│   ├── En pause (aléa climatique, autre)
│   ├── En retard
│   └── Terminé / Réceptionné
│
├── Paramètres climatiques (Madagascar)
│   ├── Saison des pluies : Novembre → Mars
│   ├── Saison cyclonique : Décembre → Mars (côte Est)
│   └── Période à risque : marquée dans le planning
│
└── Types de ressources affectables
    ├── Main d'œuvre journalière (informelle)
    ├── Main d'œuvre déclarée (CNAPS)
    ├── Engins / Matériel interne
    └── Sous-traitance
```

### 3.3 Module RH

```
Configuration RH :
├── Types de contrats
│   ├── CDI (employé déclaré - CNAPS/OSTIE)
│   ├── CDD
│   ├── Journalier / Tâcheron (informel)
│   └── Prestataire / Sous-traitant
│
├── Catégories de personnel
│   ├── Direction / Encadrement
│   ├── Maître d'œuvre / Conducteur de travaux
│   ├── Chef d'équipe / Contremaître
│   ├── Ouvriers qualifiés (maçons, électriciens, plombiers...)
│   └── Manœuvres / Journaliers
│
├── Paramètres CNAPS/OSTIE
│   ├── Taux patronal : [X] %
│   ├── Taux salarial : [X] %
│   ├── Plafond de cotisation
│   └── Organisme santé : OSTIE / Autre
│
├── Pointage
│   ├── Mode bureau : saisie hebdomadaire
│   └── Mode terrain : saisie mobile (offline-first)
│
└── Alertes
    ├── Contrat CDD arrivant à échéance : [X] jours
    └── Déclaration CNAPS à faire : date mensuelle
```

### 3.4 Module Matériel

```
Configuration Matériel :
├── Catégories d'engins
│   ├── Engins de terrassement (pelle, bulldozer, chargeuse)
│   ├── Engins de transport (camion, benne, toupie béton)
│   ├── Outils de chantier (compacteur, vibreur...)
│   └── Véhicules utilitaires
│
├── Statuts de disponibilité
│   ├── Disponible
│   ├── Affecté à un chantier
│   ├── En maintenance
│   └── Hors service
│
├── Maintenance
│   ├── Maintenance préventive (heures/km)
│   ├── Maintenance curative (panne)
│   └── Alertes : [X] heures/km avant révision
│
└── Coûts
    ├── Amortissement par engin
    ├── Coût carburant
    └── Coût maintenance prévisionnel
```

### 3.5 Module Stocks

```
Configuration Stocks :
├── Catégories de matériaux
│   ├── Liants (ciment, chaux)
│   ├── Granulats (sable, gravier, cailloux)
│   ├── Aciers (fer à béton, treillis soudé)
│   ├── Bois / Coffrage
│   ├── Matériaux de finition (carrelage, sanitaire, peinture)
│   └── Quincaillerie / Accessoires
│
├── Fournisseurs
│   ├── Nom / Contact
│   ├── Délai de livraison moyen
│   ├── Conditions de paiement
│   └── Évaluation (qualité / respect délais)
│
├── Lieux de stockage
│   ├── Dépôt central
│   ├── Chantier [Nom]
│   └── Fournisseur (en transit / douane)
│
└── Alertes
    ├── Seuil de rupture : [X] unités
    └── Délai réapprovisionnement : [X] jours
```

### 3.6 Module Commercial

```
Configuration Commercial :
├── Pipeline de vente
│   ├── Prospection
│   ├── Devis envoyé
│   ├── Négociation
│   ├── Devis accepté → Contrat
│   ├── En cours d'exécution
│   └── Clôturé (facturé / payé)
│
├── Types de clients
│   ├── Particulier
│   ├── Entreprise privée
│   ├── Administration publique
│   └── Bailleur international (BM, AFD, BAD, UE)
│
├── Conditions de paiement
│   ├── Acompte à la commande : [X] %
│   ├── Paiement à réception : [X] jours
│   └── Retenue de garantie : [X] % (marchés publics)
│
└── Seuils
    ├── Validation DG si devis > [X] MGA
    └── Alerte si devis sans réponse > [X] jours
```

---

## 4. Supervision et Sécurité (Quotidien / Hebdomadaire)

### 4.1 Checklist quotidienne

```
□ Vérifier les alertes critiques actives
  ├── Dépassement budgétaire chantier
  ├── Rupture de stock critique
  ├── Maintenance matériel en retard
  └── Accès suspects détectés

□ Consulter le journal d'activité (dernières 24h)
  ├── Connexions réussies / échouées
  ├── Modifications de permissions
  └── Exports de données sensibles

□ Vérifier la synchronisation offline
  ├── Nombre d'appareils en attente de sync
  └── Erreurs de synchronisation
```

### 4.2 Checklist hebdomadaire

```
□ Audit des comptes
  ├── Nouveaux comptes créés (vérifier légitimité)
  ├── Comptes désactivés
  ├── Mots de passe faibles ou expirés
  └── Comptes inactifs (> 30 jours)

□ Revue des permissions
  ├── Ajustements demandés par les responsables
  ├── Drôle de permissions (accès incohérents avec le poste)
  └── Séparation des tâches respectée

□ Rapport à la Direction Générale
  ├── Incidents de sécurité (si applicable)
  ├── Anomalies détectées
  └── Besoins d'évolution des accès
```

### 4.3 Checklist mensuelle

```
□ Rapport d'activité complet
  ├── Nombre de comptes actifs / désactivés
  ├── Taux de disponibilité plateforme
  ├── Incidents résolus en attente
  └── Recommandations d'amélioration

□ Vérification de la configuration
  ├── Cohérence des seuils d'alerte
  ├── Mise à jour des unités/catégories
  └── Paramètres CNAPS/OSTIE à jour

□ Préparation réunions
  ├── Revue des besoins d'accès avec DG
  └── Planification des formations utilisateurs
```

---

## 5. KPIs de l'Administrateur d'Entreprise

### 5.1 Indicateurs de pilotage

| KPI | Fréquence | Cible | Action si hors cible |
|---|---|---|---|
| Comptes actifs | Mensuel | - | Audit si incohérence |
| Comptes inactifs (>30j) | Mensuel | < 10% | Désactivation |
| Incidents sécurité | Quotidien | 0 critique | Investigation immédiate |
| Taux disponibilité plateforme | Mensuel | > 99% | Alerte technique |
| Demandes accès en attente | Hebdo | < 24h de délai | Traiter en priorité |
| Anomalies détectées dans logs | Hebdo | Décroissance | Analyse des causes |

### 5.2 Tableau de bord de supervision

```
┌─────────────────────────────────────────────────────────────────┐
│           TABLEAU DE BORD ADMINISTRATEUR D'ENTREPRISE           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ COMPTES ACTIFS  │  │ ALERTES CRITIQUES│  │ DISPONIBILITÉ  │ │
│  │      XX         │  │       X         │  │     XX.X%       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ DERNIÈRES ACTIVITÉS (Journal d'audit)                       ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ [HH:MM] – Création compte – Jean R. (Chef Chantier)         ││
│  │ [HH:MM] – Modification permissions – Finance                ││
│  │ [HH:MM] – Tentative connexion échouée – IP suspecte         ││
│  │ [HH:MM] – Désactivation compte – Patrick T. (départ)        ││
│  │ [...]                                                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │ SYNCHRONISATION      │  │ DEMANDES EN ATTENTE              │ │
│  │ ───────────────────  │  │ ─────────────────────────────── │ │
│  │ Appareils sync : XX  │  │ • Accès chantier – Marie C.     │ │
│  │ En attente : X       │  │ • Droits validation – Paul R.   │ │
│  │ Erreurs : X          │  │ • Nouveau compte – à créer      │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Interactions avec les Autres Rôles

### 6.1 Avec la Direction Générale (DG/DAF)

| Situation | Action de l'Admin | Livrable |
|---|---|---|
| Configuration initiale | Définir les seuils de validation DG | Seuils documentés |
| Demande de nouvel accès | Créer le compte, configurer les droits | Accès opérationnel |
| Anomalie de sécurité | Alerter la DG + documenter | Rapport incident |
| Changement stratégique | Adapter les permissions si besoin | Mise à jour matrice |
| Revue mensuelle | Présenter les KPIs sécurité | Rapport mensuel |

### 6.2 Avec les Chefs de Chantier

| Situation | Action de l'Admin |
|---|---|
| Nouveau chantier créé | Vérifier les droits d'accès du chef |
| Accès terrain nécessaire | S'assurer mode offline configuré |
| Changement d'affection | Mettre à jour les permissions chantier |
| Problème technique | Premier niveau de support |

### 6.3 Avec le Comptable / Responsable Financier

| Situation | Action de l'Admin |
|---|---|
| Configuration modes paiement | Acter Mobile Money, virement, espèces |
| Seuils de validation | Configurer le seuil DG |
| Accès aux données financières | Restreindre lecture seule si nécessaire |
| Export comptable | Vérifier les droits d'export |

### 6.4 Avec les RH

| Situation | Action de l'Admin |
|---|---|
| Déclaration CNAPS/OSTIE | S'assurer accès module RH |
| Pointage mobile | Configurer mode offline |
| Gestion journaliers vs déclarés | Configurer les 2 workflows |
| Départ employé | Désactiver le compte sous 24h |

---

## 7. Procédures d'Urgence

### 7.1 Incident de sécurité détecté

```
INCIDENT SÉCURITÉ
       │
       ▼
┌──────────────────────────────────────┐
│ 1. Identifier la nature              │
│    ├── Accès suspect (IP inconnue)   │
│    ├── Compte compromis              │
│    ├── Fuite de données              │
│    └── Tentative d'élévation droits  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 2. Action immédiate                  │
│    ├── Désactiver le compte suspect  │
│    ├── Forcer déconnexion            │
│    └── Bloquer l'IP si nécessaire    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 3. Investigation                     │
│    ├── Consulter les logs détaillés  │
│    ├── Identifier l'étendue          │
│    └── Évaluer l'impact              │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 4. Notification                      │
│    ├── Alerter la DG immédiatement   │
│    ├── Documenter l'incident         │
│    └── Planifier les correctifs      │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 5. Post-incident                     │
│    ├── Renforcer les contrôles       │
│    ├── Former les utilisateurs       │
│    └── Mettre à jour les procédures  │
└──────────────────────────────────────┘
```

### 7.2 Perte d'identifiants

```
DEMANDE DE RÉINITIALISATION
       │
       ▼
┌──────────────────────────────────────┐
│ 1. Vérifier l'identité du demandeur   │
│    ├── Appel téléphonique confirmé    │
│    └── Email professionnel vérifié   │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 2. Réinitialiser le mot de passe     │
│    ├── Générer un mot temporaire     │
│    └── Envoyer par canal sécurisé    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 3. Forcer le changement              │
│    ├── À la prochaine connexion      │
│    └── Journaliser l'opération       │
└──────────────────────────────────────┘
```

### 7.3 Panne plateforme / Indisponibilité

```
PANNE DÉTECTÉE
       │
       ▼
┌──────────────────────────────────────┐
│ 1. Diagnostic rapide                 │
│    ├── Problème applicatif ?         │
│    ├── Problème réseau/infra ?       │
│    └── Problème base de données ?    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 2. Communication                     │
│    ├── Alerter la DG                 │
│    ├── Informer les utilisateurs     │
│    └── Estimer le temps de résolution│
└──────────────┬───────────────────────┘
               │
               ▼
�┌─────────────────────────────────────┐
│ 3. Escalade si nécessaire            │
│    ├── Prestataire IT (sous-rôle 7.1)│
│    └── Support TIA INFO BUILD        │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 4. Post-résolution                   │
│    ├── Documenter la panne           │
│    ├── Identifier la cause racine    │
│    └── Mesures préventives           │
└──────────────────────────────────────┘
```

---

## 8. Spécificités Madagascar — Configuration Obligatoire

### 8.1 Paramètres Mobile Money (OBLIGATOIRE)

```
À configurer ABSOLUMENT dans le module Finance :
├── MVola (Telma)
│   ├── Numéro marchand
│   ├── Type de compte (Marchand / Particulier)
│   └── Frais de transaction : [X] %
│
├── Orange Money
│   ├── Numéro marchand
│   └── Frais de transaction : [X] %
│
└── Airtel Money
    ├── Numéro marchand
    └── Frais de transaction : [X] %
```

> **Règle :** Les journaliers et sous-traitants sur chantier sont majoritairement payés en Mobile Money. Ce mode de paiement doit être aussi simple à utiliser que les espèces.

### 8.2 Configuration RH — Main d'œuvre informelle

```
À configurer dans le module RH :
├── Distinction OBLIGATOIRE :
│   ├── Employés déclarés → workflow complet (CNAPS/OSTIE)
│   └── Journaliers/Tâcherons → workflow simplifié
│
├── Workflow journalier :
│   ├── Saisie presence (jour/heures)
│   ├── Taux journalier (en Ariary, pas de centimes)
│   ├── Paiement : Mobile Money / Espèces
│   └── Pas de déclaration CNAPS
│
└── Alerte :
    └── Si un journalier dépasse 90 jours → suggérer régularisation
```

### 8.3 Configuration Offline-First

```
À configurer dans Paramètres Techniques :
├── Mode offline-first : ACTIVÉ
├── Synchronisation :
│   ├── Auto dès que réseau disponible
│   ├── Résolution des conflits : "dernier écrit gagne" ou manuel
│   └── Taille max données offline : [X] Mo
├── Modules critiques offline :
│   ├── Pointage terrain
│   ├── Saisie avancement chantier
│   └── Consultation stocks
└── Alerte :
    └── Si appareil non sync depuis > 48h → notification admin
```

### 8.4 Paramètres climatiques et logistiques

```
À configurer dans Paramètres Chantiers :
├── Saison des pluies : Novembre → Mars
├── Saison cyclonique : Décembre → Mars
├── Zones à risque :
│   ├── Côte Est (Toamasina) : cyclones forts
│   ├── Hauts plateaux (Antananarivo) : coupures route RN2
│   └── Sud (Toliara) : sécheresse
├── Aléas planifiables :
│   └── Retard "force majeure climatique" documenté
└── Délai d'approvisionnement :
    ├── Matériaux locaux : [X] jours
    └── Matériaux importés (via Toamasina) : [X] jours + douane
```

---

## 9. Documentation et Traçabilité

### 9.1 Registre des actions d'administration

Chaque action de l'administrateur doit être tracée :

| Champ | Description |
|---|---|
| Date/Heure | Horodatage automatique |
| Administrateur | Qui a fait l'action |
| Action | Création / Modification / Désactivation / Export |
| Cible | Utilisateur ou paramètre concerné |
| Détail | Avant / Après (si modification) |
| Raison | Justification de l'action |

### 9.2 Documents à produire

| Document | Fréquence | Destinataire |
|---|---|---|
| Rapport d'activité Admin | Mensuel | Direction Générale |
| Rapport incidents sécurité | Si incident | Direction Générale |
| Matrice des permissions (à jour) | Mensuel | Audit interne |
| Registre des accès | Continu | Consultable par DG à tout moment |

---

## 10. Plan de Progression

### Semaine 1 : Mise en place
- [ ] Création compte admin
- [ ] Configuration entreprise (infos, devise, NIF)
- [ ] Configuration Mobile Money
- [ ] Seuils d'alerte globaux

### Semaine 2 : Paramétrage métier
- [ ] Configuration modules (Chantiers, Finance, RH, Stocks, Matériel, Commercial)
- [ ] Paramètres climatiques et logistiques
- [ ] Modes de paiement complets
- [ ] Distinction déclarés / journaliers

### Semaine 3 : Onboarding utilisateurs
- [ ] Création comptes Direction Générale
- [ ] Création comptes Chefs de Chantier
- [ ] Création comptes Comptable, RH, Commercial
- [ ] Formation des utilisateurs clés

### Semaine 4 : Supervision active
- [ ] Premier rapport mensuel
- [ ] Ajustement des permissions
- [ ] Optimisation des seuils
- [ ] Procédures d'urgence testées

---

## Annexes

### Annexe A — Modèle de demande d'accès

```
DEMANDE D'ACCÈS / MODIFICATION DE DROITS
─────────────────────────────────────────
Date : [JJ/MM/AAAA]
Demandeur : [Nom, Fonction]
Module(s) demandé(s) : [Liste]
Type d'accès : [Lecture / Écriture / Validation]
Justification : [Motif métier]

Validation responsable : [Signature]
Validation Admin : [Signature]
Date mise en œuvre : [JJ/MM/AAAA]
```

### Annexe B — Contacts utiles

| Organisme | Usage | Contact |
|---|---|---|
| DGI | Fiscalité, conformité facturation | Vérifier site officiel |
| CNAPS | Déclarations sociales salariés | Agence locale |
| OSTIE | Santé entreprise | Agence locale |
| EDBM | Formalités entreprise (NIF, STAT) | Guichet unique |
| Support TIA INFO BUILD | Technique plateforme | [À compléter] |

---

**Document créé pour :** TIA INFO BUILD — Rôle Administrateur d'Entreprise
**Contexte :** Entreprise BTP à Madagascar
**Version :** 1.0
**Prochaine révision :** Après 3 mois d'opération
