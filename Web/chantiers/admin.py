"""
Administration Django pour le module Chantiers.

Permet de gérer les chantiers, phases et incidents depuis l'admin Django.
"""

from django.contrib import admin

from .models import Chantier, Phase, Incident


class PhaseInline(admin.TabularInline):
    """Phases affichées en ligne dans la fiche d'un chantier."""
    model = Phase
    extra = 0
    fields = ("nom", "date_debut", "date_fin", "avancement_pct", "statut", "ordre")
    ordering = ("ordre",)


class IncidentInline(admin.TabularInline):
    """Incidents affichés en ligne dans la fiche d'un chantier."""
    model = Incident
    extra = 0
    fields = ("titre", "gravite", "statut", "date_incident")
    readonly_fields = ("date_incident",)
    ordering = ("-date_creation",)


@admin.register(Chantier)
class ChantierAdmin(admin.ModelAdmin):
    list_display = ("nom", "entreprise", "client", "chef_chantier", "statut", "budget_prevu", "date_debut")
    list_filter = ("statut", "entreprise", "date_creation")
    search_fields = ("nom", "adresse")
    list_select_related = ("entreprise", "client", "chef_chantier")
    inlines = [PhaseInline, IncidentInline]
    fieldsets = (
        (None, {"fields": ("entreprise", "nom", "adresse", "description")}),
        ("Planification", {"fields": ("client", "chef_chantier", "date_debut", "date_fin_prevue", "date_fin_reelle")}),
        ("Finances", {"fields": ("budget_prevu", "budget_reel")}),
        ("Statut", {"fields": ("statut",)}),
    )


@admin.register(Phase)
class PhaseAdmin(admin.ModelAdmin):
    list_display = ("nom", "chantier", "ordre", "avancement_pct", "statut")
    list_filter = ("statut", "chantier__entreprise")
    search_fields = ("nom", "chantier__nom")
    list_select_related = ("chantier",)


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ("titre", "chantier", "gravite", "statut", "date_incident")
    list_filter = ("gravite", "statut", "chantier__entreprise", "date_incident")
    search_fields = ("titre", "description")
    list_select_related = ("chantier", "declare_par")
