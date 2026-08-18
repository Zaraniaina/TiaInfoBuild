"""CRUD pour les statistiques du dashboard."""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.facture import Facture
from app.models.depense import Depense
from app.models.chantier import Chantier
from app.models.employe import Employe
from app.models.article import Article
from app.models.client import Client
from app.models.devis import Devis
from app.models.materiel import Materiel
from app.models.alerte import Alerte


class DashboardCRUD:
    """CRUD dédié aux agrégations dashboard."""

    def __init__(self) -> None:
        pass

    async def get_stats(self, db: AsyncSession, entreprise_id: int) -> dict:
        ca_mois = 0.0
        depenses_mois = 0.0
        factures_en_retard = 0
        nb_chantiers_actifs = 0
        nb_employes = 0
        nb_articles = 0
        nb_clients = 0
        nb_devis = 0
        nb_materiels = 0
        top_chantiers = []
        ca_evolution = []
        alertes_recentes = []

        result = await db.execute(select(func.coalesce(func.sum(Facture.montant_ttc), 0)).where(Facture.entreprise_id == entreprise_id, Facture.is_deleted == False))
        ca_total = result.scalar_one_or_none() or 0.0

        result = await db.execute(select(func.count(Chantier.id)).where(Chantier.entreprise_id == entreprise_id, Chantier.statut == "en_cours", Chantier.is_deleted == False))
        nb_chantiers_actifs = result.scalar_one_or_none() or 0

        result = await db.execute(select(func.count(Employe.id)).where(Employe.entreprise_id == entreprise_id, Employe.is_deleted == False))
        nb_employes = result.scalar_one_or_none() or 0

        result = await db.execute(select(func.count(Article.id)).where(Article.entreprise_id == entreprise_id, Article.is_deleted == False))
        nb_articles = result.scalar_one_or_none() or 0

        result = await db.execute(select(func.count(Client.id)).where(Client.entreprise_id == entreprise_id, Client.is_deleted == False))
        nb_clients = result.scalar_one_or_none() or 0

        result = await db.execute(select(func.count(Devis.id)).where(Devis.entreprise_id == entreprise_id, Devis.is_deleted == False))
        nb_devis = result.scalar_one_or_none() or 0

        result = await db.execute(select(func.count(Materiel.id)).where(Materiel.entreprise_id == entreprise_id, Materiel.is_deleted == False))
        nb_materiels = result.scalar_one_or_none() or 0

        return {
            "ca_total": float(ca_total),
            "nb_chantiers_actifs": nb_chantiers_actifs,
            "nb_employes": nb_employes,
            "nb_articles": nb_articles,
            "nb_clients": nb_clients,
            "nb_devis": nb_devis,
            "nb_materiels": nb_materiels,
            "top_chantiers": top_chantiers,
            "ca_evolution": ca_evolution,
            "alertes_recentes": alertes_recentes,
        }
