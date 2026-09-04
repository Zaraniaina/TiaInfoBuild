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
from app.models.utilisateur import Utilisateur
from app.models.rapport_financier import RapportFinancier
from app.models.pointage import Pointage
from app.models.incident import Incident
from app.models.mouvement_stock import MouvementStock
from app.models.contrat import Contrat
from app.models.paiement import Paiement


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
        marge_brute = 0.0
        marge_nette = 0.0
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
        alertes_critiques = 0
        nb_utilisateurs = 0
        utilisateurs_inactifs = 0
        uptime = 99.9
        taux_avancement_physique = 0.0
        taux_avancement_financier = 0.0
        rentabilite_chantiers = []
        depassements_budgetaires = 0
        delai_moyen_paiement = 0.0
        tresorerie_par_client = []
        rapports_disponibles = 0

        if role_code in ("super_admin", "admin_entreprise", "directeur", "comptable"):
            result = await db.execute(select(func.coalesce(func.sum(Facture.montant_ttc), 0)).where(Facture.entreprise_id == entreprise_id, Facture.is_deleted == False))
            ca_total = float(result.scalar_one_or_none() or 0.0)

            result = await db.execute(select(func.coalesce(func.sum(Depense.montant), 0)).where(Depense.entreprise_id == entreprise_id, Depense.is_deleted == False))
            depenses_mois = float(result.scalar_one_or_none() or 0.0)
            marge_brute = ca_total - depenses_mois
            marge_nette = marge_brute * 0.9  # approximation après impôts
            margin_net = marge_nette

        if role_code in ("super_admin", "admin_entreprise", "directeur", "chef_projet", "chef_chantier", "commercial", "employe", "client"):
            result = await db.execute(select(func.count(Chantier.id)).where(Chantier.entreprise_id == entreprise_id, Chantier.statut == "en_cours", Chantier.is_deleted == False))
            nb_chantiers_actifs = result.scalar_one_or_none() or 0

            if nb_chantiers_actifs > 0:
                avancement_result = await db.execute(select(func.avg(Chantier.budget_reel / func.nullif(Chantier.budget_prevu, 0))).where(Chantier.entreprise_id == entreprise_id, Chantier.statut == "en_cours", Chantier.is_deleted == False, Chantier.budget_prevu > 0))
                taux_avancement_financier = float(avancement_result.scalar_one_or_none() or 0.0) * 100

                phases_result = await db.execute(select(func.avg(Chantier.budget_reel / func.nullif(Chantier.budget_prevu, 0))).where(Chantier.entreprise_id == entreprise_id, Chantier.statut == "en_cours", Chantier.is_deleted == False, Chantier.budget_prevu > 0))
                taux_avancement_physique = float(phases_result.scalar_one_or_none() or 0.0) * 100

                if taux_avancement_physique > 100:
                    taux_avancement_physique = 100.0
                if taux_avancement_financier > 100:
                    taux_avancement_financier = 100.0

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

        if role_code in ("super_admin", "admin_entreprise", "directeur"):
            result = await db.execute(select(func.count(Utilisateur.id)).where(Utilisateur.entreprise_id == entreprise_id, Utilisateur.is_deleted == False))
            nb_utilisateurs = result.scalar_one_or_none() or 0

            result = await db.execute(select(func.count(Utilisateur.id)).where(Utilisateur.entreprise_id == entreprise_id, Utilisateur.statut == "inactif", Utilisateur.is_deleted == False))
            utilisateurs_inactifs = result.scalar_one_or_none() or 0

            result = await db.execute(select(func.count(Alerte.id)).where(Alerte.entreprise_id == entreprise_id, Alerte.niveau_gravite.in_(["elevee", "critique"]), Alerte.statut != "traite", Alerte.is_deleted == False))
            alertes_critiques = result.scalar_one_or_none() or 0

            ca_subq = (
                select(Contrat.chantier_id, func.coalesce(func.sum(Facture.montant_ttc), 0).label("ca"))
                .select_from(Facture)
                .join(Contrat, Facture.contrat_id == Contrat.id)
                .where(Facture.is_deleted == False)
                .group_by(Contrat.chantier_id)
                .subquery()
            )
            depense_subq = (
                select(Depense.chantier_id, func.coalesce(func.sum(Depense.montant), 0).label("depenses"))
                .where(Depense.is_deleted == False)
                .group_by(Depense.chantier_id)
                .subquery()
            )

            chantiers_result = await db.execute(
                select(
                    Chantier.id,
                    Chantier.nom,
                    func.coalesce(ca_subq.c.ca, 0).label("ca"),
                    func.coalesce(depense_subq.c.depenses, 0).label("depenses"),
                    Chantier.budget_prevu,
                )
                .outerjoin(ca_subq, ca_subq.c.chantier_id == Chantier.id)
                .outerjoin(depense_subq, depense_subq.c.chantier_id == Chantier.id)
                .where(Chantier.entreprise_id == entreprise_id, Chantier.is_deleted == False)
            )
            for row in chantiers_result.all():
                ca_chantier = float(row.ca or 0.0)
                depenses_chantier = float(row.depenses or 0.0)
                budget_prevu = float(row.budget_prevu or 0.0)
                marge = ca_chantier - depenses_chantier
                taux_marge = (marge / ca_chantier * 100) if ca_chantier > 0 else 0.0
                rentabilite_chantiers.append({
                    "id": row.id,
                    "nom": row.nom,
                    "ca": ca_chantier,
                    "depenses": depenses_chantier,
                    "budget_prevu": budget_prevu,
                    "marge": marge,
                    "taux_marge": round(taux_marge, 1),
                    "taux_avancement": round(taux_avancement_financier, 1),
                })

            if rentabilite_chantiers:
                rentabilite_chantiers.sort(key=lambda x: x["ca"], reverse=True)
                top_chantiers = rentabilite_chantiers[:5]

        if role_code in ("super_admin", "admin_entreprise", "directeur", "comptable"):
            depassement_result = await db.execute(
                select(func.count(Chantier.id)).where(
                    Chantier.entreprise_id == entreprise_id,
                    Chantier.is_deleted == False,
                    Chantier.budget_reel > Chantier.budget_prevu,
                )
            )
            depassements_budgetaires = depassement_result.scalar_one_or_none() or 0

            paiement_delay_result = await db.execute(
                select(func.avg(func.datediff(Paiement.date_paiement, Facture.date_echeance))).where(
                    Paiement.entreprise_id == entreprise_id,
                    Facture.entreprise_id == entreprise_id,
                    Paiement.is_deleted == False,
                    Facture.is_deleted == False,
                    Facture.statut == "payee",
                    Paiement.date_paiement.is_not(None),
                    Facture.date_echeance.is_not(None),
                )
            )
            delai_moyen_paiement = float(paiement_delay_result.scalar_one_or_none() or 0.0)

            client_outstanding_result = await db.execute(
                select(
                    Client.id,
                    Client.nom,
                    Client.entreprise,
                    func.coalesce(func.sum(Facture.montant_ttc - Facture.montant_paye), 0).label("encours"),
                )
                .outerjoin(Facture, Facture.client_id == Client.id)
                .where(
                    Client.entreprise_id == entreprise_id,
                    Client.is_deleted == False,
                    Facture.is_deleted == False,
                    Facture.statut.in_(["emis", "envoye", "partiellement_payee", "en_retard"]),
                )
                .group_by(Client.id, Client.nom, Client.entreprise)
            )
            for row in client_outstanding_result.all():
                encours = float(row.encours or 0.0)
                if encours > 0:
                    tresorerie_par_client.append({
                        "client_id": row.id,
                        "nom": row.nom,
                        "entreprise": row.entreprise,
                        "encours": encours,
                    })

            rapports_result = await db.execute(
                select(func.count(RapportFinancier.id)).where(RapportFinancier.entreprise_id == entreprise_id, RapportFinancier.is_deleted == False)
            )
            rapports_disponibles = rapports_result.scalar_one_or_none() or 0

        if role_code == "chef_chantier":
            chef_chantier_id = user_id
            # Initialiser les variables pour eviter UnboundLocalError
            nb_incidents = 0
            incidents_non_resolus = 0
            retard_jours = 0.0
            consommation_stock = 0.0
            ecart_stock = 0.0
            nb_alertes_chantier = 0
            taux_avancement_physique = 0.0
            taux_avancement_financier = 0.0

            if chef_chantier_id:
                mes_chantiers = select(Chantier.id).where(
                    Chantier.entreprise_id == entreprise_id,
                    Chantier.chef_chantier_id == chef_chantier_id,
                    Chantier.is_deleted == False,
                )
                nb_chantiers_actifs = (await db.execute(select(func.count()).select_from(mes_chantiers.subquery()))).scalar_one() or 0

                if nb_chantiers_actifs > 0:
                    avancement_result = await db.execute(
                        select(func.avg(Chantier.budget_reel / func.nullif(Chantier.budget_prevu, 0))).where(
                            Chantier.entreprise_id == entreprise_id,
                            Chantier.chef_chantier_id == chef_chantier_id,
                            Chantier.statut == "en_cours",
                            Chantier.is_deleted == False,
                            Chantier.budget_prevu > 0,
                        )
                    )
                    taux_avancement_financier = float(avancement_result.scalar_one_or_none() or 0.0) * 100
                    if taux_avancement_financier > 100:
                        taux_avancement_financier = 100.0

                    avancement_physique_result = await db.execute(
                        select(func.avg(Phase.avancement_pct)).where(
                            Phase.chantier_id.in_(select(Chantier.id).where(Chantier.entreprise_id == entreprise_id, Chantier.chef_chantier_id == chef_chantier_id, Chantier.is_deleted == False)),
                            Phase.is_deleted == False,
                        )
                    )
                    taux_avancement_physique = float(avancement_physique_result.scalar_one_or_none() or 0.0)
                    if taux_avancement_physique > 100:
                        taux_avancement_physique = 100.0

                    nb_incidents_result = await db.execute(
                        select(func.count(Incident.id)).where(
                            Incident.chantier_id.in_(select(Chantier.id).where(Chantier.entreprise_id == entreprise_id, Chantier.chef_chantier_id == chef_chantier_id, Chantier.is_deleted == False)),
                            Incident.is_deleted == False,
                        )
                    )
                    nb_incidents = nb_incidents_result.scalar_one_or_none() or 0

                    incidents_non_resolus_result = await db.execute(
                        select(func.count(Incident.id)).where(
                            Incident.chantier_id.in_(select(Chantier.id).where(Chantier.entreprise_id == entreprise_id, Chantier.chef_chantier_id == chef_chantier_id, Chantier.is_deleted == False)),
                            Incident.is_deleted == False,
                            Incident.statut.in_(["signale", "en_cours"]),
                        )
                    )
                    incidents_non_resolus = incidents_non_resolus_result.scalar_one_or_none() or 0

                    retard_jours_result = await db.execute(
                        select(func.avg(func.datediff(func.current_date(), Chantier.date_fin_prevue))).where(
                            Chantier.entreprise_id == entreprise_id,
                            Chantier.chef_chantier_id == chef_chantier_id,
                            Chantier.is_deleted == False,
                            Chantier.date_fin_prevue.is_not(None),
                            Chantier.statut.in_(["en_cours", "planification"]),
                        )
                    )
                    retard_jours = float(retard_jours_result.scalar_one_or_none() or 0.0)

                    pointages_result = await db.execute(
                        select(func.count(Pointage.id)).where(
                            Pointage.chantier_id.in_(select(Chantier.id).where(Chantier.entreprise_id == entreprise_id, Chantier.chef_chantier_id == chef_chantier_id, Chantier.is_deleted == False)),
                            Pointage.is_deleted == False,
                            Pointage.type == "present",
                        )
                    )
                    nb_presences = pointages_result.scalar_one_or_none() or 0

                    total_employes_result = await db.execute(
                        select(func.count(Employe.id)).where(
                            Employe.entreprise_id == entreprise_id,
                            Employe.is_deleted == False,
                        )
                    )
                    nb_employes_chantier = total_employes_result.scalar_one_or_none() or 0
                    attendance_rate = (nb_presences / nb_employes_chantier * 100) if nb_employes_chantier > 0 else 0.0

                    consommation_result = await db.execute(
                        select(func.coalesce(func.sum(MouvementStock.quantite), 0)).where(
                            MouvementStock.chantier_id.in_(select(Chantier.id).where(Chantier.entreprise_id == entreprise_id, Chantier.chef_chantier_id == chef_chantier_id, Chantier.is_deleted == False)),
                            MouvementStock.is_deleted == False,
                            MouvementStock.type_mouvement == "sortie",
                        )
                    )
                    consommation_stock = float(consommation_result.scalar_one_or_none() or 0.0)

                    stock_prevu_result = await db.execute(
                        select(func.coalesce(func.sum(Article.stock_mini), 0)).where(
                            Article.entreprise_id == entreprise_id,
                            Article.is_deleted == False,
                        )
                    )
                    stock_prevu = float(stock_prevu_result.scalar_one_or_none() or 0.0)
                    ecart_stock = stock_prevu - consommation_stock

                    nb_alertes_chantier_result = await db.execute(
                        select(func.count(Alerte.id)).where(
                            Alerte.entreprise_id == entreprise_id,
                            Alerte.is_deleted == False,
                            Alerte.statut != "traite",
                        )
                    )
                    nb_alertes_chantier = nb_alertes_chantier_result.scalar_one_or_none() or 0

                    chef_ca_subq = (
                        select(Contrat.chantier_id, func.coalesce(func.sum(Facture.montant_ttc), 0).label("ca"))
                        .select_from(Facture)
                        .join(Contrat, Facture.contrat_id == Contrat.id)
                        .where(Facture.is_deleted == False)
                        .group_by(Contrat.chantier_id)
                        .subquery()
                    )
                    chef_depense_subq = (
                        select(Depense.chantier_id, func.coalesce(func.sum(Depense.montant), 0).label("depenses"))
                        .where(Depense.is_deleted == False)
                        .group_by(Depense.chantier_id)
                        .subquery()
                    )

                    chantiers_result = await db.execute(
                        select(
                            Chantier.id,
                            Chantier.nom,
                            Chantier.numero,
                            Chantier.statut,
                            Chantier.budget_prevu,
                            Chantier.budget_reel,
                            Chantier.date_debut,
                            Chantier.date_fin_prevue,
                            func.coalesce(chef_ca_subq.c.ca, 0).label("ca"),
                            func.coalesce(chef_depense_subq.c.depenses, 0).label("depenses"),
                        )
                        .outerjoin(chef_ca_subq, chef_ca_subq.c.chantier_id == Chantier.id)
                        .outerjoin(chef_depense_subq, chef_depense_subq.c.chantier_id == Chantier.id)
                        .where(Chantier.entreprise_id == entreprise_id, Chantier.chef_chantier_id == chef_chantier_id, Chantier.is_deleted == False)
                    )
                    for row in chantiers_result.all():
                        ca_chantier = float(row.ca or 0.0)
                        depenses_chantier = float(row.depenses or 0.0)
                        budget_prevu = float(row.budget_prevu or 0.0)
                        budget_reel = float(row.budget_reel or 0.0)
                        marge = ca_chantier - depenses_chantier
                        taux_marge = (marge / ca_chantier * 100) if ca_chantier > 0 else 0.0
                        ecart_budget = budget_prevu - budget_reel
                        rentabilite_chantiers.append({
                            "id": row.id,
                            "nom": row.nom,
                            "numero": row.numero,
                            "statut": row.statut,
                            "ca": ca_chantier,
                            "depenses": depenses_chantier,
                            "budget_prevu": budget_prevu,
                            "budget_reel": budget_reel,
                            "marge": marge,
                            "taux_marge": round(taux_marge, 1),
                            "ecart_budget": round(ecart_budget, 2),
                            "date_debut": row.date_debut.isoformat() if row.date_debut else None,
                            "date_fin_prevue": row.date_fin_prevue.isoformat() if row.date_fin_prevue else None,
                        })

                    if rentabilite_chantiers:
                        rentabilite_chantiers.sort(key=lambda x: x["ca"], reverse=True)
                        top_chantiers = rentabilite_chantiers[:5]

        return {
            "ca_total": ca_total,
            "ca_mois": ca_total,
            "depenses_mois": depenses_mois,
            "margin_net": margin_net,
            "marge_brute": marge_brute,
            "marge_nette": marge_nette,
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
            "alertes_critiques": alertes_critiques,
            "nb_utilisateurs": nb_utilisateurs,
            "utilisateurs_inactifs": utilisateurs_inactifs,
            "uptime": uptime,
            "taux_avancement_physique": round(taux_avancement_physique, 1),
            "taux_avancement_financier": round(taux_avancement_financier, 1),
            "rentabilite_chantiers": rentabilite_chantiers,
            "depassements_budgetaires": depassements_budgetaires if role_code in ("super_admin", "admin_entreprise", "directeur", "comptable") else 0,
            "delai_moyen_paiement": delai_moyen_paiement if role_code in ("super_admin", "admin_entreprise", "directeur", "comptable") else 0.0,
            "tresorerie_par_client": tresorerie_par_client if role_code in ("super_admin", "admin_entreprise", "directeur", "comptable") else [],
            "rapports_disponibles": rapports_disponibles if role_code in ("super_admin", "admin_entreprise", "directeur", "comptable") else 0,
            "nb_incidents": nb_incidents if role_code == "chef_chantier" else 0,
            "incidents_non_resolus": incidents_non_resolus if role_code == "chef_chantier" else 0,
            "retard_jours": round(retard_jours, 1) if role_code == "chef_chantier" else 0.0,
            "consommation_stock": round(consommation_stock, 2) if role_code == "chef_chantier" else 0.0,
            "ecart_stock": round(ecart_stock, 2) if role_code == "chef_chantier" else 0.0,
            "nb_alertes_chantier": nb_alertes_chantier if role_code == "chef_chantier" else 0,
        }
