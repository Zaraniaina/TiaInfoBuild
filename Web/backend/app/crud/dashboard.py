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
from app.models.maintenance import Maintenance


class DashboardCRUD:
    """CRUD dédié aux agrégations dashboard."""

    def __init__(self) -> None:
        pass

    async def get_stats(self, db: AsyncSession, entreprise_id: int, payload: dict | None = None) -> dict:
        role_code = (payload or {}).get("role_code", "")
        user_id = (payload or {}).get("sub")

        ca_total = 0.0
        ca_mois = 0.0
        depenses_mois = 0.0
        margin_net = 0.0
        factures_en_retard = 0
        nb_chantiers_actifs = 0
        nb_employes = 0
        nb_articles = 0
        nb_clients = 0
        nb_devis = 0
        devis_pending_dg = 0
        nb_materiels = 0
        stocks_alerte = 0
        attendance_rate = 0.0
        maintenance_due = 0
        top_chantiers = []
        ca_evolution = []
        alertes_recentes = []

        if role_code in ("super_admin", "admin_entreprise", "directeur", "comptable"):
            result = await db.execute(select(func.coalesce(func.sum(Facture.montant_ttc), 0)).where(Facture.entreprise_id == entreprise_id, Facture.is_deleted == False))
            ca_total = float(result.scalar_one_or_none() or 0.0)

            result = await db.execute(select(func.coalesce(func.sum(Depense.montant), 0)).where(Depense.entreprise_id == entreprise_id, Depense.is_deleted == False))
            depenses_mois = float(result.scalar_one_or_none() or 0.0)
            margin_net = ca_total - depenses_mois

        if role_code in ("super_admin", "admin_entreprise", "directeur", "chef_projet", "chef_chantier", "commercial", "employe", "client"):
            result = await db.execute(select(func.count(Chantier.id)).where(Chantier.entreprise_id == entreprise_id, Chantier.statut == "en_cours", Chantier.is_deleted == False))
            nb_chantiers_actifs = result.scalar_one_or_none() or 0

        if role_code in ("super_admin", "admin_entreprise", "directeur", "chef_projet", "chef_chantier", "rh", "employe"):
            result = await db.execute(select(func.count(Employe.id)).where(Employe.entreprise_id == entreprise_id, Employe.is_deleted == False))
            nb_employes = result.scalar_one_or_none() or 0

        if role_code in ("super_admin", "admin_entreprise", "directeur", "chef_projet", "chef_chantier", "magasinier", "employe"):
            result = await db.execute(select(func.count(Article.id)).where(Article.entreprise_id == entreprise_id, Article.is_deleted == False))
            nb_articles = result.scalar_one_or_none() or 0

            result = await db.execute(select(func.count(Article.id)).where(Article.entreprise_id == entreprise_id, Article.is_deleted == False, Article.stock_actuel <= Article.seuil_alerte))
            stocks_alerte = result.scalar_one_or_none() or 0

        if role_code in ("super_admin", "admin_entreprise", "directeur", "commercial", "client"):
            result = await db.execute(select(func.count(Client.id)).where(Client.entreprise_id == entreprise_id, Client.is_deleted == False))
            nb_clients = result.scalar_one_or_none() or 0

        if role_code in ("super_admin", "admin_entreprise", "directeur", "commercial", "client"):
            result = await db.execute(select(func.count(Devis.id)).where(Devis.entreprise_id == entreprise_id, Devis.is_deleted == False))
            nb_devis = result.scalar_one_or_none() or 0

            result = await db.execute(select(func.count(Devis.id)).where(Devis.entreprise_id == entreprise_id, Devis.is_deleted == False, Devis.statut == "brouillon"))
            devis_pending_dg = result.scalar_one_or_none() or 0

        if role_code in ("super_admin", "admin_entreprise", "directeur", "comptable"):
            result = await db.execute(select(func.count(Facture.id)).where(Facture.entreprise_id == entreprise_id, Facture.is_deleted == False, Facture.date_echeance < func.now()))
            factures_en_retard = result.scalar_one_or_none() or 0

        if role_code in ("super_admin", "admin_entreprise", "directeur", "chef_projet", "chef_chantier", "materiel", "employe"):
            result = await db.execute(select(func.count(Materiel.id)).where(Materiel.entreprise_id == entreprise_id, Materiel.is_deleted == False))
            nb_materiels = result.scalar_one_or_none() or 0

            result = await db.execute(select(func.count(Maintenance.id)).where(Maintenance.entreprise_id == entreprise_id, Maintenance.is_deleted == False, Maintenance.prochaine_date_echeance < func.now()))
            maintenance_due = result.scalar_one_or_none() or 0

        return {
            "ca_total": ca_total,
            "ca_mois": ca_total,
            "depenses_mois": depenses_mois,
            "margin_net": margin_net,
            "factures_en_retard": factures_en_retard,
            "factures_retard": factures_en_retard,
            "nb_chantiers_actifs": nb_chantiers_actifs,
            "nb_employes": nb_employes,
            "nb_articles": nb_articles,
            "nb_clients": nb_clients,
            "nb_devis": nb_devis,
            "devis_pending_dg": devis_pending_dg,
            "nb_materiels": nb_materiels,
            "stocks_alerte": stocks_alerte,
            "attendance_rate": attendance_rate,
            "maintenance_due": maintenance_due,
            "top_chantiers": top_chantiers,
            "ca_evolution": ca_evolution,
            "alertes_recentes": alertes_recentes,
        }
