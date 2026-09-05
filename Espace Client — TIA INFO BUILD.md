# Espace Client — TIA INFO BUILD

## 1. Objectif

L’**Espace Client** permet au client de consulter et suivre toutes les informations qui le concernent dans l’entreprise BTP.

Le client doit pouvoir suivre le cycle de son projet :

```text
Demande
   ↓
Projet
   ↓
Métré / Étude
   ↓
Devis
   ↓
Contrat
   ↓
Chantier
   ↓
Avancement / Situation de travaux
   ↓
Facturation
   ↓
Paiement
```

L’Espace Client présente uniquement les informations destinées au client.

> **Important :** le client ne doit pas avoir accès aux informations internes de l’entreprise comme les salaires, coûts internes, marges, fournisseurs, achats, stocks ou données des autres clients.

---

# 2. Tableau de bord

Le tableau de bord est la page principale après connexion.

### Informations à afficher

```text
Bonjour, [Nom du client]

Mes projets
    → Nombre de projets

Mes demandes
    → Nouvelles
    → En cours
    → Traitées

Mes devis
    → En attente de réponse
    → Acceptés
    → Refusés

Mes contrats
    → Actifs
    → Terminés

Mes chantiers
    → En cours
    → Terminés

Mes factures
    → À payer
    → Partiellement payées
    → Payées

Montant restant à payer
```

### Vue du cycle du projet

Pour chaque projet, afficher une progression :

```text
Demande
  ✓
Projet
  ✓
Devis
  ✓
Contrat
  ✓
Chantier
  ●
Avancement
  ○
Facturation
  ○
Paiement
  ○
```

---

# 3. Mon profil

Le client peut consulter et modifier certaines informations personnelles.

### Informations

```text
Nom / Raison sociale
Prénom
Type de client
Email
Téléphone
Adresse
Ville
Pays
Informations de facturation
```

Selon le type de client :

```text
Particulier
Entreprise
Administration publique
Association
ONG
Promoteur immobilier
```

### Actions

```text
Modifier mes informations
Modifier mon mot de passe
Modifier mes préférences de notification
Se déconnecter
```

Les informations administratives ou fiscales sensibles peuvent être limitées selon les droits du compte.

---

# 4. Mes demandes

Cette section permet au client de consulter ses demandes de travaux.

### Liste

```text
Référence
Titre de la demande
Type de travaux
Date de demande
Projet associé
Statut
```

### Exemple de statut

```text
Nouvelle
En étude
Traitée
Annulée
```

### Détail d'une demande

```text
Référence
Titre
Description du projet
Type de travaux
Localisation
Date souhaitée
Observations
Date de création
Statut
Documents associés
```

---

# 5. Mes projets

Un client peut avoir plusieurs projets.

### Liste des projets

```text
Référence projet
Nom du projet
Localisation
Type de projet
Date de création
Statut
Projet associé à une demande
```

### Exemple

```text
Projet : Construction maison R+1
Localisation : Antananarivo
Statut : En cours
```

### Détail du projet

```text
Informations générales
Description
Localisation
Plans / documents
Métrés disponibles
Devis associés
Contrat associé
Chantier associé
Avancement
Factures
Paiements
```

---

# 6. Mes devis

Cette section permet au client de consulter les devis qui lui sont destinés.

### Liste

```text
N° devis
Projet
Date
Validité
Montant HT
TVA
Montant TTC
Statut
```

### Statuts

```text
Brouillon
Envoyé
Accepté
Refusé
Expiré
```

### Détail du devis

Afficher :

```text
Informations de l'entreprise
Informations du client
Projet
Localisation

Ouvrages / lots
    ↓
Lignes du devis
    ↓
Description
Quantité
Unité
Prix unitaire
Montant

Total HT
TVA
Total TTC
Conditions
Validité
```

### Actions

```text
Voir le devis
Télécharger PDF
Accepter
Refuser
```

Si l'entreprise autorise l'acceptation en ligne :

```text
Client
   ↓
Accepte le devis
   ↓
Date et heure enregistrées
   ↓
Utilisateur ayant effectué l'action
   ↓
Devis = Accepté
```

L'acceptation en ligne ne doit être considérée comme une signature électronique que si le système met réellement en place le mécanisme juridique et technique approprié.

---

# 7. Mes contrats

