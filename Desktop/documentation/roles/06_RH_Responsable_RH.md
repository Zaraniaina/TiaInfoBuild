# Rapport Rôle — Responsable RH

## Vue d'ensemble
Le Responsable RH gère l'ensemble du capital humain de l'entreprise BTP : recrutement, contrats, salaires, congés, pointages, heures supplémentaires, compétences et habilitations. Son rôle est stratégique pour la sécurité et la performance des chantiers.

---

## Interface UI/UX actuelle

### Espace dédié
- **Employés** (`employes`) : gestion du personnel
- **Équipes** (`equipes`) : constitution et affectation
- **Pointages** (`pointages`) : suivi des présences
- **Heures supplémentaires** (`heures-sup`) : déclaration et validation
- **Dashboard** (`dashboard`) : statistiques RH
- **Alertes** (`alertes`, `alertes-intelligentes`) : habilitations, contrats
- **Notifications** (`notifications`) : alertes temps réel
- **Paramètres** (`parametres`) : préférences

### Fonctionnalités présentes
- **Dossier employé enrichi** : fiche complète avec contrat, RIB, diplômes, habilitations, historique
- **Vue "Équipe par chantier"** : affichage des équipes avec compétences et habilitations requises
- **Alertes habilitations** : notification avant expiration CACES, permis, formations
- **Pointage quotidien** : enregistrement des présences par employé et chantier
- **Gestion des heures supplémentaires** : déclaration, validation, calcul des majorations
- **Gestion des équipes** : création, affectation chantier, membres
- **Changement de poste** : historique des postes occupés
- **Dashboard RH** : statistiques effectifs, présences, heures sup
- **Alertes intelligentes** : contrats arrivant à échéance, habilitations expirées

### Points forts actuels
- Dossier employé complet
- Alertes pro-actives sur les habilitations
- Workflow pointage/heures sup structuré
- Historique des postes et carrières

---

## Analyse métier — Ce qui lui manque vraiment

### Journée type d'un RH BTP
- 8h00 : vérifier les pointages de la veille et les anomalies
- 8h30 : traiter les demandes d'heures supplémentaires
- 9h00 : vérifier les alertes habilitations (CACES, permis, formations)
- 10h00 : entretien de recrutement ou d'évaluation
- 11h00 : préparation de la paie du mois
- 14h00 : gestion des contrats (arrivées, départs, renouvellements)
- 15h00 : traitement des demandes de congés
- 16h00 : reporting social au DG
- 17h00 : mise à jour des habilitations et formations

### Problèmes réels non couverts
- **Workflow validation heures sup incomplet** : Chef de Chantier valide → RH valide → intégration paie pas automatisée
- **Pas de module de paie** : pas de calcul automatique des salaires
- **Pas de gestion des congés et absences** : demande, validation, solde manuel
- **Pas de module habilitation complet** : gestion des CACES, permis, formations pas centralisée
- **Pas de module accidentologie** : déclaration, suivi, statistiques manuel
- **Pas de module recrutement** : gestion des candidatures manuelle
- **Pas de module évaluations** : évaluations annuelles manuelles

---

## Recommandations métier — Fonctionnalités à ajouter

### À court terme — Critiques pour son quotidien
- **Workflow validation heures sup** : Chef de Chantier valide → RH valide → intégration paie
- **Interface de paie simplifiée** : préparation à partir des pointages validés, calcul automatique
- **Module habilitation et formation** : gestion complète des CACES, permis, formations avec planificateur

### À moyen terme — Pour gagner du temps
- **Module gestion des congés et absences** : demande, validation, solde, planning
- **Module accidentologie** : déclaration, suivi, statistiques, actions préventives
- **Module recrutement** : gestion des candidatures, entretiens, intégration
- **Module évaluations** : évaluations annuelles, objectifs, formations associées

### À long terme — Vision stratégique
- **Module paie complet** : calcul automatique, exports bancaires, déclarations sociales
- **Tableau de bord RH avancé** : turnover, absentéisme, masse salariale par chantier
- **Gestion des compétences et habilitations** : matrice compétences, plan de formation
- **Reporting social automatisé** : effectifs, turnover, accidentologie, indicateurs légaux
- **Module de gestion des carrières** : plans de succession, mobilité interne, formations

---

## Conclusion
Le RH est le garant des ressources humaines et de la sécurité des chantiers. Ses fonctionnalités actuelles couvrent les bases du pointage et des habilitations, mais il manque des outils de paie, de gestion des congés et de recrutement pour automatiser ses tâches récurrentes et se concentrer sur la stratégie RH de l'entreprise BTP.
