# 🏗️ TIA INFO BUILD — Diagramme de Classes Complet

> **Projet** : Plateforme de gestion BTP — Electron + SQLite  
> **Version** : 1.0 — Août 2026  
> **Convention** : Soft delete (`is_deleted`), Sync flag (`is_synced`), Multi-tenant (`entrepriseId`)

---

```mermaid
classDiagram
    direction TB

    %% ============================================================
    %% MODULE 1 : TRANSVERSE (Entreprise, Rôles, Utilisateurs)
    %% ============================================================

    class Entreprise {
        +INTEGER id PK
        +INTEGER server_id UK
        +TEXT nom NOT NULL
        +TEXT nomCommercial
        +TEXT adresse
        +TEXT codePostal
        +TEXT ville
        +TEXT telephone
        +TEXT email
        +TEXT logo
        +TEXT abonnement
        +TEXT devise DEFAULT MGA
        +TEXT siret
        +TEXT numeroTVA
        +TEXT codeAPE
        +TEXT siteWeb
        +TEXT prefixeDevis DEFAULT DEV
        +TEXT prefixeFacture DEFAULT FAC
        +TEXT prefixeContrat DEFAULT CTR
        +REAL tvaDefaut
        +TEXT delaiPaiementDefaut
        +INTEGER validiteDevis
        +TEXT mentionsLegales
        +DATETIME dateCreation
        +INTEGER is_synced
        +INTEGER is_deleted
        +DATETIME created_at
        +DATETIME updated_at
    }

    class Role {
        +INTEGER id PK
        +INTEGER server_id UK
        +TEXT nom NOT NULL
        +TEXT description
        +TEXT code UK
        +INTEGER is_synced
        +INTEGER is_deleted
        +DATETIME created_at
        +DATETIME updated_at
    }

    class Utilisateur {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER entrepriseId FK
        +INTEGER roleId FK
        +TEXT nom NOT NULL
        +TEXT prenom
        +TEXT email UK NOT NULL
        +TEXT motDePasseHash
        +TEXT telephone
        +TEXT statut
        +DATETIME dateCreation
        +DATETIME derniereConnexion
        +INTEGER is_synced
        +INTEGER is_deleted
        +login(email, pwd) Boolean
        +hasRole(code) Boolean
        +hashPassword(pwd) String
        +verifyPassword(pwd, hash) Boolean
    }

    class Preference {
        +INTEGER id PK
        +INTEGER userId FK UK
        +TEXT theme DEFAULT auto
        +TEXT langue DEFAULT fr
        +TEXT dateFormat
        +TEXT devise DEFAULT MGA
        +INTEGER notifEmail DEFAULT 1
        +INTEGER notifPush DEFAULT 1
        +INTEGER notifFacturesRetard DEFAULT 1
        +INTEGER notifStockBas DEFAULT 1
        +DATETIME created_at
        +DATETIME updated_at
        +applyTheme() void
        +updateCurrency(devise) void
    }

    %% ============================================================
    %% MODULE 2 : CHANTIERS
    %% ============================================================

    class Chantier {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER entrepriseId FK
        +INTEGER clientId FK
        +INTEGER chefChantierId FK
        +TEXT numero
        +TEXT nom NOT NULL
        +TEXT adresse
        +TEXT codePostal
        +TEXT ville
        +DATE dateDebut
        +DATE dateFinPrevue
        +DATE dateFinReelle
        +REAL budgetPrevu DEFAULT 0
        +REAL budgetPrevisionnel DEFAULT 0
        +REAL budgetReel DEFAULT 0
        +REAL margeCible DEFAULT 0
        +REAL tva DEFAULT 20
        +TEXT statut DEFAULT planification
        +TEXT description
        +INTEGER is_synced
        +INTEGER is_deleted
        +recalculerBudgetReel() REAL
        +getAvancementGlobal() INTEGER
        +normalizeStatut(statut) TEXT
        +getDashboardStats() Object
    }

    class Phase {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER chantierId FK
        +TEXT nom NOT NULL
        +TEXT description
        +DATE dateDebut
        +DATE dateFin
        +REAL budget DEFAULT 0
        +INTEGER avancementPct DEFAULT 0
        +TEXT statut DEFAULT non_commencee
        +INTEGER ordre DEFAULT 0
        +INTEGER is_synced
        +INTEGER is_deleted
        +updateAvancement(pct) void
        +reorder(ids) void
        +getAvancementGlobal() INTEGER
    }

    class Incident {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER chantierId FK
        +INTEGER declarePar FK
        +TEXT titre NOT NULL
        +TEXT description
        +DATE dateIncident
        +TEXT gravite DEFAULT moyenne
        +TEXT statut DEFAULT signale
        +INTEGER is_synced
        +INTEGER is_deleted
        +changerStatut(statut) void
        +getOuvertsByEntreprise() Array
    }

    class AffectationRessource {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER chantierId FK
        +TEXT typeRessource NOT NULL
        +INTEGER ressourceId NOT NULL
        +DATE dateDebut
        +DATE dateFin
        +TEXT role
        +INTEGER is_synced
        +INTEGER is_deleted
        +getByChantier() Array
    }

    %% ============================================================
    %% MODULE 3 : RESSOURCES HUMAINES
    %% ============================================================

    class Employe {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER entrepriseId FK
        +TEXT matricule
        +TEXT nom NOT NULL
        +TEXT prenom
        +TEXT poste
        +TEXT photo
        +DATE dateEmbauche
        +REAL salaireBase DEFAULT 0
        +TEXT telephone
        +TEXT email
        +TEXT adresse
        +TEXT statut DEFAULT actif
        +INTEGER is_synced
        +INTEGER is_deleted
        +getPresentsToday() Array
        +pointer(data) Object
        +getDashboardStats() Object
        +createWithValidation(data) Object
        +getHeuresMois() REAL
    }

    class Equipe {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER entrepriseId FK
        +INTEGER chefEquipeId FK
        +TEXT nom NOT NULL
        +INTEGER is_synced
        +INTEGER is_deleted
        +getWithMembres() Object
        +ajouterMembre(empId) Object
        +retirerMembre(empId) Boolean
        +getByEntreprise() Array
    }

    class MembreEquipe {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER equipeId FK
        +INTEGER employeId FK
        +DATE dateAffectation
        +INTEGER is_synced
        +INTEGER is_deleted
        +getByEquipe() Array
        +getByEmploye() Array
        +exists(equipeId, employeId) Boolean
    }

    class AffectationChantier {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER employeId FK
        +INTEGER chantierId FK
        +DATE dateDebut
        +DATE dateFin
        +TEXT role
        +INTEGER is_synced
        +INTEGER is_deleted
    }

    class Pointage {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER employeId FK
        +INTEGER chantierId FK
        +DATE dateJour NOT NULL
        +TIME heureArrivee
        +TIME heureDepart
        +TEXT statut DEFAULT present
        +INTEGER is_synced
        +INTEGER is_deleted
        +calculerHeures() REAL
        +getByEmploye(options) Array
        +getByChantierAndDate(id, date) Array
        +pointer(data) Object
        +getStatsEmploye(id, deb, fin) Object
    }

    class HeureSupplementaire {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER employeId FK
        +INTEGER chantierId FK
        +DATE dateJour NOT NULL
        +REAL nombreHeures DEFAULT 0
        +REAL tauxMajoration DEFAULT 1.5
        +INTEGER is_synced
        +INTEGER is_deleted
        +getByEmploye(options) Array
        +getByChantier() Array
        +getTotalByEmploye() REAL
        +getCoutByChantier() REAL
    }

    %% ============================================================
    %% MODULE 4 : MATÉRIELS
    %% ============================================================

    class Materiel {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER entrepriseId FK
        +TEXT nom NOT NULL
        +TEXT designation
        +TEXT type
        +TEXT marque
        +TEXT modele
        +TEXT numeroSerie
        +DATE dateAcquisition
        +REAL valeurAchat DEFAULT 0
        +TEXT description
        +TEXT statut DEFAULT disponible
        +INTEGER is_synced
        +INTEGER is_deleted
        +getWithRelations() Object
        +getDisponibles() Array
        +getMaintenanceEnRetard() Array
        +getDashboardStats() Object
    }

    class AffectationMateriel {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER materielId FK
        +INTEGER chantierId FK
        +DATE dateDebut
        +DATE dateFin
        +INTEGER is_synced
        +INTEGER is_deleted
    }

    class Maintenance {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER materielId FK
        +TEXT type
        +DATE dateMaintenance
        +REAL cout DEFAULT 0
        +TEXT description
        +DATE prochaineDateEcheance
        +INTEGER is_synced
        +INTEGER is_deleted
        +getByMateriel() Array
        +getAVenir(jours) Array
        +getCoutTotalByMateriel() REAL
        +getStatsByType() Array
    }

    class AlerteMateriel {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER materielId FK
        +TEXT type
        +TEXT message
        +DATETIME dateAlerte
        +TEXT statut DEFAULT ouverte
        +INTEGER is_synced
        +INTEGER is_deleted
    }

    %% ============================================================
    %% MODULE 5 : STOCKS
    %% ============================================================

    class Article {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER entrepriseId FK
        +TEXT nom NOT NULL
        +TEXT designation
        +TEXT reference
        +TEXT categorie
        +TEXT unite
        +REAL prixUnitaire DEFAULT 0
        +REAL seuilAlerte DEFAULT 0
        +REAL quantiteStock DEFAULT 0
        +REAL stockActuel DEFAULT 0
        +TEXT description
        +INTEGER is_synced
        +INTEGER is_deleted
        +estEnAlerte() Boolean
        +getEnAlerte() Array
        +updateStock(qte, type, opt) Object
        +getDashboardStats() Object
    }

    class Fournisseur {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER entrepriseId FK
        +TEXT nom NOT NULL
        +TEXT contact
        +TEXT adresse
        +TEXT codePostal
        +TEXT ville
        +TEXT siret
        +TEXT telephone
        +TEXT email
        +TEXT conditionsPaiement
        +TEXT notes
        +INTEGER is_synced
        +INTEGER is_deleted
        +getByEntreprise(options) Array
        +search(query, fields, options) Array
        +createWithValidation(data) Object
        +getTopFournisseurs() Array
    }

    class MouvementStock {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER articleId FK
        +INTEGER chantierId FK
        +INTEGER fournisseurId FK
        +TEXT typeMouvement NOT NULL
        +REAL quantite NOT NULL
        +DATE dateMouvement
        +TEXT motif
        +INTEGER is_synced
        +INTEGER is_deleted
        +getByArticle() Array
        +getByChantier() Array
        +getByPeriode(deb, fin) Array
        +getStatsPeriode() Object
    }

    %% ============================================================
    %% MODULE 6 : COMMERCIAL
    %% ============================================================

    class Client {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER entrepriseId FK
        +TEXT nom NOT NULL
        +TEXT type DEFAULT particulier
        +TEXT civilite
        +TEXT prenom
        +TEXT entreprise
        +TEXT siret
        +TEXT numeroTVA
        +TEXT adresse
        +TEXT codePostal
        +TEXT ville
        +TEXT telephone
        +TEXT portable
        +TEXT email
        +TEXT siteWeb
        +TEXT notes
        +TEXT conditionsPaiement
        +TEXT modePaiement
        +REAL encoursMax DEFAULT 0
        +INTEGER commercialId FK
        +TEXT origine
        +TEXT rib
        +REAL caTotal DEFAULT 0
        +REAL encoursActuel DEFAULT 0
        +DATETIME dernierContact
        +INTEGER nbDevis DEFAULT 0
        +INTEGER nbFactures DEFAULT 0
        +INTEGER is_synced
        +INTEGER is_deleted
        +getWithRelations() Object
        +searchWithFilters(options) Array
        +getDisplayName() TEXT
    }

    class ClientAdresse {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER clientId FK
        +TEXT type NOT NULL
        +TEXT ligne1 NOT NULL
        +TEXT ligne2
        +TEXT codePostal NOT NULL
        +TEXT ville NOT NULL
        +TEXT pays DEFAULT Madagascar
        +INTEGER defaut DEFAULT 0
        +INTEGER is_synced
        +INTEGER is_deleted
        +getByClientId() Array
        +createForClient(data, id) Object
        +updateAdresse(id, data) Object
    }

    class Devis {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER entrepriseId FK
        +INTEGER clientId FK
        +TEXT numero
        +DATE dateCreation
        +DATE dateValidite
        +REAL montantTotal DEFAULT 0
        +TEXT statut DEFAULT brouillon
        +INTEGER is_synced
        +INTEGER is_deleted
        +getWithLignes() Object
        +createWithLignes(data, entId) Object
        +transformerEnContrat(data) Object
        +calculerTotal() REAL
    }

    class LigneDevis {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER devisId FK
        +TEXT description
        +REAL quantite DEFAULT 0
        +REAL prixUnitaire DEFAULT 0
        +INTEGER is_synced
        +INTEGER is_deleted
        +getByDevis() Array
        +calculerTotal() REAL
        +ajouterLigne(data) Object
        +remplacerLignes(lignes) Array
        +getSousTotal() REAL
    }

    class Contrat {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER entrepriseId FK
        +INTEGER devisId FK
        +INTEGER chantierId FK
        +DATE dateSignature
        +REAL montant DEFAULT 0
        +TEXT statut DEFAULT en_cours
        +INTEGER is_synced
        +INTEGER is_deleted
        +getWithRelations() Object
    }

    class Facture {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER entrepriseId FK
        +INTEGER contratId FK
        +TEXT numero
        +DATE dateEmission
        +DATE dateEcheance
        +REAL montant DEFAULT 0
        +REAL montantTTC DEFAULT 0
        +REAL montantPaye DEFAULT 0
        +TEXT statut DEFAULT emis
        +INTEGER is_synced
        +INTEGER is_deleted
        +getWithPaiements() Object
        +getEnRetard() Array
        +ajouterPaiement(data) Object
        +getResteAPayer() REAL
        +estEnRetard() Boolean
        +estPayee() Boolean
    }

    class Paiement {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER factureId FK
        +DATE datePaiement
        +REAL montant DEFAULT 0
        +TEXT modePaiement
        +INTEGER is_synced
        +INTEGER is_deleted
        +getByFacture() Array
        +getTotalPaye() REAL
    }

    %% ============================================================
    %% MODULE 7 : FINANCE & ALERTES
    %% ============================================================

    class Depense {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER chantierId FK
        +TEXT categorie
        +REAL montant DEFAULT 0
        +DATE dateDepense
        +TEXT justificatif
        +INTEGER valideePar FK
        +INTEGER is_synced
        +INTEGER is_deleted
        +getByChantier() Array
        +getTotalByChantier() REAL
        +getByCategorie() Array
        +getEnAttenteValidation() Array
    }

    class RapportFinancier {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER chantierId FK
        +TEXT periode
        +REAL chiffreAffaires DEFAULT 0
        +REAL depensesTotal DEFAULT 0
        +REAL marge DEFAULT 0
        +DATETIME dateGeneration
        +INTEGER is_synced
        +INTEGER is_deleted
    }

    class Alerte {
        +INTEGER id PK
        +INTEGER server_id UK
        +INTEGER entrepriseId FK
        +TEXT typeEntite
        +INTEGER entiteId
        +TEXT message
        +TEXT niveauGravite DEFAULT info
        +DATETIME dateAlerte
        +TEXT statut DEFAULT non_lue
        +INTEGER is_synced
        +INTEGER is_deleted
        +getNonLues(limit) Array
        +marquerLue() void
        +marquerToutesLues() INTEGER
        +creer(data) Object
        +countNonLues() INTEGER
    }

    %% ============================================================
    %% MODULE 8 : SYNCHRONISATION
    %% ============================================================

    class SyncQueue {
        +INTEGER id PK
        +TEXT tableName NOT NULL
        +INTEGER recordId NOT NULL
        +INTEGER serverId
        +TEXT operation NOT NULL
        +TEXT payload
        +TEXT status DEFAULT pending
        +INTEGER retryCount DEFAULT 0
        +TEXT errorMessage
        +DATETIME createdAt
        +DATETIME updatedAt
    }

    class SyncRepository {
        +static _config Object
        +getConfig() Object
        +setConfig(config) void
        +push() Promise~Object~
        +pull() Promise~Object~
        +getStatus() Object
        +getPendingCount() INTEGER
        +markSynced(table, id) void
        +logSync(data) Object
        +getHistory(limit) Array
    }

    class SyncService {
        -syncRepo SyncRepository
        -isSyncing Boolean
        -lastSyncTime DATETIME
        +push() Promise~Object~
        +pull() Promise~Object~
        +getStatus() Promise~Object~
    }

    %% ============================================================
    %% MODULE 9 : COUCHES ARCHITECTURE (Controllers & Repos)
    %% ============================================================

    class BaseRepository {
        #tableName TEXT
        #primaryKey TEXT
        #db Database
        -_tableColumns Set
        +getTableColumns() Set
        +refreshTableColumns() Set
        +create(data, entId) Object
        +getById(id) Object
        +getByServerId(serverId) Object
        +getAll(options) Array
        +count(options) INTEGER
        +update(id, data) Object
        +softDelete(id) Boolean
        +hardDelete(id) Boolean
        +markSynced(id, serverId) Boolean
        +getUnsynced(entId, limit) Array
        +getDeletedUnsynced(entId, limit) Array
        +search(term, cols, opts) Array
        +rawQuery(sql, params) Array
        +transaction(callback) Object
    }

    class ChantierRepository {
        +phaseRepo PhaseRepository
        +incidentRepo IncidentRepository
        +normalizeStatut(statut) TEXT
        +getWithRelations(id) Object
        +getListWithStats(options) Array
        +countWithFilters(options) INTEGER
        +getDashboardStats(entId) Object
        +createWithValidation(data, entId) Object
        +update(id, data) Object
        +softDelete(id) Object
        +savePhases(chantierId, phases) Array
        +recalculerBudgetReel(id) Object
        +addPhase(chantierId, data) Object
        +addIncident(chantierId, data, userId) Object
    }

    class ClientRepository {
        +getTableColumns() Array
        +getAll(options) Array
        +count(options) INTEGER
        +searchWithFilters(entId, opts) Array
        +countWithFilters(entId, opts) INTEGER
        +getWithRelations(id) Object
        +create(data, entId) Object
        +update(id, data) Object
        +softDelete(id) Object
    }

    class EmployeRepository {
        +getWithRelations(id) Object
        +getListWithStats(options) Array
        +getPresentsToday(entId) Array
        +pointer(data) Object
        +getDashboardStats(entId) Object
        +createWithValidation(data, entId) Object
    }

    class ArticleRepository {
        +getEnAlerte(entId) Array
        +updateStock(id, qte, type, opts) Object
        +getDashboardStats(entId) Object
    }

    class MaterielRepository {
        +getByEntreprise(entId, opts) Array
        +getWithRelations(id) Object
        +getDisponibles(entId) Array
        +getMaintenanceEnRetard(entId) Array
        +getDashboardStats(entId) Object
    }

    class DevisRepository {
        +getWithLignes(id) Object
        +createWithLignes(data, entId) Object
        +transformerEnContrat(id, data) Object
    }

    class FactureRepository {
        +getWithPaiements(id) Object
        +getEnRetard(entId) Array
        +ajouterPaiement(id, data) Object
    }

    class DashboardRepository {
        +getStats(entId) Object
        +getActiviteRecente(entId, limit) Array
        +getCAEvolution(entId) Array
        +getTopChantiersBudget(entId) Array
    }

    class UtilisateurRepository {
        +getListWithRole(options) Array
        +getWithRelations(id) Object
        +createUser(data, entId) Object
        +updateUser(id, data) Object
        +hashPassword(pwd) TEXT
        +verifyPassword(pwd, hash) Boolean
    }

    class ChantierController {
        +getList(event, params) Object
        +getById(event, id) Object
        +create(event, data, entId) Object
        +update(event, id, data) Object
        +delete(event, id) Object
        +getStats(event, entId) Object
        +recalculerBudget(event, id) Object
        +addPhase(event, id, data) Object
        +savePhases(event, id, phases) Object
        +addIncident(event, id, data, userId) Object
    }

    class RhController {
        +getListEmployes(event, params) Object
        +getEmployeById(event, id) Object
        +createEmploye(event, data, entId) Object
        +updateEmploye(event, id, data) Object
        +deleteEmploye(event, id) Object
        +getPresentsToday(event, entId) Object
        +pointer(event, data) Object
        +getStatsEmployes(event, entId) Object
    }

    class StockController {
        +getListArticles(event, params) Object
        +getArticleById(event, id) Object
        +createArticle(event, data, entId) Object
        +updateArticle(event, id, data) Object
        +deleteArticle(event, id) Object
        +getArticlesEnAlerte(event, entId) Object
        +updateStockArticle(event, id, qte, type, opts) Object
        +getStatsArticles(event, entId) Object
    }

    class MaterielController {
        +getListMateriels(event, params) Object
        +getMaterielById(event, id) Object
        +createMateriel(event, data, entId) Object
        +updateMateriel(event, id, data) Object
        +deleteMateriel(event, id) Object
        +getStatsMateriels(event, entId) Object
    }

    class CommercialController {
        +getListClients(event, params) Object
        +getClientById(event, id) Object
        +createClient(event, data, entId) Object
        +updateClient(event, id, data) Object
        +deleteClient(event, id) Object
        +getListDevis(event, params) Object
        +getDevisById(event, id) Object
        +createDevis(event, data, entId) Object
        +getListFactures(event, params) Object
        +ajouterPaiementFacture(event, id, data) Object
    }

    class FinanceController {
        +getDepensesByChantier(event, id) Object
        +getTotalDepensesByChantier(event, id) Object
        +getDepensesByCategorie(event, id) Object
        +getDepensesEnAttenteValidation(event, entId) Object
        +getAlertesNonLues(event, entId, limit) Object
        +marquerAlerteLue(event, id) Object
        +marquerToutesAlertesLues(event, entId) Object
        +creerAlerte(event, data) Object
        +countAlertesNonLues(event, entId) Object
    }

    class DashboardController {
        +getDashboardStats(event, entId) Object
        +getCAEvolution(event, entId) Object
        +getTopChantiersBudget(event, entId) Object
        +getActiviteRecente(event, entId, limit) Object
    }

    class SyncController {
        +getConfig(event) Object
        +setConfig(event, config) Object
        +getHistory(event, limit) Object
        +getStatus(event) Object
        +push(event) Object
        +pull(event) Object
        +testConnection(event) Object
        +syncNow(event) Object
    }

    class UtilisateurController {
        +getList(event, params) Object
        +getById(event, id) Object
        +create(event, data, entId) Object
        +update(event, id, data) Object
        +delete(event, id) Object
    }

    class ApiClient {
        -baseUrl TEXT
        -token TEXT
        +setToken(token) void
        +getHeaders() Object
        +request(endpoint, options) Promise
        +get(endpoint, params) Promise
        +post(endpoint, body) Promise
        +put(endpoint, body) Promise
        +delete(endpoint) Promise
    }

    %% ============================================================
    %% RELATIONS : MODULE TRANSVERSE
    %% ============================================================

    Entreprise "1" --> "*" Utilisateur : emploie
    Role "1" --> "*" Utilisateur : attribué_à
    Utilisateur "1" --> "0..1" Preference : possède

    %% ============================================================
    %% RELATIONS : MODULE CHANTIERS
    %% ============================================================

    Entreprise "1" --> "*" Chantier : gère
    Client "1" --> "*" Chantier : commandite
    Utilisateur "1" --> "*" Chantier : dirige
    Chantier "1" --> "*" Phase : contient
    Chantier "1" --> "*" Incident : a_pour
    Chantier "1" --> "*" AffectationRessource : affecte
    Utilisateur "1" --> "*" Incident : déclare

    %% ============================================================
    %% RELATIONS : MODULE RH
    %% ============================================================

    Entreprise "1" --> "*" Employe : emploie
    Entreprise "1" --> "*" Equipe : organise
    Employe "1" --> "*" Pointage : pointe
    Employe "1" --> "*" HeureSupplementaire : effectue
    Employe "*" --> "*" Equipe : appartient_à
    Equipe "1" --> "*" MembreEquipe : compose
    MembreEquipe "*" --> "1" Employe : référence
    Employe "1" --> "*" AffectationChantier : affecté_à
    AffectationChantier "*" --> "1" Chantier : sur
    Pointage "*" --> "0..1" Chantier : sur
    HeureSupplementaire "*" --> "0..1" Chantier : sur
    Employe "0..1" --> "0..1" Equipe : chef_de

    %% ============================================================
    %% RELATIONS : MODULE MATÉRIELS
    %% ============================================================

    Entreprise "1" --> "*" Materiel : possède
    Materiel "1" --> "*" AffectationMateriel : affecté_à
    AffectationMateriel "*" --> "1" Chantier : sur
    Materiel "1" --> "*" Maintenance : subit
    Materiel "1" --> "*" AlerteMateriel : déclenche

    %% ============================================================
    %% RELATIONS : MODULE STOCKS
    %% ============================================================

    Entreprise "1" --> "*" Article : possède
    Entreprise "1" --> "*" Fournisseur : travaille_avec
    Article "1" --> "*" MouvementStock : fait_objet_de
    Fournisseur "1" --> "*" MouvementStock : approvisionne
    MouvementStock "*" --> "0..1" Chantier : destiné_à

    %% ============================================================
    %% RELATIONS : MODULE COMMERCIAL
    %% ============================================================

    Entreprise "1" --> "*" Client : a_pour
    Utilisateur "1" --> "*" Client : commercial_référent
    Client "1" --> "*" ClientAdresse : possède
    Client "1" --> "*" Devis : reçoit
    Devis "1" --> "*" LigneDevis : contient
    Devis "0..1" --> "0..1" Contrat : transformé_en
    Contrat "1" --> "*" Facture : facturé_par
    Facture "1" --> "*" Paiement : réglée_par
    Contrat "0..1" --> "0..1" Chantier : lié_à

    %% ============================================================
    %% RELATIONS : MODULE FINANCE
    %% ============================================================

    Chantier "1" --> "*" Depense : génère
    Utilisateur "1" --> "*" Depense : valide
    Chantier "1" --> "*" RapportFinancier : génère
    Entreprise "1" --> "*" Alerte : reçoit

    %% ============================================================
    %% RELATIONS : HÉRITAGE REPOSITORIES
    %% ============================================================

    BaseRepository <|-- ChantierRepository
    BaseRepository <|-- ClientRepository
    BaseRepository <|-- EmployeRepository
    BaseRepository <|-- ArticleRepository
    BaseRepository <|-- MaterielRepository
    BaseRepository <|-- DevisRepository
    BaseRepository <|-- FactureRepository
    BaseRepository <|-- DashboardRepository
    BaseRepository <|-- UtilisateurRepository
    BaseRepository <|-- SyncRepository

    %% ============================================================
    %% RELATIONS : CONTROLLERS → REPOSITORIES
    %% ============================================================

    ChantierController --> ChantierRepository : utilise
    RhController --> EmployeRepository : utilise
    StockController --> ArticleRepository : utilise
    MaterielController --> MaterielRepository : utilise
    CommercialController --> ClientRepository : utilise
    CommercialController --> DevisRepository : utilise
    CommercialController --> FactureRepository : utilise
    FinanceController --> Depense : gère
    FinanceController --> Alerte : gère
    DashboardController --> DashboardRepository : utilise
    SyncController --> SyncRepository : utilise
    UtilisateurController --> UtilisateurRepository : utilise

    %% ============================================================
    %% RELATIONS : SERVICES
    %% ============================================================

    SyncService --> SyncRepository : orchestre
    SyncService --> ApiClient : communique_via
    ApiClient --> SyncQueue : alimente
```