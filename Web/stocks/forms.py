"""
Formulaires du module Stocks.
"""

from django import forms

from .models import Article, Fournisseur, MouvementStock
from accounts.forms import BootstrapFormMixin


class ArticleForm(BootstrapFormMixin, forms.ModelForm):
    """Formulaire de création/modification d'un article."""

    class Meta:
        model = Article
        fields = ["nom", "categorie", "unite", "seuil_alerte", "quantite_stock", "prix_unitaire"]
        labels = {
            "seuil_alerte": "Seuil d'alerte",
            "quantite_stock": "Quantité en stock",
            "prix_unitaire": "Prix unitaire (Ar)",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bootstrapify()


class FournisseurForm(BootstrapFormMixin, forms.ModelForm):
    """Formulaire de création/modification d'un fournisseur."""

    class Meta:
        model = Fournisseur
        fields = ["nom", "contact", "adresse", "telephone", "email"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bootstrapify()


class MouvementStockForm(BootstrapFormMixin, forms.ModelForm):
    """Formulaire de création d'un mouvement de stock."""

    class Meta:
        model = MouvementStock
        fields = ["article", "chantier", "fournisseur", "type_mouvement", "quantite", "date_mouvement", "motif", "prix_unitaire"]
        labels = {
            "type_mouvement": "Type",
            "date_mouvement": "Date",
            "prix_unitaire": "Prix unitaire (Ar)",
        }

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)
        self._bootstrapify()
        if self.user and self.user.entreprise:
            from chantiers.models import Chantier
            self.fields["article"].queryset = Article.objects.filter(entreprise=self.user.entreprise)
            self.fields["fournisseur"].queryset = Fournisseur.objects.filter(entreprise=self.user.entreprise)
            self.fields["chantier"].queryset = Chantier.objects.filter(entreprise=self.user.entreprise)