Le client peut consulter ses contrats liés à ses projets.

### Liste

```text
N° contrat
Projet
Date de signature
Date de début
Date de fin prévue
Montant contractuel
Statut
```

### Statuts

```text
Préparé
Actif
Terminé
Résilié
```

### Détail

```text
Informations du contrat
Projet
Client
Entreprise
Montant
Date de début
Date de fin
Conditions contractuelles
Documents
Avenants
Chantier associé
```

### Actions

```text
Consulter
Télécharger le contrat PDF
Consulter les avenants
```

---

# 8. Mes avenants

Les avenants permettent de consulter les modifications apportées au contrat.

### Liste

```text
N° avenant
Contrat
Objet
Date
Impact financier
Statut
```

### Exemple

```text
Avenant N°01
Objet : Modification des travaux
Montant supplémentaire : ...
Statut : Signé
```

### Détail

```text
Contrat concerné
Objet
Motif
Modifications
Montant initial
Variation
Nouveau montant contractuel
Date
Documents
Statut
```

---

# 9. Mes chantiers

Cette section permet au client de suivre les chantiers liés à ses projets.

### Liste

```text
Chantier
Projet
Localisation
Date de début
Date prévue de fin
Avancement
Statut
```

### Statuts

```text
Non démarré
En cours
Suspendu
Terminé
```

### Détail du chantier

```text
Informations générales
Localisation
Date de démarrage
Date prévue de fin
Responsable / contact de chantier
Avancement global
Ouvrages / lots
Situations de travaux
Photos
Documents
Observations
```

---

# 10. Avancement des travaux

Cette section permet au client de suivre l'avancement réel du chantier.

### Avancement global

```text
Avancement du chantier : 65 %
```

### Avancement par ouvrage / lot

```text
Installation de chantier     100 %
Terrassement                  100 %
Fondations                     90 %
Élévation                       60 %
Toiture                         30 %
Électricité                     10 %
Plomberie                        0 %
```

### Informations supplémentaires

```text
Période
Travaux réalisés
Quantités exécutées
Avancement
Observations
Photos
Documents justificatifs
```

L'entreprise peut également publier les informations validées liées aux **situations de travaux**.

---

# 11. Situations de travaux

Le client peut consulter les situations de travaux qui lui sont destinées.

### Liste

```text
N° situation
Chantier
Période
Date
Avancement
Montant
Statut
```

### Statuts

```text
Brouillon
Soumise
Validée
Rejetée
```

### Détail

```text
Chantier
Période concernée

Ouvrage
Description
Quantité prévue
Quantité réalisée
Pourcentage d'avancement
Montant

Total de la situation
Retenues éventuelles
Acomptes éventuels
Net à facturer
```

### Actions

```text
Consulter
Télécharger PDF
Consulter les pièces jointes
```

---

# 12. Mes factures

Cette section permet au client de consulter ses factures.

### Liste

```text
N° facture
Projet
Chantier
Date
Montant TTC
Montant payé
Reste à payer
Statut
```

### Statuts

```text
Brouillon
Émise
Envoyée
Partiellement payée
Payée
En retard
Annulée
```

### Détail

```text
Informations de l'entreprise
Informations du client

Facture
Projet
Chantier
Situation associée si applicable

Lignes de facturation
Quantité
Unité
Prix unitaire
Montant

Total HT
TVA
Total TTC
Montant payé
Reste à payer

Conditions de paiement
Date d'échéance
```

### Actions

```text
Voir la facture
Télécharger PDF
Consulter les paiements
```

---

# 13. Mes paiements

Le client peut consulter l'historique de ses paiements.

### Liste

```text
Date
Référence
Facture
Mode de paiement
Montant
Statut
```

### Modes possibles

```text
Espèces
Virement bancaire
Chèque
Mobile Money
Autre
```

### Exemple

```text
Facture : FAC-2026-001
Montant : 2 000 000 Ar
Paiement : 1 000 000 Ar
Reste : 1 000 000 Ar
```

### Historique

```text
Total facturé
Total payé
Total restant
```

---

# 14. Mes documents

Centraliser les documents accessibles au client.

### Catégories

```text
Demandes
Plans
Devis
Contrats
Avenants
Situations de travaux
Factures
Reçus / justificatifs de paiement
Rapports
Photos de chantier
Autres documents
```

