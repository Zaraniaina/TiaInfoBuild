"""
Vues du module Chantiers.

Toutes les vues sont protégées par EntrepriseRequiredMixin :
un utilisateur ne voit que les chantiers de son entreprise.
"""

from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy
from django.views.generic import ListView, CreateView, UpdateView, DeleteView, DetailView

from core.views import EntrepriseRequiredMixin
from .models import Chantier, Phase, Incident
from .forms import ChantierForm, PhaseForm, IncidentForm


class ChantierListView(EntrepriseRequiredMixin, ListView):
    """Liste des chantiers de l'entreprise."""

    model = Chantier
    template_name = "chantiers/chantier_list.html"
    context_object_name = "chantiers"
    paginate_by = 15

    def get_queryset(self):
        return Chantier.objects.filter(entreprise=self.request.entreprise).order_by("-date_creation")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["recherche"] = self.request.GET.get("q", "")
        return ctx


class ChantierDetailView(EntrepriseRequiredMixin, DetailView):
    """Détail d'un chantier : phases, incidents, budget."""

    model = Chantier
    template_name = "chantiers/chantier_detail.html"
    context_object_name = "chantier"

    def get_queryset(self):
        return Chantier.objects.filter(entreprise=self.request.entreprise)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["phases"] = self.object.phases.all().order_by("ordre")
        ctx["incidents"] = self.object.incidents.all().order_by("-date_creation")
        return ctx


class ChantierCreateView(EntrepriseRequiredMixin, CreateView):
    """Création d'un nouveau chantier."""

    model = Chantier
    form_class = ChantierForm
    template_name = "chantiers/chantier_form.html"
    success_url = reverse_lazy("chantiers:chantier_liste")

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["user"] = self.request.user
        return kwargs

    def form_valid(self, form):
        form.instance.entreprise = self.request.entreprise
        messages.success(self.request, f"Le chantier « {form.instance.nom} » a été créé.")
        return super().form_valid(form)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["mode"] = "creation"
        return ctx


class ChantierUpdateView(EntrepriseRequiredMixin, UpdateView):
    """Modification d'un chantier existant."""

    model = Chantier
    form_class = ChantierForm
    template_name = "chantiers/chantier_form.html"
    success_url = reverse_lazy("chantiers:chantier_liste")

    def get_queryset(self):
        return Chantier.objects.filter(entreprise=self.request.entreprise)

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["user"] = self.request.user
        return kwargs

    def form_valid(self, form):
        messages.success(self.request, f"Le chantier « {form.instance.nom} » a été mis à jour.")
        return super().form_valid(form)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["mode"] = "modification"
        return ctx


class ChantierDeleteView(EntrepriseRequiredMixin, DeleteView):
    """Suppression d'un chantier."""

    model = Chantier
    template_name = "chantiers/chantier_confirm_delete.html"
    success_url = reverse_lazy("chantiers:chantier_liste")

    def get_queryset(self):
        return Chantier.objects.filter(entreprise=self.request.entreprise)

    def delete(self, request, *args, **kwargs):
        self.object = self.get_object()
        messages.success(request, f"Le chantier « {self.object.nom} » a été supprimé.")
        return super().delete(request, *args, **kwargs)


class PhaseCreateView(EntrepriseRequiredMixin, CreateView):
    """Ajout d'une phase à un chantier."""

    model = Phase
    form_class = PhaseForm
    template_name = "chantiers/phase_form.html"

    def form_valid(self, form):
        chantier = Chantier.objects.get(pk=self.kwargs["pk"], entreprise=self.request.entreprise)
        form.instance.chantier = chantier
        messages.success(self.request, f"La phase a été ajoutée au chantier « {chantier.nom} ».")
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy("chantiers:chantier_detail", kwargs={"pk": self.kwargs["pk"]})


class IncidentCreateView(EntrepriseRequiredMixin, CreateView):
    """Déclaration d'un incident sur un chantier."""

    model = Incident
    form_class = IncidentForm
    template_name = "chantiers/incident_form.html"

    def form_valid(self, form):
        chantier = Chantier.objects.get(pk=self.kwargs["pk"], entreprise=self.request.entreprise)
        form.instance.chantier = chantier
        form.instance.declare_par = self.request.user
        messages.success(self.request, f"L'incident a été déclaré sur le chantier « {chantier.nom} ».")
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy("chantiers:chantier_detail", kwargs={"pk": self.kwargs["pk"]})
