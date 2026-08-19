# Rapport Rôle — Chef de Chantier / Conducteur de Travaux

## Vue d'ensemble
Le Chef de Chantier est le responsable opérationnel du chantier au quotidien. Il planifie les travaux, gère l'équipe sur site, signale les incidents, suit les approvisionnements et vérifie la conformité des travaux. Son interface doit être mobile-first et rapide.

---

## Interface UI/UX actuelle

### Espace dédié
- **Mode Terrain** (`terrain`) : interface mobile-first simplifiée
- **Chantiers** (`chantiers`) : gestion complète du chantier
- **Équipes** (`equipes`) : affectation et suivi
- **Employés** (`employes`) : gestion des ressources humaines du chantier
- **Pointages** (`pointages`) : suivi des présences
- **Heures supplémentaires** (`heures-sup`) : validation des heures sup
- **Matériels** (`materiels`) : consultation et demande
- **Stocks** (`stocks`, `fournisseurs`, `mouvements`) : approvisionnement
- **Dépenses** (`depenses`) : saisie et validation première
- **Alertes** (`alertes`, `alertes-intelligentes`) : suivi des incidents et alertes
- **Sous-traitants** (`sous-traitants`) : gestion des sous-traitants
- **Notifications** (`notifications`) : informations temps réel

### Fonctionnalités présentes
- **Mode Terrain mobile-first** : interface simplifiée tablette/téléphone
- **Actions rapides** : pointer équipe, nouvelle dépense, signaler incident, mouvement stock
- **Statut chantier en temps réel** : avancement, budget, équipe, incidents
- **Gestion des incidents** : déclaration, suivi, résolution
- **Pointage équipe** : enregistrement des présences
- **Saisie des dépenses** : avec validation première avant envoi au comptable
- **Photos de chantier** : documentation visuelle
- **Gestion des sous-traitants** : CRUD, affectation, suivi
- **Demandes de matériel** : lien vers mouvements de stock
- **Alertes intelligentes** : retards, dépassements, habilitations

### Points forts actuels
- Interface Mode Terrain dédiée et responsive
- Actions rapides accessibles en un clic
- Vue synthétique du chantier actif
- Intégration des workflows de validation

---

## Analyse métier — Ce qui lui manque vraiment

### Journée type d'un Chef de Chantier BTP
- 7h00 : briefing équipe, vérification des présences
- 7h30 : pointage des équipes sur le chantier
- 8h00 : vérification de l'avancement des travaux
- 8h30 : signaler un incident (retard livraison, problème qualité)
- 9h00 : vérifier les approvisionnements du jour
- 10h00 : demande de matériel au magasin
- 11h00 : saisie des dépenses de la veille
- 12h00 : déjeuner avec l'équipe
- 13h30 : réunion avec les sous-traitants
- 14h30 : inspection qualité des travaux en cours
- 15h30 : mise à jour de l'avancement des phases
- 16h30 : rapport journalier au Chef de Projet
- 17h00 : signature des PV de réception

### Problèmes réels non couverts
- **Pointage manuel** : pas de badgeuse PIN/NFC, saisie lente
- **Incidents sans photo/GPS** : pas de géolocalisation ni de photo dans les déclarations
- **Demandes de matériel pas intégrées** : pas de workflow Chef de Chantier → Magasinier → Livraison
- **Pas de Gantt visuel** : pas de vue calendaire des phases du chantier
- **Pas de checklist qualité** : pas de points de contrôle pré-définis
- **Rapport journalier manuel** : pas de génération automatique
- **Pas de signature électronique** : PV de réception signés à la main

---

## Recommandations métier — Fonctionnalités à ajouter

### À court terme — Critiques pour son quotidien
- **Pointage par PIN/NFC** : badge rapide, pas de saisie manuelle, gain de temps sur chantier
- **Améliorer le Mode Terrain responsive** : optimisation tactile pour tablettes et téléphones
- **Formulaire d'incident photo avec GPS** : signalement avec photo, géolocalisation, catégorie (sécurité, qualité, délai)
- **Demande d'approvisionnement intégrée** : depuis l'écran chantier → Magasinier reçoit notification → Bon de sortie auto

### À moyen terme — Pour gagner du temps
- **Gantt visuel du chantier** : vue calendaire des phases, dépendances, ressources
- **Checklist chantier pré-définies** : points de contrôle qualité, sécurité, réglementaires
- **Rapport journalier automatisé** : générer depuis pointages + incidents + livraisons du jour
- **Signature électronique des PV de réception** : intégration pour validation rapide
- **Carnet de travaux numérique** : remplacement du carnet papier, légalement reconnu

### À long terme — Vision stratégique
- **Module Qualité/VAE** : points de contrôle, fiches de non-conformité, actions correctives
- **Module Sécurité** : permis de travail, déclarations accident, registre sécurité
- **Géolocalisation des ressources** : suivi GPS des engins et équipes
- **Jalons visuels et photos avant/après** : galerie pour suivi de l'avancement
- **Module de gestion des réserves** : création, suivi, levée de réserves sur les réceptions

---

## Conclusion
Le Chef de Chantier est le chef d'orchestre du chantier. Ses fonctionnalités actuelles sont opérationnelles mais manquent d'outils terrain avancés (pointage rapide, incidents photo, demandes intégrées). L'ajout du Mode Terrain est un bon début, mais il faut aller plus loin avec la digitalisation complète du processus de construction.
