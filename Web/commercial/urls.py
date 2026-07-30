"""
URLs du module Commercial.
"""

from django.urls import path

from . import views

app_name = "commercial"

urlpatterns = [
    path("clients/", views.ClientListView.as_view(), name="client_liste"),
    path("clients/nouveau/", views.ClientCreateView.as_view(), name="client_creer"),
    path("clients/<int:pk>/modifier/", views.ClientUpdateView.as_view(), name="client_modifier"),
    path("devis/", views.DevisListView.as_view(), name="devis_liste"),
    path("devis/nouveau/", views.DevisCreateView.as_view(), name="devis_creer"),
    path("devis/<int:pk>/", views.DevisDetailView.as_view(), name="devis_detail"),
    path("factures/", views.FactureListView.as_view(), name="facture_liste"),
    path("factures/nouveau/", views.FactureCreateView.as_view(), name="facture_creer"),
    path("paiements/nouveau/", views.PaiementCreateView.as_view(), name="paiement_creer"),
]
