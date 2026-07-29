"""
Formulaires du module Matériels.
"""

from django import forms

from .models import Materiel, Maintenance, AlerteMateriel
from accounts.forms import BootstrapFormMixin


class MaterielForm(BootstrapFormMixin, forms.ModelForm):
    """Formulaire de création/modification d'un matériel."""

    class Meta:
        model = Materiel
        fields = ["nom", "type", "numero_serie", "date_acquisition", "valeur_achat", "statut"]
        labels = {
            "numero_serie": "Numéro de série",
            "date_acquisition": "Date d'acquisition",
            "valeur_achat": "Valeur d'achat (Ar)",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bootstrapify()


class MaintenanceForm(BootstrapFormMixin, forms.ModelForm):
    """Formulaire de création d'une maintenance."""

    class Meta:
        model = Maintenance
        fields = ["type", "date_maintenance", "cout", "description", "prochaine_echeance"]
        labels = {
            "date_maintenance": "Date de maintenance",
            "prochaine_echeance": "Prochaine échéance",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bootstrapify()


class AlerteMaterielForm(BootstrapFormMixin, forms.ModelForm):
    """Formulaire de création d'une alerte."""

    class Meta:
        model = AlerteMateriel
        fields = ["type", "message", "date_alerte", "statut"]
        labels = {
            "date_alerte": "Date de l'alerte",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bootstrapify()
