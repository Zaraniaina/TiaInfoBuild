# Rôles Utilisateurs — TIA INFO BUILD (avec Administrateur d'Entreprise)

Ce document décrit l'ensemble des rôles présents **au sein d'une entreprise cliente** sur la plateforme **TIA INFO BUILD**, y compris l'**Administrateur** de cette entreprise (le Super Admin plateforme, qui gère l'ensemble des entreprises du SaaS, n'est pas traité ici).

---

## 1. Administrateur d'Entreprise

**Portée :** Tous les modules de son entreprise

**Rôle :**
C'est le responsable technique et organisationnel de la plateforme au sein de son entreprise. Il ne participe généralement pas aux opérations métier quotidiennes (saisie de chantier, comptabilité, stock...), mais garantit le bon fonctionnement, la configuration et la sécurité de l'espace de son entreprise.

**Actions typiques :**
- Créer, modifier et désactiver les comptes des employés de son entreprise
- Attribuer les rôles (Comptable, Chef de chantier, RH, etc.)
- Configurer les paramètres de l'entreprise (logo, devise, unités, catégories)
- Consulter tous les modules et tableaux de bord de son entreprise
- Superviser les journaux d'activité (logs) de ses utilisateurs
- Gérer les permissions d'accès par module

---

## 2. Comptable / Responsable Financier

**Module principal :** Gestion Administrative et Financière

**Rôle :**
Il assure le suivi quotidien des finances de l'entreprise. Il saisit les dépenses, contrôle les budgets par chantier, et alimente les rapports financiers utilisés par la direction.

**Actions typiques :**
- Enregistrer les dépenses et recettes
- Comparer les coûts prévus vs réels
- Générer des rapports financiers
- Suivre les factures et paiements clients
- Signaler les dépassements budgétaires

---

## 3. Direction Générale (DG) / DAF

**Module principal :** Aide à la Décision, Finances (validation)

**Rôle :**
Responsable de la stratégie globale de l'entreprise. Elle consulte les tableaux de bord, valide les budgets importants et prend les décisions stratégiques basées sur les indicateurs remontés par les autres modules.

**Actions typiques :**
- Consulter le tableau de bord décisionnel
- Valider les budgets et devis importants
- Analyser la rentabilité des chantiers
- Superviser les performances des équipes

---

## 4. Chef de Chantier / Conducteur de Travaux

**Module principal :** Gestion des Chantiers, RH (pointage), Matériel, Stocks

**Rôle :**
Présent sur le terrain, il est le principal utilisateur mobile de l'application. Il fait remonter en temps réel l'avancement des travaux, gère son équipe au quotidien et signale les besoins matériels.

**Actions typiques :**
- Mettre à jour l'avancement des travaux
- Planifier les phases du chantier
- Signaler les incidents
- Pointer la présence des ouvriers
- Demander l'affectation de matériel/matériaux
- Suivre la consommation de stock sur son chantier

---

## 5. Chef de Projet / Directeur Technique

**Module principal :** Gestion des Chantiers

**Rôle :**
Supervise plusieurs chantiers simultanément. Il coordonne les chefs de chantier, contrôle les délais globaux et affecte les ressources entre les différents projets.

**Actions typiques :**
- Créer et suivre les projets
- Contrôler les délais contractuels
- Affecter les ressources humaines et matérielles entre chantiers
- Arbitrer les priorités entre chantiers

---

## 6. Responsable RH

**Module principal :** Gestion des Ressources Humaines

**Rôle :**
Gère administrativement l'ensemble du personnel de l'entreprise. Il traite les données remontées par les chefs de chantier (pointage) pour calculer les heures et gérer les affectations.

**Actions typiques :**
- Gérer les dossiers employés
- Affecter le personnel aux chantiers
- Calculer les heures supplémentaires
- Gérer la composition des équipes

---

## 7. Responsable Matériel / Logisticien

**Module principal :** Gestion des Matériels

**Rôle :**
Responsable du parc d'équipements de l'entreprise (engins, outils, véhicules). Il planifie la maintenance et gère la disponibilité du matériel entre les chantiers.

**Actions typiques :**
- Tenir l'inventaire du matériel
- Planifier et suivre la maintenance
- Gérer l'affectation du matériel aux chantiers
- Consulter l'historique et gérer les alertes

---

## 8. Magasinier / Responsable Stock

**Module principal :** Gestion des Stocks

**Rôle :**
Gère physiquement le stock de matériaux de construction. Il enregistre les mouvements de stock et travaille en lien avec les fournisseurs pour éviter les ruptures.

**Actions typiques :**
- Enregistrer les entrées et sorties de stock
- Gérer les fournisseurs
- Suivre la consommation par chantier
- Gérer les alertes de rupture de stock

---

## 9. Commercial / Responsable Commercial

**Module principal :** Gestion Commerciale

**Rôle :**
Interface entre l'entreprise et les clients. Il élabore les offres commerciales, négocie les contrats et assure le suivi de la relation client.

**Actions typiques :**
- Créer et envoyer des devis
- Rédiger et suivre les contrats
- Gérer la base clients
- Suivre les factures liées aux ventes

---

## Tableau Récapitulatif

| Rôle | Module(s) principal(aux) | Type d'accès |
|---|---|---|
| Administrateur d'entreprise | Tous les modules (configuration/supervision) | Bureau |
| Comptable / DAF | Finances | Bureau |
| Direction Générale | Tableau de bord, Finances | Bureau / Mobile |
| Chef de chantier | Chantiers, RH, Matériel, Stocks | Terrain / Mobile |
| Chef de projet | Chantiers | Bureau / Mobile |
| Responsable RH | RH | Bureau |
| Responsable Matériel | Matériel | Bureau / Terrain |
| Magasinier | Stocks | Bureau / Entrepôt |
| Commercial | Commercial | Bureau |

---

*Document généré pour le projet Django `tia_info_build` — sert de base pour la définition des rôles et permissions (RBAC) au sein d'une entreprise (tenant).*
