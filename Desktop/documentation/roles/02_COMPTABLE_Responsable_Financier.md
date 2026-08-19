# Rapport Rôle — Comptable / Responsable Financier

## Vue d'ensemble
Le Comptable est au cœur du flux financier de l'entreprise BTP. Il valide les dépenses, suit les encaissements, gère la facturation et produit les situations mensuelles/trimestrielles. Sa mission principale est la maîtrise de la trésorerie et la conformité comptable.

---

## Interface UI/UX actuelle

### Espace dédié
- **Finances** (`finances`) : tableau de bord financier
- **Dépenses** (`depenses`) : suivi et validation
- **Trésorerie** (`tresorerie`) : vue consolidée J-30, J-60, J-90
- **Budget prévisionnel** (`budget-previsionnel`) : comparaison prévu/réel
- **Rapports** (`rapports`) : états financiers
- **Alertes** (`alertes`, `alertes-intelligentes`) : retards clients, dépassements
- **Factures / Paiements** (`factures`, `paiements`) : émission et encaissements
- **Clients / Contrats** (`clients`, `contrats`) : contexte commercial

### Fonctionnalités présentes
- **Workflow validation dépenses à 2 niveaux** : Chef de Chantier valide la conformité → Comptable valide la pièce comptable
- **Filtres avancés sur les dépenses** : par chantier, catégorie, mois, recherche texte
- **Création de facture depuis devis accepté** : bouton "Transformer en facture" avec pré-remplissage
- **Enregistrement de paiements** : avec calcul automatique du reste à payer
- **Relances clients automatiques** : J+15, J+30, J+60 par email
- **Factures en retard** : vue dédiée avec indicateurs visuels
- **Duplication de factures** : gain de temps pour les factures récurrentes
- **Export PDF des factures** : mentions légales, acomptes, conditions de paiement
- **Alertes intelligentes** : retards paiement, dépassements budgétaires
- **Budget prévisionnel vs réel** : comparaison par chantier avec écarts et taux
- **Tableau de bord santé financière** : CA, marge, ratio de recouvrement, rentabilité par chantier

### Points forts actuels
- Workflow 2 niveaux bien séparé
- Vue trésorerie pro-active sur 3 échéances
- Alertes automatiques multi-niveaux
- Calculs auto : reste à payer, montantPaye, ratios

---

## Analyse métier — Ce qui lui manque vraiment

### Journée type d'un Comptable BTP
- 8h00 : saisir les factures fournisseurs et notes de frais de la veille
- 8h30 : valider les dépenses en attente (workflow 2 niveaux)
- 9h30 : relancer les clients impayés
- 10h30 : pointer les paiements reçus et rapprocher les comptes
- 11h30 : préparer les situations mensuelles par chantier
- 14h00 : saisir les factures clients et contrôler les acomptes
- 15h00 : vérifier les budgets prévisionnels vs réel
- 16h00 : exporter les données pour la comptabilité générale
- 17h00 : préparer les déclarations TVA et les exports bancaires

### Problèmes réels non couverts
- **Rapprochement bancaire manuel** : import OFX/CSV pas encore implémenté
- **Gestion des acomptes et retenues de garantie** : champs existent sur Devis mais pas sur Facture
- **Pas de module de paie** : pas d'intégration avec les pointages et heures sup
- **Export comptable limité** : pas d'export CSV/Excel standardisé pour la comptabilité
- **Pas de gestion des avoirs** : pas de type de facture "avoir" ni workflow d'annulation
- **Pas de déclarations fiscales automatisées** : CA12/CA3 à faire manuellement

---

## Recommandations métier — Fonctionnalités à ajouter

### À court terme — Critiques pour son quotidien
- **Gestion des acomptes et retenues de garantie** : interface dédiée pour enregistrer les acomptes versés et les retenues de garantie sur les factures
- **Export Excel/PDF pour tous les modules financiers** : pas seulement les factures
- **Améliorer le format PDF des factures** : ajouter les coordonnées bancaires, mentions légales complètes, acomptes visibles
- **Rapprochement bancaire simplifié** : import CSV/OFX, matching automatique des paiements

### À moyen terme — Pour gagner du temps
- **Module de TVA et déclarations (CA12/CA3)** : calcul automatique par période, export prêt à déposer
- **Gestion des avoirs** : type de facture "avoir" + workflow d'annulation
- **Comptabilité analytique par chantier et code budgétaire** : généraliser les champs `codeBudgetaire` et `imputationChantier` à toutes les dépenses
- **Module de factures récurrentes** : abonnements, contrats d'entretien avec génération automatique

### À long terme — Vision stratégique
- **Signature électronique** : intégration pour les devis, factures, PV de réception
- **Intégrations comptables tierces** : SAGE, QuickBooks, exports comptables automatisés
- **Rapprochement automatique intelligent** : matching entre relevés bancaires et factures avec IA
- **Module de reporting financier automatisé** : génération mensuelle/trimestrielle avec graphiques et analyses

---

## Conclusion
Le Comptable est le pilier financier de l'entreprise BTP. Ses fonctionnalités actuelles sont solides sur le workflow de validation et la trésorerie, mais il manque des outils de rapprochement, de déclaration fiscale et d'intégration comptable pour automatiser ses tâches récurrentes et réduire les risques d'erreur.
