"""
URLs du module Chantiers.

Routes :
- /chantiers/                          → Liste des chantiers
- /chantiers/nouveau/                  → Créer un chantier
- /chantiers/<pk>/                     → Détail d'un chantier
- /chantiers/<pk>/modifier/            → Modifier un chantier
- /chantiers/<pk>/supprimer/           → Supprimer un chantier
- /chantiers/<pk>/phases/nouveau/      → Ajouter une phase
- /chantiers/<pk>/incidents/nouveau/   → Déclarer un incident
"""

from django.urls import path

from . import views

app_name = "chantiers"

urlpatterns = [
    path("", views.ChantierListView.as_view(), name="chantier_liste"),
    path("nouveau/", views.ChantierCreateView.as_view(), name="chantier_creer"),
    path("<int:pk>/", views.ChantierDetailView.as_view(), name="chantier_detail"),
    path("<int:pk>/modifier/", views.ChantierUpdateView.as_view(), name="chantier_modifier"),
    path("<int:pk>/supprimer/", views.ChantierDeleteView.as_view(), name="chantier_supprimer"),
    path("<int:pk>/phases/nouveau/", views.PhaseCreateView.as_view(), name="phase_creer"),
    path("<int:pk>/incidents/nouveau/", views.IncidentCreateView.as_view(), name="incident_creer"),
]
