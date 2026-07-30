"""
Vues de l'application core (tableau de bord).

Contient :
- DashboardView : tableau de bord entreprise (pour les utilisateurs liés à une entreprise)
- SuperAdminDashboardView : tableau de bord plateforme (pour le super-administrateur)
- EntrepriseListView : liste des entreprises (super-admin)
- EntrepriseDetailView : détail d'une entreprise (super-admin)
- EntrepriseToggleStatutView : activer / désactiver une entreprise (super-admin)
- EntrepriseAbonnementView : changer le plan d'abonnement d'une entreprise (super-admin)
"""

from django.contrib import messages
from django.contrib.auth import get_user_model
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.db.models import Count, Q, Sum
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.views import View
from django.views.generic import ListView, DetailView

from accounts.models import Entreprise, Role, Utilisateur

Utilisateur = get_user_model()


# ─────────────────────────────────────────────────────────────────────────────
# Mixins d'autorisation
# ─────────────────────────────────────────────────────────────────────────────

class SuperAdminRequiredMixin(LoginRequiredMixin, UserPassesTestMixin):
    """
    Réservé au super-administrateur de la plateforme (is_superuser=True).

    Le super-admin gère l'ensemble du SaaS : toutes les entreprises, tous les
    utilisateurs, les abonnements, etc. Il n'est rattaché à aucune entreprise
    (request.entreprise = None).
    """

    login_url = reverse_lazy("accounts:login")

    def test_func(self):
        return self.request.user.is_superuser

    def handle_no_permission(self):
        if self.request.user.is_authenticated:
            messages.error(self.request, "Accès réservé au super-administrateur.")
            return redirect("core:dashboard")
        return super().handle_no_permission()


