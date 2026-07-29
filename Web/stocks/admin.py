"""
Administration Django pour le module Stocks.
"""

from django.contrib import admin

from .models import Article, Fournisseur, MouvementStock


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ("nom", "categorie", "quantite_stock", "unite", "seuil_alerte", "entreprise")
    list_filter = ("categorie", "entreprise")
    search_fields = ("nom", "categorie")
    list_select_related = ("entreprise",)


@admin.register(Fournisseur)
class FournisseurAdmin(admin.ModelAdmin):
    list_display = ("nom", "entreprise", "contact", "telephone")
    list_filter = ("entreprise",)
    search_fields = ("nom", "contact")
    list_select_related = ("entreprise",)


@admin.register(MouvementStock)
class MouvementStockAdmin(admin.ModelAdmin):
    list_display = ("article", "type_mouvement", "quantite", "date_mouvement", "chantier")
    list_filter = ("type_mouvement", "date_mouvement", "article__entreprise")
    search_fields = ("article__nom", "motif")
    list_select_related = ("article", "chantier", "fournisseur")
