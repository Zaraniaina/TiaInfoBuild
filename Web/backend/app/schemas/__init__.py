# TIA INFO BUILD - Schemas
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    PermissionResponse,
    RefreshRequest,
    RegisterRequest,
    Token,
    TokenPayload,
    UserResponse,
)
from app.schemas.chantier import (
    ChantierCreate,
    ChantierList,
    ChantierResponse,
    ChantierStatutUpdate,
    ChantierUpdate,
)
from app.schemas.client import (
    ClientAdresseCreate,
    ClientAdresseResponse,
    ClientAdresseUpdate,
    ClientCreate,
    ClientList,
    ClientResponse,
    ClientUpdate,
)
from app.schemas.contrat import (
    ContratCreate,
    ContratList,
    ContratResponse,
    ContratUpdate,
)
from app.schemas.demande_travaux import (
    DemandeTravauxCreate,
    DemandeTravauxList,
    DemandeTravauxResponse,
    DemandeTravauxUpdate,
)
from app.schemas.projet import (
    ProjetCreate,
    ProjetList,
    ProjetResponse,
    ProjetUpdate,
)
from app.schemas.metre import (
    MetreCreate,
    MetreList,
    MetreResponse,
    MetreUpdate,
)
from app.schemas.situation_travaux import (
    SituationTravauxCreate,
    SituationTravauxList,
    SituationTravauxResponse,
    SituationTravauxUpdate,
    LigneSituationCreate,
    LigneSituationResponse,
)
from app.schemas.depense import (
    DepenseCreate,
    DepenseList,
    DepenseResponse,
    DepenseUpdate,
    DepenseValidationRequest,
)
from app.schemas.devis import (
    DevisCreate,
    DevisList,
    DevisResponse,
    DevisStatutUpdate,
    DevisUpdate,
    LigneDevisCreate,
    LigneDevisResponse,
)
from app.schemas.employe import (
    ChangementPosteRequest,
    EmployeCreate,
    EmployeList,
    EmployeResponse,
    EmployeUpdate,
)
from app.schemas.entreprise import (
    EntrepriseCreate,
    EntrepriseResponse,
    EntrepriseUpdate,
)
from app.schemas.equipe import (
    EquipeCreate,
    EquipeList,
    EquipeResponse,
    EquipeUpdate,
    MembreEquipeCreate,
)
from app.schemas.facture import (
    FactureCreate,
    FactureList,
    FactureResponse,
    FactureUpdate,
    PaiementCreate,
    PaiementResponse,
    PaiementUpdate,
)
from app.schemas.fournisseur import (
    FournisseurCreate,
    FournisseurList,
    FournisseurResponse,
    FournisseurUpdate,
)
from app.schemas.materiel import (
    MaintenanceCreate,
    MaintenanceResponse,
    MaterielCreate,
    MaterielList,
    MaterielResponse,
    MaterielUpdate,
)
from app.schemas.mouvement_stock import (
    MouvementStockCreate,
    MouvementStockList,
    MouvementStockResponse,
)
from app.schemas.pointage import (
    PointageCreate,
    PointageList,
    PointageResponse,
    PointageUpdate,
)
from app.schemas.role import (
    RoleCreate,
    RoleResponse,
    RoleUpdate,
)
from app.schemas.utilisateur import (
    UtilisateurCreate,
    UtilisateurList,
    UtilisateurResponse,
    UtilisateurRoleUpdate,
    UtilisateurUpdate,
)
from app.schemas.alerte import (
    AlerteCreate,
    AlerteList,
    AlerteMarquerLue,
    AlerteResponse,
)
from app.schemas.dashboard import (
    CaEvolutionResponse,
    DashboardStats,
    DashboardStatsResponse,
    DepensesParCategorieResponse,
    FactureRetardResponse,
    SuperAdminStatsResponse,
    TopChantierResponse,
)
from app.schemas.article import (
    ArticleCreate,
    ArticleList,
    ArticleResponse,
    ArticleUpdate,
    StockAdjustmentRequest,
)

