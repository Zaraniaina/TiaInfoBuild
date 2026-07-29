"""
URLs du module Ressources Humaines.
"""

from django.urls import path

from . import views

app_name = "rh"

urlpatterns = [
    path("", views.EmployeListView.as_view(), name="employe_liste"),
    path("nouveau/", views.EmployeCreateView.as_view(), name="employe_creer"),
    path("<int:pk>/modifier/", views.EmployeUpdateView.as_view(), name="employe_modifier"),
    path("<int:pk>/supprimer/", views.EmployeDeleteView.as_view(), name="employe_supprimer"),
    path("equipes/", views.EquipeListView.as_view(), name="equipe_liste"),
    path("equipes/nouveau/", views.EquipeCreateView.as_view(), name="equipe_creer"),
    path("pointages/", views.PointageListView.as_view(), name="pointage_liste"),
    path("pointages/nouveau/", views.PointageCreateView.as_view(), name="pointage_creer"),
]
