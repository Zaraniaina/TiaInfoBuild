# Rapport Rôle — Administrateur d'Entreprise

## Vue d'ensemble
L'Administrateur d'Entreprise est le super-utilisateur de la plateforme TIA INFO BUILD. Il configure l'application, gère les comptes utilisateurs, supervise l'activité et assure la maintenance technique du système. C'est le gardien de la cohérence et de la sécurité des données de l'entreprise.

---

## Interface UI/UX actuelle

### Espace dédié
- **Dashboard** : vue synthétique système
- **Administration** : section dédiée dans la sidebar
  - Paramètres (`parametres`)
  - Utilisateurs (`utilisateurs`)
  - Historique connexions (`historique-logins`)
  - Audit log (`audit-log`)

### Fonctionnalités présentes
- **Gestion des utilisateurs** : CRUD complet, téléchargement PDF des identifiants de connexion
- **Gestion des rôles** : consultation des 9 rôles métier
- **Paramètres entreprise** : modification des informations, SMTP, mentions légales, devises, préfixes
- **Sauvegarde/Restauration** : export SQLite/SQL, import, restore, suppression, configuration automatique
- **Audit et traçabilité** : logs récents, par module, par utilisateur
- **Préférences utilisateur** : consultation et modification limitée
- **Synchronisation** : configuration et lancement manuel

### Points forts actuels
- Isolation du rôle ADMIN sur les seuls modules d'administration
- Génération PDF professionnelle des credentials
- Audit log avec triggers automatiques
- Sidebar filtrée automatiquement

---

## Analyse métier — Ce qui lui manque vraiment

### Journée type d'un Administrateur
- 8h30 : vérifier les connexions de la nuit et les erreurs système
- 9h00 : traiter les demandes de création/modification de comptes (arrivées/départs)
- 10h00 : répondre aux utilisateurs bloqués (rôles, permissions, bugs)
- 11h00 : vérifier l'état des sauvegardes
- 14h00 : configurer les nouveaux paramètres demandés par la direction
- 15h00 : analyser les logs d'audit pour détecter des anomalies
- 16h30 : préparer les exports pour la comptabilité ou les audits
- 17h30 : vérifier l'espace disque et la santé de la base

### Problèmes réels non couverts
- **Gestion des habilitations par chantier** : l'admin doit souvent attribuer des droits spécifiques à un utilisateur pour un chantier donné
- **Support utilisateur** : pas de système de ticketing ou de suivi des demandes
- **Maintenance préventive** : pas d'alerte sur la taille de la base, les performances
- **Intégration avec l'existant** : pas de connecteur avec Active Directory / Google Workspace pour l'import des utilisateurs

---

## Recommandations métier — Fonctionnalités à ajouter

### À court terme — Critiques pour son quotidien
- **Import/Export CSV des utilisateurs** : création en masse des comptes ( arrivées, chantiers, équipes)
- **Gestion des habilitations par module/chantier** : interface pour attribuer des droits spécifiques par projet, pas seulement par rôle global
- **Test SMTP intégré** : bouton de test dans les paramètres pour valider la config sans attendre un envoi réel
- **Gestion des rôles personnalisés** : créer des rôles métier hybrides (ex: "Comptable Chantier A" avec droits limités à un seul projet)
- **Tableau de bord santé système** : vue avec taille DB, utilisateurs connectés, erreurs récentes, performance

### À moyen terme — Pour gagner du temps
- **Module de monitoring** : performances, erreurs, utilisateurs actifs, taux d'erreur
- **Sauvegarde automatique planifiée + export cloud** : protection contre la perte de données, conformité
- **Module d'intégrations** : connecteurs avec logiciels comptables (SAGE, QuickBooks), paie, gestion de projet
- **Gestion des templates d'utilisateurs** : créer un utilisateur type par rôle avec tous les droits pré-configurés

### À long terme — Vision stratégique
- **Portail d'administration web distant** : pour les multi-sites, administration sans accès au poste
- **Module de personnalisation avancée** : thème, logo, mentions légales dynamiques, préfixes par module
- **Générateur de rapports administratifs** : exports automatiques pour les commissaires aux comptes, banques
- **API REST d'administration** : pour automatiser la gestion des utilisateurs via scripts

---

## Conclusion
L'Administrateur est le garant de la stabilité du système. Ses fonctionnalités actuelles couvrent les bases, mais il manque des outils d'automatisation, de monitoring et d'intégration pour réduire sa charge opérationnelle et lui permettre de se concentrer sur la stratégie SI de l'entreprise.
