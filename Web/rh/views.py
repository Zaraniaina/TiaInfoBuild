"""
Vues du module Ressources Humaines.
"""

from django.contrib import messages
from django.urls import reverse_lazy
from django.views.generic import ListView, CreateView, UpdateView, DeleteView

from core.views import EntrepriseRequiredMixin
from .models import Employe, Equipe, Pointage
from .forms import EmployeForm, EquipeForm, PointageForm


class EmployeListView(EntrepriseRequiredMixin, ListView):
    model = Employe
    template_name = "rh/employe_list.html"
    context_object_name = "employes"
    paginate_by = 15

    def get_queryset(self):
        return Employe.objects.filter(entreprise=self.request.entreprise).order_by("nom", "prenom")


class EmployeCreateView(EntrepriseRequiredMixin, CreateView):
    model = Employe
    form_class = EmployeForm
    template_name = "rh/employe_form.html"
    success_url = reverse_lazy("rh:employe_liste")

    def form_valid(self, form):
        form.instance.entreprise = self.request.entreprise
        messages.success(self.request, f"L'employé {form.instance.nom_complet} a été créé.")
        return super().form_valid(form)


class EmployeUpdateView(EntrepriseRequiredMixin, UpdateView):
    model = Employe
    form_class = EmployeForm
    template_name = "rh/employe_form.html"
    success_url = reverse_lazy("rh:employe_liste")

    def get_queryset(self):
        return Employe.objects.filter(entreprise=self.request.entreprise)

    def form_valid(self, form):
        messages.success(self.request, f"L'employé {form.instance.nom_complet} a été mis à jour.")
        return super().form_valid(form)


class EmployeDeleteView(EntrepriseRequiredMixin, DeleteView):
    model = Employe
    template_name = "rh/employe_confirm_delete.html"
    success_url = reverse_lazy("rh:employe_liste")

    def get_queryset(self):
        return Employe.objects.filter(entreprise=self.request.entreprise)


class EquipeListView(EntrepriseRequiredMixin, ListView):
    model = Equipe
    template_name = "rh/equipe_list.html"
    context_object_name = "equipes"

    def get_queryset(self):
        return Equipe.objects.filter(entreprise=self.request.entreprise).order_by("nom")


class EquipeCreateView(EntrepriseRequiredMixin, CreateView):
    model = Equipe
    form_class = EquipeForm
    template_name = "rh/equipe_form.html"
    success_url = reverse_lazy("rh:equipe_liste")

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["user"] = self.request.user
        return kwargs

    def form_valid(self, form):
        form.instance.entreprise = self.request.entreprise
        messages.success(self.request, f"L'équipe {form.instance.nom} a été créée.")
        return super().form_valid(form)


class PointageListView(EntrepriseRequiredMixin, ListView):
    model = Pointage
    template_name = "rh/pointage_list.html"
    context_object_name = "pointages"
    paginate_by = 20

    def get_queryset(self):
        return Pointage.objects.filter(
            employe__entreprise=self.request.entreprise
        ).select_related("employe", "chantier").order_by("-date_jour")


class PointageCreateView(EntrepriseRequiredMixin, CreateView):
    model = Pointage
    form_class = PointageForm
    template_name = "rh/pointage_form.html"
    success_url = reverse_lazy("rh:pointage_liste")

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["user"] = self.request.user
        return kwargs