### Exemple

```text
📄 Devis-DV-2026-001.pdf
📄 Contrat-CT-2026-001.pdf
📄 Avenant-AV-001.pdf
📄 Situation-ST-003.pdf
📄 Facture-FAC-2026-005.pdf
📷 Photo-chantier-001.jpg
```

---

# 15. Notifications

Le client reçoit des notifications concernant ses projets.

### Exemples

```text
Nouveau devis disponible

Votre devis DV-2026-001 est disponible.

---

Devis accepté

Le devis DV-2026-001 a été accepté.

---

Nouveau contrat

Votre contrat CT-2026-001 est disponible.

---

Avancement du chantier

L'avancement de votre chantier a été mis à jour.

---

Nouvelle situation de travaux

Une nouvelle situation de travaux est disponible.

---

Nouvelle facture

La facture FAC-2026-005 est disponible.

---

Paiement enregistré

Votre paiement a été enregistré.
```

### Canaux possibles

```text
Notification dans l'application
Email
```

Les SMS ou autres canaux peuvent être ajoutés ultérieurement.

---

# 16. Paramètres

Le client peut gérer ses préférences.

```text
Modifier le mot de passe
Activer / désactiver les notifications email
Préférences de notification
Langue
Déconnexion
```

---

# 17. Sécurité et droits d'accès

Le principe principal est :

```text
CLIENT A
   ↓
Uniquement ses propres données

CLIENT B
   ↓
Uniquement ses propres données
```

Un client ne doit jamais pouvoir consulter :

```text
❌ Les autres clients
❌ Les salaires des employés
❌ Les coûts internes
❌ Les marges
❌ Les fournisseurs
❌ Les achats
❌ Le stock interne
❌ Les prix d'achat
❌ Les informations financières internes
❌ Les données administratives internes
❌ Les données des autres chantiers qui ne lui appartiennent pas
```

---

# 18. Menu final de l'Espace Client

```text
ESPACE CLIENT
│
├── 🏠 Tableau de bord
│
├── 👤 Mon profil
│
├── 📩 Mes demandes
│
├── 🏗️ Mes projets
│
├── 📐 Mes métrés
│
├── 💰 Mes devis
│
├── 📄 Mes contrats
│
├── 📝 Mes avenants
│
├── 🚧 Mes chantiers
│
├── 📊 Avancement des travaux
│
├── 📋 Situations de travaux
│
├── 🧾 Mes factures
│
├── 💳 Mes paiements
│
├── 📁 Mes documents
│
├── 🔔 Notifications
│
└── ⚙️ Paramètres
```

---

# 19. Relations avec les modules internes

L'Espace Client n'est pas un système séparé.

Il utilise les données des modules de TIA INFO BUILD :

```text
CLIENT
   │
   ├── DEMANDE
   │      │
   │      └── PROJET
   │             │
   │             ├── MÉTRÉ
   │             │
   │             ├── DEVIS
   │             │     │
   │             │     └── CONTRAT
   │             │             │
   │             │             ├── AVENANT
   │             │             │
   │             │             └── CHANTIER
   │             │                    │
   │             │                    ├── AVANCEMENT
   │             │                    │
   │             │                    ├── SITUATION
   │             │                    │
   │             │                    └── FACTURE
   │             │                           │
   │             │                           └── PAIEMENT
   │             │
   │             └── DOCUMENTS
   │
   └── ESPACE CLIENT
```

---

# 20. Principe général

L'Espace Client doit répondre simplement à ces questions :

```text
Qu'est-ce que j'ai demandé ?
        ↓
Qu'est-ce que l'entreprise m'a proposé ?
        ↓
Qu'est-ce que j'ai accepté ?
        ↓
Qu'est-ce qui est en train d'être réalisé ?
        ↓
Qu'est-ce qui a été réalisé ?
        ↓
Qu'est-ce qui m'a été facturé ?
        ↓
Qu'est-ce que j'ai payé ?
        ↓
Qu'est-ce qu'il me reste à payer ?
```

Ainsi, l'Espace Client devient une **vue simplifiée et sécurisée du cycle du projet BTP**, tandis que les modules internes de TIA INFO BUILD restent utilisés par les commerciaux, conducteurs de travaux, responsables, comptables et administrateurs.