class EntrepriseRequiredMixin(LoginRequiredMixin):
    """
    Réservé aux utilisateurs liés à une entreprise.

    Redirige vers le super-admin si l'utilisateur n'a pas d'entreprise
    (cas du super-admin qui accède par erreur à une vue entreprise).
    """

    login_url = reverse_lazy("accounts:login")

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()
        if request.user.is_superuser:
            # Le super-admin n'a pas d'entreprise → rediriger vers son dashboard
            return redirect("core:super_admin_dashboard")
        if not getattr(request, "entreprise", None):
            messages.error(request, "Aucune entreprise liée à votre compte.")
            return redirect("accounts:login")
        return super().dispatch(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard entreprise (utilisateurs liés à une entreprise)
# ─────────────────────────────────────────────────────────────────────────────

class DashboardView(EntrepriseRequiredMixin, View):
    """
    Tableau de bord de l'entreprise.

    Affiche des KPIs en temps réel basés sur les données de l'entreprise
    rattachée à l'utilisateur connecté :
    - Nombre d'utilisateurs actifs
    - Nombre de chantiers actifs
    - Nombre d'employés
    - Nombre de matériels
    - Nombre d'articles en stock (et alertes de seuil)
    - Nombre de clients
    - Nombre de devis en cours
    """

    template_name = "core/dashboard.html"

    def get(self, request):
        entreprise = request.entreprise

        # Comptage des utilisateurs actifs de l'entreprise
        total_utilisateurs = Utilisateur.objects.filter(
            entreprise=entreprise, statut="actif"
        ).count()

        # Comptage des chantiers actifs (module Chantiers)
        try:
            from chantiers.models import Chantier
            chantiers_actifs = Chantier.objects.filter(
                entreprise=entreprise,
                statut="actif"
            ).count()
            chantiers_total = Chantier.objects.filter(
                entreprise=entreprise
            ).count()
        except Exception:
            chantiers_actifs = 0
            chantiers_total = 0

        # Comptage des employés (module RH)
        try:
            from rh.models import Employe
            total_employes = Employe.objects.filter(
                entreprise=entreprise
            ).count()
        except Exception:
            total_employes = 0

        # Comptage des matériels (module Matériels)
        try:
            from materiels.models import Materiel
            total_materiels = Materiel.objects.filter(
                entreprise=entreprise
            ).count()
            materiels_en_panne = Materiel.objects.filter(
                entreprise=entreprise, statut="en_panne"
            ).count()
        except Exception:
            total_materiels = 0
            materiels_en_panne = 0

        # Comptage des articles en stock + alertes (module Stocks)
        # Une alerte est déclenchée quand la quantité en stock est inférieure
        # ou égale au seuil d'alerte défini sur chaque article.
        try:
            from stocks.models import Article
            from django.db.models import F
            total_articles = Article.objects.filter(
                entreprise=entreprise
            ).count()
            articles_en_alerte = Article.objects.filter(
                entreprise=entreprise,
                quantite_stock__lte=F("seuil_alerte")
            ).count()
        except Exception:
            total_articles = 0
            articles_en_alerte = 0

        # Comptage des clients (module Commercial)
        try:
            from commercial.models import Client
            total_clients = Client.objects.filter(
                entreprise=entreprise
            ).count()
        except Exception:
            total_clients = 0

        # Comptage des devis en cours (module Commercial)
        try:
            from commercial.models import Devis
            devis_en_cours = Devis.objects.filter(
                entreprise=entreprise, statut="en_cours"
            ).count()
        except Exception:
            devis_en_cours = 0

        # Calcul du budget total des chantiers
        try:
            from chantiers.models import Chantier
            budget_total = Chantier.objects.filter(
                entreprise=entreprise
            ).aggregate(total=Sum("budget_prevu"))["total"] or 0
        except Exception:
            budget_total = 0

        # Nombre total d'alertes (matériel en panne + stock bas)
        total_alertes = materiels_en_panne + articles_en_alerte

        context = {
            "page_titre": "Tableau de bord",
            "entreprise": entreprise,
            "total_utilisateurs": total_utilisateurs,
            "chantiers_actifs": chantiers_actifs,
            "chantiers_total": chantiers_total,
            "total_employes": total_employes,
            "total_materiels": total_materiels,
            "materiels_en_panne": materiels_en_panne,
            "total_articles": total_articles,
            "articles_en_alerte": articles_en_alerte,
            "total_clients": total_clients,
            "devis_en_cours": devis_en_cours,
            "budget_total": budget_total,
            "total_alertes": total_alertes,
        }
        return render(request, self.template_name, context)


# ─────────────────────────────────────────────────────────────────────────────
# Super Admin Dashboard (gestion de la plateforme)
# ─────────────────────────────────────────────────────────────────────────────

class SuperAdminDashboardView(SuperAdminRequiredMixin, View):
    """
    Tableau de bord du super-administrateur.

    Présente un aperçu global de la plateforme :
    - Nombre total d'entreprises (par statut et par abonnement)
    - Nombre total d'utilisateurs
    - Nombre d'utilisateurs par rôle
    - Dernières entreprises créées
    - Alertes éventuelles
    """

    template_name = "core/super_admin_dashboard.html"

    def get(self, request):
        # Statistiques des entreprises
        total_entreprises = Entreprise.objects.count()
        entreprises_actives = Entreprise.objects.filter(est_active=True).count()
        entreprises_inactives = Entreprise.objects.filter(est_active=False).count()

        # Répartition par abonnement
        abonnement_stats = Entreprise.objects.values("abonnement").annotate(
            count=Count("id")
        ).order_by("abonnement")

        # Statistiques des utilisateurs
        total_utilisateurs = Utilisateur.objects.count()
        utilisateurs_actifs = Utilisateur.objects.filter(statut="actif").count()
        utilisateurs_inactifs = Utilisateur.objects.filter(statut="inactif").count()

        # Utilisateurs par rôle
        utilisateurs_par_role = Utilisateur.objects.select_related("role").values(
            "role__nom"
        ).annotate(count=Count("id")).order_by("-count")

        # Dernières entreprises créées (5)
        dernieres_entreprises = Entreprise.objects.order_by("-date_creation")[:5]

        # Derniers utilisateurs créés (5)
        derniers_utilisateurs = Utilisateur.objects.select_related(
            "entreprise", "role"
        ).order_by("-date_creation")[:5]

        context = {
            "page_titre": "Administration de la plateforme",
            "total_entreprises": total_entreprises,
            "entreprises_actives": entreprises_actives,
            "entreprises_inactives": entreprises_inactives,
            "abonnement_stats": abonnement_stats,
            "total_utilisateurs": total_utilisateurs,
            "utilisateurs_actifs": utilisateurs_actifs,
            "utilisateurs_inactifs": utilisateurs_inactifs,
            "utilisateurs_par_role": utilisateurs_par_role,
            "dernieres_entreprises": dernieres_entreprises,
            "derniers_utilisateurs": derniers_utilisateurs,
        }
        return render(request, self.template_name, context)


# ─────────────────────────────────────────────────────────────────────────────
# Gestion des entreprises (Super Admin)
# ─────────────────────────────────────────────────────────────────────────────

class EntrepriseListView(SuperAdminRequiredMixin, ListView):
    """
    Liste de toutes les entreprises de la plateforme.

    Permet de rechercher par nom, filtrer par abonnement / statut,
    et d'accéder au détail de chaque entreprise.
    """

    model = Entreprise
    template_name = "core/entreprise_list.html"
    context_object_name = "entreprises"
    paginate_by = 15

    def get_queryset(self):
        qs = Entreprise.objects.all()

        # Recherche par nom ou email
        recherche = self.request.GET.get("q", "")
        if recherche:
            qs = qs.filter(Q(nom__icontains=recherche) | Q(email__icontains=recherche))

        # Filtre par abonnement
        abonnement = self.request.GET.get("abonnement", "")
        if abonnement:
            qs = qs.filter(abonnement=abonnement)

        # Filtre par statut
        statut = self.request.GET.get("statut", "")
        if statut == "active":
            qs = qs.filter(est_active=True)
        elif statut == "inactive":
            qs = qs.filter(est_active=False)

        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["recherche"] = self.request.GET.get("q", "")
        ctx["abonnement_filtre"] = self.request.GET.get("abonnement", "")
        ctx["statut_filtre"] = self.request.GET.get("statut", "")
        ctx["total_entreprises"] = self.get_queryset().count()
        return ctx


class EntrepriseDetailView(SuperAdminRequiredMixin, DetailView):
    """
    Détail d'une entreprise : informations, utilisateurs, statistiques.

    Le super-admin peut voir l'ensemble des données d'une entreprise
    sans être rattaché à celle-ci.
    """

    model = Entreprise
    template_name = "core/entreprise_detail.html"
    context_object_name = "entreprise"
    pk_url_kwarg = "pk"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        entreprise = self.object

        # Utilisateurs de l'entreprise
        utilisateurs = Utilisateur.objects.filter(
            entreprise=entreprise
        ).select_related("role").order_by("-date_creation")
        ctx["utilisateurs"] = utilisateurs
        ctx["total_utilisateurs"] = utilisateurs.count()
        ctx["utilisateurs_actifs"] = utilisateurs.filter(statut="actif").count()

        # Statistiques BTP (si les modules existent)
        try:
            from chantiers.models import Chantier
            ctx["chantiers"] = Chantier.objects.filter(
                entreprise=entreprise
            ).order_by("-date_creation")[:5]
            ctx["total_chantiers"] = Chantier.objects.filter(
                entreprise=entreprise
            ).count()
            ctx["chantiers_actifs"] = Chantier.objects.filter(
                entreprise=entreprise, statut="actif"
            ).count()
        except Exception:
            ctx["chantiers"] = []
            ctx["total_chantiers"] = 0
            ctx["chantiers_actifs"] = 0

        try:
            from rh.models import Employe
            ctx["total_employes"] = Employe.objects.filter(
                entreprise=entreprise
            ).count()
        except Exception:
            ctx["total_employes"] = 0

        try:
            from materiels.models import Materiel
            ctx["total_materiels"] = Materiel.objects.filter(
                entreprise=entreprise
            ).count()
        except Exception:
            ctx["total_materiels"] = 0

        try:
            from stocks.models import Article
            ctx["total_articles"] = Article.objects.filter(
                entreprise=entreprise
            ).count()
        except Exception:
            ctx["total_articles"] = 0

        try:
            from commercial.models import Client
            ctx["total_clients"] = Client.objects.filter(
                entreprise=entreprise
            ).count()
        except Exception:
            ctx["total_clients"] = 0

        return ctx


class EntrepriseToggleStatutView(SuperAdminRequiredMixin, View):
    """
    Activer ou désactiver une entreprise.

    Une entreprise désactivée ne peut plus se connecter.
    """

    def post(self, request, pk):
        entreprise = get_object_or_404(Entreprise, pk=pk)
        entreprise.est_active = not entreprise.est_active
        entreprise.save(update_fields=["est_active"])

        action = "activée" if entreprise.est_active else "désactivée"
        messages.success(
            request,
            f"L'entreprise « {entreprise.nom} » a été {action}."
        )
        return redirect("core:entreprise_liste")


class EntrepriseAbonnementView(SuperAdminRequiredMixin, View):
    """
    Changer le plan d'abonnement d'une entreprise.

    Plans disponibles : essai, standard, premium.
    """

    PLAN_CHOICES = ["essai", "standard", "premium"]

    def post(self, request, pk):
        entreprise = get_object_or_404(Entreprise, pk=pk)
        nouveau_plan = request.POST.get("abonnement", "")

        if nouveau_plan not in self.PLAN_CHOICES:
            messages.error(request, "Plan d'abonnement invalide.")
            return redirect("core:entreprise_detail", pk=pk)

        ancien_plan = entreprise.get_abonnement_display()
        entreprise.abonnement = nouveau_plan
        entreprise.save(update_fields=["abonnement"])

        messages.success(
            request,
            f"Abonnement de « {entreprise.nom} » changé : "
            f"{ancien_plan} → {entreprise.get_abonnement_display()}."
        )
        return redirect("core:entreprise_detail", pk=pk)
