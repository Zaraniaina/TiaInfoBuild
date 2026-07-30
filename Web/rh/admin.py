"""
Administration Django pour le module Ressources Humaines.
"""

from django.contrib import admin

from .models import Employe, Equipe, MembreEquipe, Pointage


@admin.register(Employe)
class EmployeAdmin(admin.ModelAdmin):
    list_display = ("matricule", "nom_complet", "poste", "entreprise", "statut", "date_embauche")
    list_filter = ("statut", "entreprise", "date_embauche")
    search_fields = ("matricule", "nom", "prenom")
    list_select_related = ("entreprise",)


@admin.register(Equipe)
class EquipeAdmin(admin.ModelAdmin):
    list_display = ("nom", "entreprise", "chef_equipe")
    list_filter = ("entreprise",)
    search_fields = ("nom",)
    list_select_related = ("entreprise", "chef_equipe")


@admin.register(MembreEquipe)
class MembreEquipeAdmin(admin.ModelAdmin):
    list_display = ("employe", "equipe", "date_affectation")
    list_filter = ("equipe__entreprise",)
    list_select_related = ("employe", "equipe")


@admin.register(Pointage)
class PointageAdmin(admin.ModelAdmin):
    list_display = ("employe", "date_jour", "heure_arrivee", "heure_depart", "statut")
    list_filter = ("statut", "date_jour", "employe__entreprise")
    search_fields = ("employe__nom", "employe__prenom")
    list_select_related = ("employe",)
