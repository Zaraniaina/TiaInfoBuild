"""
Administration Django pour le module Matériels.
"""

from django.contrib import admin

from .models import Materiel, AffectationMateriel, Maintenance, AlerteMateriel


class MaintenanceInline(admin.TabularInline):
    model = Maintenance
    extra = 0
    fields = ("type", "date_maintenance", "cout", "prochaine_echeance")


class AlerteInline(admin.TabularInline):
    model = AlerteMateriel
    extra = 0
    fields = ("type", "message", "statut", "date_alerte")


@admin.register(Materiel)
class MaterielAdmin(admin.ModelAdmin):
    list_display = ("nom", "type", "numero_serie", "entreprise", "statut", "valeur_achat")
    list_filter = ("statut", "entreprise", "type")
    search_fields = ("nom", "numero_serie")
    list_select_related = ("entreprise",)
    inlines = [MaintenanceInline, AlerteInline]


@admin.register(AffectationMateriel)
class AffectationMaterielAdmin(admin.ModelAdmin):
    list_display = ("materiel", "chantier", "date_debut", "date_fin")
    list_filter = ("materiel__entreprise",)
    list_select_related = ("materiel", "chantier")


@admin.register(Maintenance)
class MaintenanceAdmin(admin.ModelAdmin):
    list_display = ("materiel", "type", "date_maintenance", "cout")
    list_filter = ("type", "materiel__entreprise")
    list_select_related = ("materiel",)


@admin.register(AlerteMateriel)
class AlerteMaterielAdmin(admin.ModelAdmin):
    list_display = ("materiel", "type", "statut", "date_alerte")
    list_filter = ("type", "statut", "materiel__entreprise")
    list_select_related = ("materiel",)
