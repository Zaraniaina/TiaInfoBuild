# Rapport Rôle — Direction Générale / DAF

## Vue d'ensemble
La Direction Générale et le DAF ont besoin d'une vision stratégique globale de l'entreprise. Ils valident les budgets, arbitrent les priorités entre chantiers, supervisent la trésorerie et les risques, et produisent les reports auprès des associés, banques et assureurs.

---

## Interface UI/UX actuelle

### Espace dédié
- **Dashboard** (`dashboard`) : KPIs globaux
- **Finances** (`finances`) : santé financière
- **Trésorerie** (`tresorerie`) : vue J-30/J-60/J-90
- **Budget prévisionnel** (`budget-previsionnel`) : comparaison prévu/réel
- **Rapports** (`rapports`) : états financiers
- **Alertes intelligentes** (`alertes-intelligentes`) : risques clients, dépassements
- **Chantiers** (`chantiers`) : vue multi-chantiers
- **Projets** (`projets`) : dashboard multi-chantiers
- **Historique connexions** (`historique-logins`) : sécurité
- **Paramètres** (`parametres`) : configuration entreprise

### Fonctionnalités présentes
- **Tableau de bord "Pilotage stratégique"** : agrégation CA global, marge, trésorerie, carnet de commandes
- **Comparatif multi-chantiers** : budget, avancement, rentabilité, retard pour arbitrage
- **Indicateurs de risque** : chantiers en dépassement, clients à risque, impayés > 60j
- **Workflow de validation budgétaire partiel** : budget prévisionnel créé, workflow de validation à ajouter
- **Alertes intelligentes** : factures retard, dépenses dépassement, habilitations
- **Dashboard Chef de Projet multi-chantiers** : vue synthétique de tous les chantiers
- **Export PDF/Excel des rapports** : fonctionnalités de base présentes

### Points forts actuels
- Vue consolidée cross-modules
- Alertes pro-actives
- Workflow budget prévisionnel déjà en place

---

## Analyse métier — Ce qui lui manque vraiment

### Journée type d'un DG/DAF BTP
- 8h00 : consulter les alertes de la nuit (retards, dépassements, incidents graves)
- 8h30 : valider les budgets prévisionnels des nouveaux chantiers
- 9h00 : arbitrer les conflits de ressources entre chantiers
- 10h00 : réunion avec les Chefs de Projet sur l'avancement
- 11h00 : signer les contrats importants et valider les dépenses > seuil
- 14h00 : analyse financière : trésorerie, rentabilité, impayés
- 15h00 : reporting aux associés/banques/assureurs
- 16h00 : stratégie : lancement/arrêt de chantiers, investissements
- 17h00 : vérifier les indicateurs de risque globaux

### Problèmes réels non couverts
- **Pas de score de santé global par chantier** : indicateur unique 0-100 pour décision rapide
- **Pas de validation hiérarchique par montant** : workflow de validation par paliers manquant
- **Pas de vue consolidée RH + Finances** : coût personnel par chantier pas visible
- **Pas de simulateur "What-if"** : impossible de tester l'impact d'un retard ou d'un dépassement
- **Pas de générateur de rapports direction** : PowerPoint/PDF mensuel pas automatisé
- **Pas de vue "Carnet de commandes"** : devis acceptés non transformés en contrats non visibles

---

## Recommandations métier — Fonctionnalités à ajouter

### À court terme — Critiques pour sa décision
- **Score de santé par chantier (algorithme 0-100)** : indicateur unique synthétisant avancement, budget, retards, incidents, risques
- **Validation hiérarchique par montant** : workflow de validation budgétaire par paliers (seuils configurables par l'admin)
- **Vue consolidée RH + Finances** : coût personnel par chantier, masse salariale par projet
- **Vue "Carnet de commandes"** : devis acceptés non transformés en contrats, chiffre d'affaires potentiel

### À moyen terme — Pour piloter plus finement
- **Générateur de rapports de direction** : export PowerPoint/PDF mensuel prêt à présenter
- **Module d'arbitrage des conflits de ressources** : comparaison des priorités, demande d'arbitrage à la DG
- **Simulation "What-if"** : simulateur d'impact financier (report de chantier, augmentation de budget)
- **Tableau de bord risques financiers** : clients à risque, impayés > 60j, dépassements

### À long terme — Vision stratégique
- **Module de reporting réglementaire** : rapports pour assureurs, banques, inspections
- **Module de gestion des cautions et garanties** : suivi des cautions bancaires, garanties de bonne fin
- **Module de budgétisation multicritères** : scénarios optimiste, pessimiste, réaliste
- **Intégrations décisionnelles** : connecteurs BI (Power BI, Tableau), exports vers Excel avancés, API REST pour outils externes
- **Module de gestion des appels d'offres** : analyse de rentabilité, réponse automatisée

---

## Conclusion
Le DG/DAF a besoin d'une vision synthétique et pro-active. L'application couvre déjà les bases avec les alertes et les vues multi-chantiers, mais il manque des outils d'aide à la décision (score de santé, simulation, validation hiérarchique) et des rapports automatisés pour gagner du temps et réduire les risques.
