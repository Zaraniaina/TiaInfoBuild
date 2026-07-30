# TIA INFO BUILD — Conception de la Base de Données
## Diagrammes de Classe UML par Module

> Convention : les diagrammes sont découpés par module fonctionnel pour rester lisibles, puis reliés entre eux dans le schéma global en fin de document. Types de données pensés pour une implémentation MySQL/PDO (cohérent avec tes autres projets PHP).

---

## 0. Module Transverse — Utilisateurs, Rôles & Entreprise (multi-tenant SaaS)

Comme TIA INFO BUILD est un SaaS, chaque entreprise cliente doit être isolée (multi-tenant). Tout objet métier est rattaché, directement ou indirectement, à une `Entreprise`.

```mermaid
classDiagram
    class Entreprise {
        +int id
        +string nom
        +string adresse
        +string telephone
        +string email
        +string logo
        +string abonnement
        +date dateCreation
    }

    class Role {
        +int id
        +string nom
        +string description
    }

    class Utilisateur {
        +int id
        +int entrepriseId
        +int roleId
        +string nom
        +string prenom
        +string email
        +string motDePasseHash
        +string telephone
        +string statut
        +date dateCreation
        +date derniereConnexion
    }

    Entreprise "1" --> "0..*" Utilisateur : emploie
    Role "1" --> "0..*" Utilisateur : possède
```

**Rôles typiques** : Administrateur, Directeur, Chef de chantier, Comptable/Gestionnaire, Magasinier, Employé de terrain.

---

## 1. Module Gestion des Chantiers (cœur du système)

```mermaid
classDiagram
    class Chantier {
        +int id
        +int entrepriseId
        +int clientId
        +int chefChantierId
        +string nom
        +string adresse
        +date dateDebut
        +date dateFinPrevue
        +date dateFinReelle
        +decimal budgetPrevu
        +decimal budgetReel
        +string statut
        +string description
    }

    class Phase {
        +int id
        +int chantierId
        +string nom
        +date dateDebut
        +date dateFin
        +int avancementPct
        +string statut
        +int ordre
    }

    class Incident {
        +int id
        +int chantierId
        +int declarePar
        +string titre
        +string description
        +date dateIncident
        +string gravite
        +string statut
    }

    class AffectationRessource {
        +int id
        +int chantierId
        +string typeRessource
        +int ressourceId
        +date dateDebut
        +date dateFin
    }

    Chantier "1" --> "0..*" Phase : contient
    Chantier "1" --> "0..*" Incident : subit
    Chantier "1" --> "0..*" AffectationRessource : mobilise
```

`AffectationRessource` est une table pivot générique (`typeRessource` = "Employe" | "Materiel") qui pointe vers `ressourceId`. Alternative plus stricte : une table dédiée par type de ressource (voir modules 2 et 3) — recommandé si tu veux garder l'intégrité référentielle (FK propres), la table générique est plus flexible mais moins "propre" en SQL classique.

---

## 2. Module Ressources Humaines

```mermaid
classDiagram
    class Employe {
        +int id
        +int entrepriseId
        +string matricule
        +string nom
        +string prenom
        +string poste
        +date dateEmbauche
        +decimal salaireBase
        +string telephone
        +string statut
    }

    class Equipe {
        +int id
        +int chefEquipeId
        +string nom
    }

    class MembreEquipe {
        +int id
        +int equipeId
        +int employeId
        +date dateAffectation
    }

    class AffectationChantier {
        +int id
        +int employeId
        +int chantierId
        +date dateDebut
        +date dateFin
        +string role
    }

    class Pointage {
        +int id
        +int employeId
        +int chantierId
        +date dateJour
        +time heureArrivee
        +time heureDepart
        +string statut
    }

    class HeureSupplementaire {
        +int id
        +int employeId
        +int chantierId
        +date dateJour
        +decimal nombreHeures
        +decimal tauxMajoration
    }

    Employe "1" --> "0..*" AffectationChantier
    Employe "1" --> "0..*" Pointage
    Employe "1" --> "0..*" HeureSupplementaire
    Equipe "1" --> "0..*" MembreEquipe
    Employe "1" --> "0..*" MembreEquipe
    Chantier "1" --> "0..*" AffectationChantier
```

---

## 3. Module Gestion des Matériels

```mermaid
classDiagram
    class Materiel {
        +int id
        +int entrepriseId
        +string nom
        +string type
        +string numeroSerie
        +date dateAcquisition
        +decimal valeurAchat
        +string statut
    }

    class AffectationMateriel {
        +int id
        +int materielId
        +int chantierId
        +date dateDebut
        +date dateFin
    }

    class Maintenance {
        +int id
        +int materielId
        +string type
        +date dateMaintenance
        +decimal cout
        +string description
        +date prochaineDateEcheance
    }

    class AlerteMateriel {
        +int id
        +int materielId
        +string type
        +string message
        +date dateAlerte
        +string statut
    }

    Materiel "1" --> "0..*" AffectationMateriel
    Materiel "1" --> "0..*" Maintenance
    Materiel "1" --> "0..*" AlerteMateriel
    Chantier "1" --> "0..*" AffectationMateriel
```

