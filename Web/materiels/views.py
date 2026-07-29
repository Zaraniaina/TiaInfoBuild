"""
Vues du module Matériels.
"""

from django.contrib import messages
from django.urls import reverse_lazy
from django.views.generic import ListView, CreateView, UpdateView, DeleteView, DetailView

from core.views import EntrepriseRequiredMixin
from .models import Materiel, Maintenance
from .forms import MaterielForm, MaintenanceForm


class MaterielListView(EntrepriseRequiredMixin, ListView):
    model = Materiel
    template_name = "materiels/materiel_list.html"
    context_object_name = "materiels"
    paginate_by = 15

    def get_queryset(self):
        return Materiel.objects.filter(entreprise=self.request.entreprise).order_by("nom")


class MaterielDetailView(EntrepriseRequiredMixin, DetailView):
    model = Materiel
    template_name = "materiels/materiel_detail.html"
    context_object_name = "materiel"

    def get_queryset(self):
        return Materiel.objects.filter(entreprise=self.request.entreprise)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["maintenances"] = self.object.maintenances.all().order_by("-date_maintenance")
        ctx["alertes"] = self.object.alertes.filter(statut__in=["ouverte", "en_cours"]).order_by("-date_alerte")
        return ctx


class MaterielCreateView(EntrepriseRequiredMixin, CreateView):
    model = Materiel
    form_class = MaterielForm
    template_name = "materiels/materiel_form.html"
    success_url = reverse_lazy("materiels:materiel_liste")

    def form_valid(self, form):
        form.instance.entreprise = self.request.entreprise
        messages.success(self.request, f"Le matériel {form.instance.nom} a été créé.")
        return super().form_valid(form)


class MaterielUpdateView(EntrepriseRequiredMixin, UpdateView):
    model = Materiel
    form_class = MaterielForm
    template_name = "materiels/materiel_form.html"
    success_url = reverse_lazy("materiels:materiel_liste")

    def get_queryset(self):
        return Materiel.objects.filter(entreprise=self.request.entreprise)

    def form_valid(self, form):
        messages.success(self.request, f"Le matériel {form.instance.nom} a été mis à jour.")
        return super().form_valid(form)


class MaterielDeleteView(EntrepriseRequiredMixin, DeleteView):
    model = Materiel
    template_name = "materiels/materiel_confirm_delete.html"
    success_url = reverse_lazy("materiels:materiel_liste")

    def get_queryset(self):
        return Materiel.objects.filter(entreprise=self.request.entreprise)


class MaintenanceCreateView(EntrepriseRequiredMixin, CreateView):
    model = Maintenance
    form_class = MaintenanceForm
    template_name = "materiels/maintenance_form.html"

    def form_valid(self, form):
        materiel = Materiel.objects.get(pk=self.kwargs["pk"], entreprise=self.request.entreprise)
        form.instance.materiel = materiel
        messages.success(self.request, f"La maintenance a été enregistrée pour {materiel.nom}.")
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy("materiels:materiel_detail", kwargs={"pk": self.kwargs["pk"]})
