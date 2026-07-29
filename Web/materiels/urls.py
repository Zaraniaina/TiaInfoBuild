"""
URLs du module Matériels.
"""

from django.urls import path

from . import views

app_name = "materiels"

urlpatterns = [
    path("", views.MaterielListView.as_view(), name="materiel_liste"),
    path("nouveau/", views.MaterielCreateView.as_view(), name="materiel_creer"),
    path("<int:pk>/", views.MaterielDetailView.as_view(), name="materiel_detail"),
    path("<int:pk>/modifier/", views.MaterielUpdateView.as_view(), name="materiel_modifier"),
    path("<int:pk>/supprimer/", views.MaterielDeleteView.as_view(), name="materiel_supprimer"),
    path("<int:pk>/maintenances/nouveau/", views.MaintenanceCreateView.as_view(), name="maintenance_creer"),
]
