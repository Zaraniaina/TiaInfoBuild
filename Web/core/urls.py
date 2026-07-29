"""
URLs de l'application core.

Routes :
- /                          → Dashboard entreprise (utilisateurs liés à une entreprise)
- /super-admin/              → Dashboard super-administrateur (plateforme)
- /entreprises/              → Liste des entreprises (super-admin)
- /entreprises/<pk>/         → Détail d'une entreprise (super-admin)
- /entreprises/<pk>/statut/  → Activer / désactiver une entreprise (super-admin)
- /entreprises/<pk>/abonnement/ → Changer le plan d'abonnement (super-admin)
"""

from django.urls import path

from . import views

app_name = "core"

urlpatterns = [
    # Dashboard entreprise (utilisateurs liés à une entreprise)
    path("", views.DashboardView.as_view(), name="dashboard"),

    # Dashboard super-administrateur (gestion de la plateforme)
    path("super-admin/", views.SuperAdminDashboardView.as_view(), name="super_admin_dashboard"),

    # Gestion des entreprises (super-admin)
    path("entreprises/", views.EntrepriseListView.as_view(), name="entreprise_liste"),
    path("entreprises/<int:pk>/", views.EntrepriseDetailView.as_view(), name="entreprise_detail"),
    path("entreprises/<int:pk>/statut/", views.EntrepriseToggleStatutView.as_view(), name="entreprise_statut"),
    path("entreprises/<int:pk>/abonnement/", views.EntrepriseAbonnementView.as_view(), name="entreprise_abonnement"),
]
