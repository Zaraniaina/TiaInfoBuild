# Rapport Rôle — Commercial / Responsable Commercial

## Vue d'ensemble
Le Commercial prospecte, négocie et fidélise les clients. Il établit les devis, suit les contrats, participe aux réunions de lancement et Reporting commercial (pipe, taux de conversion, CA par source). Sa mission est de générer du chiffre d'affaires et d'optimiser le cycle de vente.

---

## Interface UI/UX actuelle

### Espace dédié
- **Pipeline Commercial** (`pipeline`) : vue Kanban des devis/contrats
- **Clients** (`clients`) : gestion des clients et prospects
- **Devis** (`devis`) : création et suivi des devis
- **Contrats** (`contrats`) : gestion des contrats
- **Factures** (`factures`) : facturation et suivi
- **Paiements** (`paiements`) : encaissements
- **Catalogue Devis** (`catalogue-devis`) : modèles de devis BTP
- **Alertes** (`alertes`, `alertes-intelligentes`) : retards, relances
- **Notifications** (`notifications`) : alertes temps réel
- **Paramètres** (`parametres`) : préférences

### Fonctionnalités présentes
- **Pipeline Commercial Kanban** : visualisation Prospection → Devis → Négociation → Accepté/Refusé/Expiré
- **Création de facture depuis devis accepté** : bouton direct avec pré-remplissage automatique
- **Catalogue de modèles de devis** : bibliothèque par type de travaux
- **Calcul de marge par poste** : champs `tauxMarge` ajoutés, calcul à afficher dans le devis
- **Vue client enrichie** : historique partiel (devis, contrats, factures, paiements)
- **Génération de devis** : avec lignes, remises, acomptes, TVA
- **Transformation devis → contrat** : workflow automatisé
- **Relances clients automatiques** : J+15, J+30, J+60 avec suivi `dernierRappel`
- **Alertes intelligentes** : retards de paiement, dépassements

### Points forts actuels
- Pipeline visuel Kanban
- Flux devis → contrat → facture fluide
- Relances automatiques
- Catalogue de modèles

---

## Analyse métier — Ce qui lui manque vraiment

### Journée type d'un Commercial BTP
- 8h00 : consulter le pipeline et les relances à faire
- 8h30 : appels de relance des devis en attente
- 9h30 : rédaction de nouveaux devis
- 10h30 : visite client / prospection
- 12h00 : déjeuner
- 13h30 : réunion avec les Chefs de Projet sur les projets en cours
- 14h30 : négociation commerciale
- 15h30 : suivi des contrats et avenants
- 16h30 : reporting commercial au DG
- 17h00 : préparation des rendez-vous du lendemain

### Problèmes réels non couverts
- **Marge par poste pas affichée dans le devis** : champs `tauxMarge` existent mais pas dans l'UI
- **Vue client pas assez enrichie** : historique incomplet (pas de contacts, interventions, contrats d'entretien)
- **Filtres factures limités** : pas de filtres par client, chantier, période, échéance
- **Pas de gestion des appels d'offres** : dépôt, analyse, comparaison, réponse
- **Pas de reporting commercial** : CA par source, taux conversion, prévisions
- **Pas de comparaison devis/contrat/facture** : vue côte à côte manquante
- **Pas de module fidélisation** : historique interventions, satisfaction, contrats d'entretien manquant

---

## Recommandations métier — Fonctionnalités à ajouter

### À court terme — Critiques pour son quotidien
- **Calcul de marge par poste affiché dans le devis** : affichage marge brute/nette par ligne de devis
- **Vue client enrichie** : historique complet devis, contrats, factures, paiements, contacts
- **Amélioration du filtrage des factures** : par client, chantier, période, échéance, statut

### À moyen terme — Pour gagner du temps
- **Gestion des appels d'offres** : dépôt, analyse, comparaison, réponse
- **Générateur de propositions commerciales** : templates de devis avec mise en page professionnelle
- **Module reporting commercial** : CA par source, taux conversion, prévisions
- **Comparaison devis/contrat/facture côte à côte** : vue de comparaison rapide
- **Avenants et clauses techniques dans les contrats** : suivi intégré

### À long terme — Vision stratégique
- **Module fidélisation client** : historique interventions, satisfaction, contrats d'entretien
- **Module appels d'offres** : gestion complète du cycle d'appel d'offres
- **Générateur de documents commerciaux** : contrats, avenants, lettres de résiliation
- **Intégration CRM** : suivi pipeline avancé, scoring clients, automation marketing
- **Portail client** : espace client pour consultation devis, factures, paiements

---

## Conclusion
Le Commercial est le moteur du chiffre d'affaires. Ses fonctionnalités actuelles sont solides sur le pipeline et la génération de devis, mais il manque des outils de reporting, de fidélisation et d'analyse commerciale pour optimiser son taux de conversion et maximiser la marge par chantier.