---

## 4. Module Gestion des Stocks

```mermaid
classDiagram
    class Article {
        +int id
        +int entrepriseId
        +string nom
        +string categorie
        +string unite
        +decimal seuilAlerte
        +decimal quantiteStock
    }

    class Fournisseur {
        +int id
        +string nom
        +string contact
        +string adresse
        +string telephone
    }

    class MouvementStock {
        +int id
        +int articleId
        +int chantierId
        +int fournisseurId
        +string typeMouvement
        +decimal quantite
        +date dateMouvement
        +string motif
    }

    Article "1" --> "0..*" MouvementStock
    Fournisseur "1" --> "0..*" MouvementStock
    Chantier "1" --> "0..*" MouvementStock : consomme
```

`typeMouvement` = "Entree" | "Sortie". La consommation par chantier se déduit simplement des sorties filtrées par `chantierId`.

---

## 5. Module Commercial

```mermaid
classDiagram
    class Client {
        +int id
        +int entrepriseId
        +string nom
        +string type
        +string adresse
        +string telephone
        +string email
    }

    class Devis {
        +int id
        +int clientId
        +date dateCreation
        +date dateValidite
        +decimal montantTotal
        +string statut
    }

    class LigneDevis {
        +int id
        +int devisId
        +string description
        +decimal quantite
        +decimal prixUnitaire
    }

    class Contrat {
        +int id
        +int devisId
        +int chantierId
        +date dateSignature
        +decimal montant
        +string statut
    }

    class Facture {
        +int id
        +int contratId
        +date dateEmission
        +date dateEcheance
        +decimal montant
        +string statut
    }

    class Paiement {
        +int id
        +int factureId
        +date datePaiement
        +decimal montant
        +string modePaiement
    }

    Client "1" --> "0..*" Devis
    Devis "1" --> "0..*" LigneDevis
    Devis "1" --> "0..1" Contrat : transforme en
    Contrat "1" --> "1" Chantier : génère
    Contrat "1" --> "0..*" Facture
    Facture "1" --> "0..*" Paiement
```

---

## 6. Module Finance & Aide à la Décision

```mermaid
classDiagram
    class Depense {
        +int id
        +int chantierId
        +string categorie
        +decimal montant
        +date dateDepense
        +string justificatif
        +int valideePar
    }

    class RapportFinancier {
        +int id
        +int chantierId
        +string periode
        +decimal chiffreAffaires
        +decimal depensesTotal
        +decimal marge
        +date dateGeneration
    }

    class Alerte {
        +int id
        +int entrepriseId
        +string typeEntite
        +int entiteId
        +string message
        +string niveauGravite
        +date dateAlerte
        +string statut
    }

    Chantier "1" --> "0..*" Depense
    Chantier "1" --> "0..*" RapportFinancier
```

`Alerte` est une table générique transverse (dépassement budgétaire, rupture de stock, matériel en panne, retard de phase...) via `typeEntite` + `entiteId`, utilisée pour alimenter le tableau de bord.

---

## Schéma Relationnel Global (vue d'ensemble simplifiée)

```mermaid
classDiagram
    Entreprise --> Utilisateur
    Entreprise --> Chantier
    Client --> Chantier
    Utilisateur --> Chantier : chef de chantier

    Chantier --> Phase
    Chantier --> Incident
    Chantier --> AffectationChantier
    Chantier --> AffectationMateriel
    Chantier --> MouvementStock
    Chantier --> Depense
    Chantier --> RapportFinancier
    Chantier --> Contrat

    Employe --> AffectationChantier
    Employe --> Pointage
    Employe --> HeureSupplementaire
    Equipe --> MembreEquipe
    Employe --> MembreEquipe

    Materiel --> AffectationMateriel
    Materiel --> Maintenance
    Materiel --> AlerteMateriel

    Article --> MouvementStock
    Fournisseur --> MouvementStock

    Client --> Devis
    Devis --> LigneDevis
    Devis --> Contrat
    Contrat --> Facture
    Facture --> Paiement
```

---

## Notes de conception

- **Multi-tenant** : chaque table racine (Chantier, Employe, Materiel, Article, Client) porte `entrepriseId` pour cloisonner les données entre entreprises clientes du SaaS.
- **Soft delete recommandé** : ajouter un champ `estArchive` ou `dateSuppression` plutôt que des suppressions physiques, vu le besoin de traçabilité mentionné dans le cahier des charges.
- **Horodatage** : ajouter systématiquement `createdAt` / `updatedAt` sur toutes les tables (bonne pratique PDO/MySQL).
- **Prochaine étape naturelle** : passer de ce Modèle de classes → Modèle Logique (tables + clés étrangères + contraintes) → script SQL `CREATE TABLE`. Dis-moi si tu veux qu'on enchaîne directement sur le script SQL MySQL, ou si tu veux d'abord qu'on ajuste certaines entités (ex: gestion de la TVA sur les factures, gestion des sous-traitants, etc.).
