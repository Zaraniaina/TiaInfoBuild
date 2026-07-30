"""
Formulaires du module Commercial.
"""

from django import forms

from .models import Client, Devis, LigneDevis, Contrat, Facture, Paiement
from accounts.forms import BootstrapFormMixin


class ClientForm(BootstrapFormMixin, forms.ModelForm):
    """Formulaire de création/modification d'un client."""

    class Meta:
        model = Client
        fields = ["type", "nom", "adresse", "telephone", "email"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bootstrapify()


class DevisForm(BootstrapFormMixin, forms.ModelForm):
    """Formulaire de création/modification d'un devis."""

    class Meta:
        model = Devis
        fields = ["client", "date_creation", "date_validite", "montant_total", "statut"]
        labels = {
            "date_creation": "Date de création",
            "date_validite": "Date de validité",
            "montant_total": "Montant total (Ar)",
        }

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)
        self._bootstrapify()
        if self.user and self.user.entreprise:
            self.fields["client"].queryset = Client.objects.filter(entreprise=self.user.entreprise)


class LigneDevisForm(BootstrapFormMixin, forms.ModelForm):
    """Formulaire de création d'une ligne de devis."""

    class Meta:
        model = LigneDevis
        fields = ["description", "quantite", "prix_unitaire"]
        labels = {
            "prix_unitaire": "Prix unitaire (Ar)",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bootstrapify()


class FactureForm(BootstrapFormMixin, forms.ModelForm):
    """Formulaire de création d'une facture."""

    class Meta:
        model = Facture
        fields = ["contrat", "date_emission", "date_echeance", "montant", "statut"]
        labels = {
            "date_emission": "Date d'émission",
            "date_echeance": "Date d'échéance",
            "montant": "Montant (Ar)",
        }

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)
        self._bootstrapify()
        if self.user and self.user.entreprise:
            self.fields["contrat"].queryset = Contrat.objects.filter(entreprise=self.user.entreprise)


class PaiementForm(BootstrapFormMixin, forms.ModelForm):
    """Formulaire de création d'un paiement."""

    class Meta:
        model = Paiement
        fields = ["facture", "date_paiement", "montant", "mode_paiement"]
        labels = {
            "date_paiement": "Date de paiement",
            "montant": "Montant (Ar)",
            "mode_paiement": "Mode de paiement",
        }

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)
        self._bootstrapify()
        if self.user and self.user.entreprise:
            self.fields["facture"].queryset = Facture.objects.filter(entreprise=self.user.entreprise)
