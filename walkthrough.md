# Rapport d'Analyse Complète — Logique & Actions Métier par Rôle (11 Rôles)

Ce document fournit une **analyse exhaustive de la logique applicative, des workflows et des actions exécutables par chaque rôle** au sein de l'application SaaS **TIA INFO BUILD** (Gestion BTP).

---

## 🏗️ Table des Matières
1. [Organigramme & Matrice des Permissions (RBAC)](#1-organigramme--matrice-des-permissions-rbac)
2. [Analyse Détaillée par Rôle (1 à 11)](#2-analyse-détaillée-par-rôle)
3. [Politique & Workflows de Pointage QR Code (Catégories A à E)](#3-politique--workflows-de-pointage-qr-code)
4. [Sécurité, Intégrité et Confidentialité des Données](#4-sécurité-intégrité-et-confidentialité-des-données)

---

## 1. Organigramme & Matrice des Permissions (RBAC)

```
                              ┌───────────────────────────┐
                              │     SUPER ADMIN SAAS      │ (Niveau SaaS / Multi-Tenants)
                              └─────────────┬─────────────┘
                                            │
        ┌───────────────────────────────────┴───────────────────────────────────┐
        │                                                                       │
┌───────▼────────────────┐                                     ┌────────────────▼───────────────┐
│ ADMINISTRATEUR         │                                     │ DIRECTION GÉNÉRALE (DG / DAF)  │
│ D'ENTREPRISE           │                                     │ (Stratégique / Validations)    │
│ (Technique / Config)   │                                     └───────────────┬────────────────┘
└────────────────────────┘                                                     │
         ┌───────────────────┬───────────────────┬───────────────────┬─────────┴─────────┐
         │                   │                   │                   │                   │
┌────────▼─────────┐ ┌───────▼──────────┐ ┌──────▼──────────┐ ┌──────▼──────────┐ ┌──────▼──────────┐
│ Comptable / Resp.│ │ Chef de Projet / │ │ Responsable RH  │ │ Responsable     │ │ Responsable     │
│ Financier        │ │ Dir. Technique   │ │ (Personnel / HS)│ │ Matériel        │ │ Commercial      │
└──────────────────┘ └───────┬──────────┘ └─────────────────┘ └──────┬──────────┘ └─────────────────┘
                             │                                       │
                     ┌───────▼──────────┐                    ┌───────▼──────────┐
                     │ Chef de Chantier │                    │ Magasinier /     │
                     │ (Terrain / QR)   │                    │ Responsable Stock│
                     └───────┬──────────┘                    └──────────────────┘
                             │
                     ┌───────▼──────────┐
                     │ Ouvrier / Employé│
                     │ de Terrain (QR)  │
                     └──────────────────┘
```

---

## 2. Analyse Détaillée par Rôle

### 1. Super Admin SaaS (`super_admin`)
- **Portée** : Global SaaS (Tous les tenants / entreprises clientes).
- **Missions** : Exploitation de la plateforme SaaS, gestion des abonnements, facturation des PME BTP (Mobile Money MVola/Orange/Airtel), supervision de la disponibilité.
- **Routes Accessibles** : `/super-admin`, `/super-admin/entreprises`, `/super-admin/utilisateurs`, `/super-admin/abonnements`, `/super-admin/facturation`, `/super-admin/logs`, `/super-admin/parametres`.
- **Actions Clés** :
  - Onboarding de nouvelles entreprises abonnées (création de tenant).
  - Activation, renouvellement ou suspension d'abonnements pour impayés.
  - Consultation des logs d'erreurs et des métriques d'uptime serveur.
  - Configuration des moyens de paiement Mobile Money.
- **KPIs Suivis** : Tenants actifs, MRR/ARR, Taux de croissance, Uptime %, Incidents système.
- **Interdictions** : Ne peut pas consulter le détail confidentiel des devis, factures ou employés d'une entreprise cliente.

---

### 2. Admin Entreprise (`admin_entreprise`)
- **Portée** : Tenant Entreprise entier (Technique & Organisationnel).
- **Missions** : Administration technique du compte entreprise, gestion des comptes utilisateurs, attribution des rôles RBAC, configuration des règles métier.
- **Routes Accessibles** : `/dashboard`, `/chantiers`, `/finance`, `/rh`, `/materiels`, `/stocks`, `/commercial`, `/alertes`, `/historique-logins`, `/settings`.
- **Actions Clés** :
  - Créer, modifier et désactiver les comptes d'employés de l'entreprise.
  - Définir les permissions RBAC par rôle.
  - Configurer la devise (MGA), le logo, la TVA par défaut, la numérotation des devis/factures.
  - Consulter l'historique des connexions (`/historique-logins`) pour la traçabilité.
- **KPIs Suivis** : Nombre de comptes actifs/désactivés, Anomalies d'accès 24h, Disponibilité système, Conformité du paramétrage.
- **Interdictions** : Ne saisit pas les opérations quotidiennes de chantier ou de comptabilité.

---

### 3. Direction Générale / DAF (`directeur`)
- **Portée** : Stratégique (Vue d'ensemble de l'entreprise).
- **Missions** : Pilotage stratégique, rentabilité globale des chantiers, arbitrages budgétaires et validation des décisions financières majeures.
- **Routes Accessibles** : `/dashboard`, `/chantiers`, `/finance`, `/commercial`, `/rh`, `/materiels`, `/stocks`, `/alertes`.
- **Actions Clés** :
  - Approuver ou rejeter les devis et budgets prévisionnels de chantiers > au seuil configuré.
  - Analyser la marge brute et la marge nette consolidée.
  - Décider du lancement, de la suspension ou de l'arrêt d'un chantier.
- **KPIs Suivis** : CA consolidé, Marge nette consolidée (MGA et %), Ratio Avancement physique vs financier, Alertes critiques, Devis/budgets en attente de validation.
- **Interdictions** : Aucun accès à la configuration technique du système (gérée par l'Admin).

---

### 4. Comptable / Responsable Financier (`comptable`)
- **Portée** : Direction Financière.
- **Missions** : Suivi comptable et budgétaire des chantiers, calcul des marges réelles (prévu vs réel), suivi de la trésorerie et de la facturation client.
- **Routes Accessibles** : `/dashboard`, `/finance`, `/commercial`, `/chantiers`, `/rh`, `/alertes`.
- **Actions Clés** :
  - Saisir et catégoriser les dépenses par chantier (matériaux, main-d'œuvre, engins, sous-traitance).
  - Investiguer les alertes de dépassement budgétaire.
  - Rapprocher les factures émises et les encaissements clients.
  - Clôturer les bilans financiers périodiques par chantier.
- **KPIs Suivis** : Marge brute/nette par chantier, Écart budget (prévu vs réel), Délai moyen de paiement client (DSO), Encours et factures en retard.
- **Interdictions** : Pas d'accès direct aux modifications d'inventaire stock ou aux détails RH confidentiels.

---

### 5. Chef de Projet / Directeur Technique (`chef_projet`)
- **Portée** : Supervision Multi-Chantiers.
- **Missions** : Coordination des Chefs de Chantier, arbitrage des ressources humaines et matérielles entre chantiers, contrôle des plannings globaux.
- **Routes Accessibles** : `/dashboard`, `/chantiers`, `/rh`, `/materiels`, `/stocks`, `/finance`, `/alertes`.
- **Actions Clés** :
  - Créer et paramétrer les chantiers (phases, jalons, budget prévisionnel initial).
  - Arbitrer les conflits d'affectation d'engins ou d'équipes entre projets.
  - Valider les pointages hors-périmètre (GPS) soumis par les Chefs de Chantier.
- **KPIs Suivis** : Avancement physique vs financier multi-chantiers, Chantiers en retard, Taux d'utilisation des ressources, Conflits d'affectation résolus.

---

### 6. Chef de Chantier / Conducteur de Travaux (`chef_chantier`)
- **Portée** : Terrain (Chantier unique ou périmètre restreint).
- **Missions** : Encadrement terrain des équipes, avancement physique des travaux, déclaration des incidents, pointage des ouvriers par scan QR.
- **Routes Accessibles** : `/dashboard`, `/chantiers`, `/rh`, `/materiels`, `/stocks`, `/finance`, `/alertes`.
- **Actions Clés** :
  - **Lancer le Terminal Scanner Badges Ouvriers** (`QRScannerModal`) pour scanner les badges des ouvriers à l'entrée et à la sortie.
  - Effectuer son propre pointage par géolocalisation GPS (Catégorie B).
  - Saisir l'avancement physique (%) par phase.
  - Signaler les incidents de chantier avec photos de preuve.
  - Déclarer les consommations de matériaux et les besoins en matériel.
- **KPIs Suivis** : Avancement physique % vs Cible, Retard/Avance en jours, Taux de présence de son équipe, Consommation de stock réelle vs prévue.

---

### 7. Responsable RH (`rh`)
- **Portée** : Gestion du Personnel.
- **Missions** : Gestion des employés, habilitations BTP, affectations aux chantiers, supervision des pointages et des heures supplémentaires pour la paie.
- **Routes Accessibles** : `/dashboard`, `/rh`, `/chantiers`, `/alertes`.
- **Actions Clés** :
  - Créer et maintenir les fiches employés et qualifications réglementaires (sécurité, conduite d'engins).
  - **Générer et imprimer les Badges QR Code Officiels** (`WorkerBadgeCard`).
  - Valider les pointages (scans QR, GPS, bureau) et les heures supplémentaires déclarées.
  - Traiter les cas de pointage manuel exceptionnel ou régularisation.
- **KPIs Suivis** : Taux de présence global %, Volume d'heures supplémentaires, Taux d'affectation du personnel, Habilitations expirantes.

---

### 8. Responsable Matériel / Logisticien (`materiel`)
- **Portée** : Parc Engins & Équipements.
- **Missions** : Gestion du parc d'engins et outillages, affectations aux chantiers, planification des maintenances préventives et curatives.
- **Routes Accessibles** : `/dashboard`, `/materiels`, `/chantiers`, `/alertes`.
- **Actions Clés** :
  - Maintenir l'inventaire des équipements (état, localisation, affectation).
  - Valider et planifier le transfert des engins vers les chantiers.
  - Enregistrer les fiches d'intervention et maintenances.
  - Traiter les pannes signalées par le terrain.
- **KPIs Suivis** : Taux d'utilisation du parc matériel %, Engins disponibles vs affectés vs en panne, Échéances de maintenance à venir.

---

### 9. Magasinier / Responsable Stocks (`magasinier`)
- **Portée** : Entrepôt & Logistique Dépôt.
- **Missions** : Gestion des entrées/sorties de matériaux, relation fournisseurs, prévention des ruptures de stock sur chantier, QR code dépôt.
- **Routes Accessibles** : `/dashboard`, `/stocks`, `/chantiers`, `/alertes`.
- **Actions Clés** :
  - Enregistrer les réceptions de livraison fournisseur.
  - Valider les sorties de matériaux vers les chantiers.
  - Configurer les seuils d'alerte de stock minimum par article.
  - Générer le QR Code de pointage fixe du dépôt (Catégorie D).
- **KPIs Suivis** : Niveau de stock vs seuil d'alerte, Consommation réelle vs prévue par chantier, Nombre de ruptures sur survenues, Délai réapprovisionnement.

---

### 10. Responsable Commercial (`commercial`)
- **Portée** : Cycle Client & CRM BTP.
- **Missions** : Prospection, devis, contractualisation, facturation par jalon d'avancement, relance des paiements clients.
- **Routes Accessibles** : `/dashboard`, `/commercial`, `/chantiers`, `/finance`, `/alertes`.
- **Actions Clés** :
  - Créer et soumettre les devis prospects.
  - Convertir les devis acceptés en contrats chantiers.
  - Émettre les factures d'acompte et d'avancement.
  - Suivre les paiements clients et effectuer les relances.
- **KPIs Suivis** : Taux de conversion devis → contrat %, Montant du pipeline commercial (MGA), Total factures impayées, Délai moyen d'encaissement.

---

### 11. Ouvrier / Employé Terrain (`employe`)
- **Portée** : Exécution Terrain.
- **Missions** : Réalisation des tâches de chantier assignées, pointage quotidien via badge QR, déclaration d'incidents de sécurité.
- **Routes Accessibles** : `/dashboard`, `/chantiers`, `/rh`, `/materiels`, `/stocks`, `/alertes`.
- **Actions Clés** :
  - **Afficher son Badge QR Code Officiel** (`WorkerBadgeCard`) sur mobile pour le scan par le Chef de Chantier.
  - Consulter ses tâches attribuées du jour.
  - Mettre à jour l'état d'avancement d'une tâche (À faire / En cours / Terminée / Bloquée).
  - Signaler un incident ou problème technique sur le chantier.
- **KPIs Suivis** : Taux de présence individuel %, Tâches réalisées vs assignées, Heures supplémentaires validées.

---

## 3. Politique & Workflows de Pointage QR Code

Conformément au document `11_politique_pointage.md`, le pointage s'adapte à la catégorie physique de chaque rôle :

| Catégorie | Rôles Concernés | Mécanisme de Pointage | Action Logicielle |
|---|---|---|---|
| **Catégorie A** | Ouvriers, Chefs d'Équipe, Conducteurs d'Engin, Apprentis | **Scan QR Code du Badge Ouvrier par le Chef de Chantier** (ou scan du QR site affiché) | Inscription horodatée Entrée/Sortie avec `methode_pointage: scan_badge_par_chef` |
| **Catégorie B** | Chef de Chantier | **Auto-déclaration GPS obligatoire** | Capture automatique des coordonnées GPS. Vérification du périmètre (rayon 200m). Si hors-zone -> En attente de validation du Chef de Projet |
| **Catégorie C** | Techniciens Maintenance, Livreurs Logistique (Itinérants) | **Pointage à la mission** par scan QR du responsable du lieu | Scan du QR Code du Chef de Chantier ou du Dépôt selon le site d'intervention du jour |
| **Catégorie D** | Magasiniers (A poste fixe dépôt) | **Scan QR Code fixe du Dépôt** | Scan du QR code quotidien généré par le Responsable Stock à l'entrée du dépôt |
| **Catégorie E** | Personnel de bureau (Admin, DG, Comptable, RH, Commercial) | **QR Code fixe Bureau** ou pointage déclaratif à la connexion | Configurable dans les Paramètres de l'entreprise par l'Admin Entreprise |

---

## 4. Sécurité, Intégrité et Confidentialité des Données

1. **Isolation Multi-Tenants** : Toutes les requêtes SQL/ORM appliquent le filtre `entreprise_id == current_user.entreprise_id` pour étanchéifier totalement les données entre entreprises abonnées.
2. **Cloisonnement RBAC** : La fonction `_require_permission()` valide les jetons JWT au niveau du backend FastAPI avant toute exécution d'action CRUD.
3. **Traçabilité des Audit Logs** : Toute modification de compte, de rôle ou de permission est enregistrée dans l'historique des connexions et des audits de sécurité.
