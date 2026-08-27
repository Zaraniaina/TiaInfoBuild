# Rapport Rôle — Magasinier / Responsable Stock

## Vue d'ensemble
Le Magasinier gère les flux physiques des matériaux et consommables : réception, stockage, sorties, inventaires. Il assure la disponibilité des stocks pour les chantiers, suit les consommations et gère les fournisseurs et commandes.

---

## Interface UI/UX actuelle

### Espace dédié
- **Stocks** (`stocks`) : vue d'ensemble des articles
- **Articles** : CRUD fiches article
- **Fournisseurs** (`fournisseurs`) : gestion des fournisseurs
- **Mouvements** (`mouvements`) : entrées/sorties de stock
- **Alertes** (`alertes`) : alertes de rupture et réapprovisionnement
- **Dashboard** (`dashboard`) : statistiques logistiques
- **Notifications** (`notifications`) : alertes temps réel
- **Paramètres** (`parametres`) : préférences

### Fonctionnalités présentes
- **Gestion des articles** : CRUD complet (nom, référence, catégorie, prix, seuil alerte, stock)
- **Gestion des fournisseurs** : coordonnées, conditions de paiement, notes
- **Mouvements de stock** : enregistrement des entrées et sorties par chantier
- **Suivi des consommations par chantier** : historique des mouvements
- **Alertes de rupture** : notification quand stock bas ou rupture
- **Statistiques articles** : vue d'ensemble des stocks
- **Recherche et filtres** : par catégorie, référence, nom

### Points forts actuels
- Traçabilité des mouvements par chantier
- Alertes de seuil
- Lien entre stocks et chantiers

---

## Analyse métier — Ce qui lui manque vraiment

### Journée type d'un Magasinier BTP
- 7h30 : réception des livraisons du jour, vérification des bons de commande
- 8h00 : pointage et rangement des articles en stock
- 8h30 : traitement des demandes de sortie des Chefs de Chantier
- 9h00 : scan/référencement des articles
- 10h00 : vérification des stocks bas et lancement des commandes
- 11h00 : inventaire tournant d'une zone
- 12h00 : déjeuner
- 13h30 : préparation des livraisons pour les chantiers
- 14h30 : vérification des retours de matériel
- 15h30 : mise à jour des emplacements
- 16h30 : vérification des alertes de péremption
- 17h00 : clôture du jour, reporting des mouvements

### Problèmes réels non couverts
- **Pas de scan code barre/QR** : saisie manuelle longue et source d'erreurs
- **Pas de gestion des emplacements** : zones, allées, étagères non gérées
- **Pas de gestion des lots et péremptions** : produits chimiques, dates de péremption non suivies
- **Pas de module commandes et achats** : bon de commande, suivi réceptions, écarts manuels
- **Pas de module inventaire** : inventaire tournant, valorisation FIFO/CMUP manuels
- **Pas de transferts entre chantiers** : bons de transfert manuels
- **Pas de calcul de consommation par poste** : analyse manuelle

---

## Recommandations métier — Fonctionnalités à ajouter

### À court terme — Critiques pour son quotidien
- **Scan code barre / QR code** : réception et sortie par scan, zéro erreur
- **Vue "Stock par chantier"** : consommation et disponibilité par chantier
- **Intégration demandes de matériel** : demande Chef de Chantier → Bon de sortie auto
- **Fiche article enrichie** : photo, dimensions, fiche technique fabricant

### À moyen terme — Pour gagner du temps
- **Génération automatique de commandes** : alerte stock bas → proposition de commande fournisseur
- **Module commandes et achats** : bon de commande, suivi réceptions, écarts
- **Module inventaire** : inventaire tournant, valorisation FIFO/CMUP
- **Module gestion des emplacements** : zones, allées, étagères, emplacement physique

### À long terme — Vision stratégique
- **Module gestion des lots et péremption** : lots, dates péremption (produits chimiques)
- **Module transferts entre chantiers** : bon de transfert, suivi transport
- **Intégration lecteur code barre physique** : support douchettes code barre
- **Inventaire tournant sans fermeture** : inventaire partiel par zone
- **Module de gestion des consommations** : analyse par poste de chantier, prévisions

---

## Conclusion
Le Magasinier est le garant de la disponibilité des matériaux sur les chantiers. Ses fonctionnalités actuelles sont basiques mais manquent d'outils de scan, de gestion des emplacements et de commandes automatisées. L'ajout de ces fonctionnalités réduirait les erreurs de saisie et améliorerait la traçabilité des flux physiques.
