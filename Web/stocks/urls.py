"""
URLs du module Stocks.
"""

from django.urls import path

from . import views

app_name = "stocks"

urlpatterns = [
    path("", views.ArticleListView.as_view(), name="article_liste"),
    path("nouveau/", views.ArticleCreateView.as_view(), name="article_creer"),
    path("<int:pk>/modifier/", views.ArticleUpdateView.as_view(), name="article_modifier"),
    path("fournisseurs/", views.FournisseurListView.as_view(), name="fournisseur_liste"),
    path("fournisseurs/nouveau/", views.FournisseurCreateView.as_view(), name="fournisseur_creer"),
    path("mouvements/", views.MouvementStockListView.as_view(), name="mouvement_liste"),
    path("mouvements/nouveau/", views.MouvementStockCreateView.as_view(), name="mouvement_creer"),
]
