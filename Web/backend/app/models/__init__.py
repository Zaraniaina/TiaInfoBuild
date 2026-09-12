"""TIA INFO BUILD - Models package.
Exporte tous les modèles SQLAlchemy pour garantir leur enregistrement dans Base.metadata.
"""
from app.models.affectation_chantier import AffectationChantier
from app.models.affectation_materiel import AffectationMateriel
from app.models.affectation_ressource import AffectationRessource
from app.models.alerte import Alerte
from app.models.alerte_materiel import AlerteMateriel
from app.models.article import Article
from app.models.avenant import Avenant
from app.models.chantier import Chantier
from app.models.client import Client
from app.models.client_adresse import ClientAdresse
from app.models.commentaire import Commentaire
from app.models.conge import Conge
from app.models.contrat import Contrat
from app.models.demande_travaux import DemandeTravaux
from app.models.depense import Depense
from app.models.devis import Devis
from app.models.document import Document
from app.models.employe import Employe
from app.models.entreprise import Entreprise
from app.models.equipe import Equipe
from app.models.facture import Facture
from app.models.fournisseur import Fournisseur
from app.models.heure_supplementaire import HeureSupplementaire
from app.models.historique_connexion import HistoriqueConnexion
from app.models.historique_poste import HistoriquePoste
from app.models.incident import Incident
from app.models.ligne_devis import LigneDevis
from app.models.ligne_facture import LigneFacture
from app.models.maintenance import Maintenance
from app.models.materiel import Materiel
from app.models.mouvement_materiel import MouvementMateriel
from app.models.membre_equipe import MembreEquipe

from app.models.metre import Metre
from app.models.mouvement_stock import MouvementStock
from app.models.notification import Notification
from app.models.paiement import Paiement
from app.models.phase import Phase
from app.models.photo_chantier import PhotoChantier
from app.models.plan import Plan
from app.models.projet import Projet
from app.models.situation_travaux import SituationTravaux, LigneSituation
from app.models.subscription import Subscription
from app.models.pointage import Pointage
from app.models.preference import Preference
from app.models.rapport_financier import RapportFinancier
from app.models.rapport_journalier import RapportJournalier
from app.models.refresh_token import RefreshToken
from app.models.role import Role
from app.models.signalement import Signalement
from app.models.sync_queue import SyncQueue
from app.models.tache import Tache
from app.models.travail_realise import TravailRealise
from app.models.utilisateur import Utilisateur

__all__ = [
    "AffectationChantier",
    "AffectationMateriel",
    "AffectationRessource",
    "Alerte",
    "AlerteMateriel",
    "Article",
    "Avenant",
    "Chantier",
    "Client",
    "ClientAdresse",
    "Commentaire",
    "Conge",
    "Contrat",
    "DemandeTravaux",
    "Depense",
    "Devis",
    "Document",
    "Employe",
    "Entreprise",
    "Equipe",
    "Facture",
    "Fournisseur",
    "HeureSupplementaire",
    "HistoriqueConnexion",
    "HistoriquePoste",
    "Incident",
    "LigneDevis",
    "LigneFacture",
    "LigneSituation",
    "Maintenance",
    "Materiel",
    "MouvementMateriel",
    "MembreEquipe",
    "Metre",
    "MouvementStock",
    "Notification",
    "Paiement",
    "Phase",
    "PhotoChantier",
    "Plan",
    "Projet",
    "SituationTravaux",
    "Subscription",
    "Pointage",
    "Preference",
    "RapportFinancier",
    "RapportJournalier",
    "RefreshToken",
    "Role",
    "Signalement",
    "SyncQueue",
    "Tache",
    "TravailRealise",
    "Utilisateur",
]
