"""
Formulaires du module Chantiers.
"""

from django import forms

from .models import Chantier, Phase, Incident
from accounts.forms import BootstrapFormMixin


class ChantierForm(BootstrapFormMixin, forms.ModelForm):
    """Formulaire de création/modification d'un chantier."""

    class Meta:
        model = Chantier
        fields = [
            "nom", "adresse", "description", "client", "chef_chantier",
            "date_debut", "date_fin_prevue", "date_fin_reelle",
            "budget_prevu", "budget_reel", "statut",
        ]
        labels = {
            "nom": "Nom du chantier",
            "date_fin_prevue": "Date de fin prévue",
            "date_fin_reelle": "Date de fin réelle",
            "budget_prevu": "Budget prévu (Ar)",
            "budget_reel": "Budget réel (Ar)",
        }

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)
        self._bootstrapify()
        # Filtrer les clients et chefs de chantier par entreprise
        if self.user and self.user.entreprise:
            self.fields["client"].queryset = Chantier._meta.get_field("client").related_model.objects.filter(
                entreprise=self.user.entreprise
            )
            self.fields["chef_chantier"].queryset = Chantier._meta.get_field("chef_chantier").related_model.objects.filter(
                entreprise=self.user.entreprise
            )


class PhaseForm(BootstrapFormMixin, forms.ModelForm):
    """Formulaire de création/modification d'une phase."""

    class Meta:
        model = Phase
        fields = ["nom", "description", "date_debut", "date_fin", "avancement_pct", "ordre", "statut"]
        labels = {
            "avancement_pct": "Avancement (%)",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bootstrapify()


class IncidentForm(BootstrapFormMixin, forms.ModelForm):
    """Formulaire de création/modification d'un incident."""

    class Meta:
        model = Incident
        fields = ["titre", "description", "date_incident", "gravite", "statut"]
        labels = {
            "date_incident": "Date de l'incident",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bootstrapify()