__all__ = [
    # auth
    "LoginRequest",
    "RegisterRequest",
    "RefreshRequest",
    "Token",
    "TokenPayload",
    "ChangePasswordRequest",
    "UserResponse",
    "PermissionResponse",
    # entreprise
    "EntrepriseCreate",
    "EntrepriseUpdate",
    "EntrepriseResponse",
    # role
    "RoleCreate",
    "RoleUpdate",
    "RoleResponse",
    # utilisateur
    "UtilisateurCreate",
    "UtilisateurUpdate",
    "UtilisateurResponse",
    "UtilisateurList",
    "UtilisateurRoleUpdate",
    # chantier
    "ChantierCreate",
    "ChantierUpdate",
    "ChantierResponse",
    "ChantierList",
    "ChantierStatutUpdate",
    # employe
    "EmployeCreate",
    "EmployeUpdate",
    "EmployeResponse",
    "EmployeList",
    "ChangementPosteRequest",
    # pointage
    "PointageCreate",
    "PointageUpdate",
    "PointageResponse",
    "PointageList",
    # equipe
    "EquipeCreate",
    "EquipeUpdate",
    "EquipeResponse",
    "EquipeList",
    "MembreEquipeCreate",
    # article
    "ArticleCreate",
    "ArticleUpdate",
    "ArticleResponse",
    "ArticleList",
    "StockAdjustmentRequest",
    # fournisseur
    "FournisseurCreate",
    "FournisseurUpdate",
    "FournisseurResponse",
    "FournisseurList",
    # mouvement_stock
    "MouvementStockCreate",
    "MouvementStockResponse",
    "MouvementStockList",
    # client
    "ClientCreate",
    "ClientUpdate",
    "ClientResponse",
    "ClientList",
    "ClientAdresseCreate",
    "ClientAdresseResponse",
    "ClientAdresseUpdate",
    # devis
    "DevisCreate",
    "DevisUpdate",
    "DevisResponse",
    "DevisList",
    "LigneDevisCreate",
    "LigneDevisResponse",
    "DevisStatutUpdate",
    # contrat
    "ContratCreate",
    "ContratUpdate",
    "ContratResponse",
    "ContratList",
    # demande_travaux
    "DemandeTravauxCreate",
    "DemandeTravauxUpdate",
    "DemandeTravauxResponse",
    "DemandeTravauxList",
    # projet
    "ProjetCreate",
    "ProjetUpdate",
    "ProjetResponse",
    "ProjetList",
    # metre
    "MetreCreate",
    "MetreUpdate",
    "MetreResponse",
    "MetreList",
    # situation_travaux
    "SituationTravauxCreate",
    "SituationTravauxUpdate",
    "SituationTravauxResponse",
    "SituationTravauxList",
    "LigneSituationCreate",
    "LigneSituationResponse",
    # facture
    "FactureCreate",
    "FactureUpdate",
    "FactureResponse",
    "FactureList",
    "PaiementCreate",
    "PaiementResponse",
    "PaiementUpdate",
    # depense
    "DepenseCreate",
    "DepenseUpdate",
    "DepenseResponse",
    "DepenseList",
    "DepenseValidationRequest",
    # materiel
    "MaterielCreate",
    "MaterielUpdate",
    "MaterielResponse",
    "MaterielList",
    "MaintenanceCreate",
    "MaintenanceResponse",
    # alerte
    "AlerteCreate",
    "AlerteResponse",
    "AlerteList",
    "AlerteMarquerLue",
    # dashboard
    "DashboardStats",
    "DashboardStatsResponse",
    "CaEvolutionResponse",
    "TopChantierResponse",
    "DepensesParCategorieResponse",
    "FactureRetardResponse",
    "SuperAdminStatsResponse",
]
