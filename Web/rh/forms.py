
"""
Formulaires du module Ressources Humaines.
"""

from django import forms

from .models import Employe, Equipe, MembreEquipe, Pointage
from accounts.forms import BootstrapFormMixin


class EmployeForm(BootstrapFormMixin, forms.ModelForm):
    """Formulaire de création/modification d'un employé."""

    class Meta:
        model = Employe
        fields = ["matricule", "nom", "prenom", "poste", "date_embauche", "salaire_base", "telephone", "adresse", "statut"]
        labels = {
            "salaire_base": "Salaire de base (Ar)",
            "date_embauche": "Date d'embauche",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bootstrapify()


class EquipeForm(BootstrapFormMixin, forms.ModelForm):
    """Formulaire de création/modification d'une équipe."""

    class Meta:
        model = Equipe
        fields = ["nom", "description", "chef_equipe"]
        labels = {
            "chef_equipe": "Chef d'équipe",
        }

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)
        self._bootstrapify()
        if self.user and self.user.entreprise:
            self.fields["chef_equipe"].queryset = Employe.objects.filter(entreprise=self.user.entreprise)


class PointageForm(BootstrapFormMixin, forms.ModelForm):
    """Formulaire de pointage quotidien."""

    class Meta:
        model = Pointage
        fields = ["employe", "chantier", "date_jour", "heure_arrivee", "heure_depart", "statut", "remarque"]
        labels = {
            "date_jour": "Date",
            "heure_arrivee": "Heure d'arrivée",
            "heure_depart": "Heure de départ",
        }

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)
        self._bootstrapify()
        if self.user and self.user.entreprise:
            from chantiers.models import Chantier
            self.fields["employe"].queryset = Employe.objects.filter(entreprise=self.user.entreprise)
            self.fields["chantier"].queryset = Chantier.objects.filter(entreprise=self.user.entreprise)
