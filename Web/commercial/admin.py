"""
Administration Django pour le module Commercial.
"""

from django.contrib import admin

from .models import Client, Devis, LigneDevis, Contrat, Facture, Paiement


class LigneDevisInline(admin.TabularInline):
    model = LigneDevis
    extra = 1
    fields = ("description", "quantite", "prix_unitaire")


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("nom", "type", "entreprise", "telephone", "email")
    list_filter = ("type", "entreprise")
    search_fields = ("nom", "email")
    list_select_related = ("entreprise",)


@admin.register(Devis)
class DevisAdmin(admin.ModelAdmin):
    list_display = ("id", "client", "entreprise", "date_creation", "montant_total", "statut")
    list_filter = ("statut", "entreprise", "date_creation")
    search_fields = ("client__nom",)
    list_select_related = ("entreprise", "client")
    inlines = [LigneDevisInline]


@admin.register(Contrat)
class ContratAdmin(admin.ModelAdmin):
    list_display = ("id", "devis", "entreprise", "date_signature", "montant", "statut")
    list_filter = ("statut", "entreprise")
    list_select_related = ("entreprise", "devis", "chantier")


@admin.register(Facture)
class FactureAdmin(admin.ModelAdmin):
    list_display = ("id", "contrat", "entreprise", "date_emission", "montant", "statut")
    list_filter = ("statut", "entreprise", "date_emission")
    list_select_related = ("entreprise", "contrat")


@admin.register(Paiement)
class PaiementAdmin(admin.ModelAdmin):
    list_display = ("facture", "date_paiement", "montant", "mode_paiement")
    list_filter = ("mode_paiement", "date_paiement")
    list_select_related = ("facture",)
