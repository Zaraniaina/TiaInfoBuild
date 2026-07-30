"""
Vues du module Commercial.
"""

from django.contrib import messages
from django.urls import reverse_lazy
from django.views.generic import ListView, CreateView, UpdateView, DetailView

from core.views import EntrepriseRequiredMixin
from .models import Client, Devis, Facture, Paiement
from .forms import ClientForm, DevisForm, FactureForm, PaiementForm


class ClientListView(EntrepriseRequiredMixin, ListView):
    model = Client
    template_name = "commercial/client_list.html"
    context_object_name = "clients"
    paginate_by = 15

    def get_queryset(self):
        return Client.objects.filter(entreprise=self.request.entreprise).order_by("nom")


class ClientCreateView(EntrepriseRequiredMixin, CreateView):
    model = Client
    form_class = ClientForm
    template_name = "commercial/client_form.html"
    success_url = reverse_lazy("commercial:client_liste")

    def form_valid(self, form):
        form.instance.entreprise = self.request.entreprise
        messages.success(self.request, f"Le client {form.instance.nom} a été créé.")
        return super().form_valid(form)


class ClientUpdateView(EntrepriseRequiredMixin, UpdateView):
    model = Client
    form_class = ClientForm
    template_name = "commercial/client_form.html"
    success_url = reverse_lazy("commercial:client_liste")

    def get_queryset(self):
        return Client.objects.filter(entreprise=self.request.entreprise)

    def form_valid(self, form):
        messages.success(self.request, f"Le client {form.instance.nom} a été mis à jour.")
        return super().form_valid(form)


class DevisListView(EntrepriseRequiredMixin, ListView):
    model = Devis
    template_name = "commercial/devis_list.html"
    context_object_name = "devis"
    paginate_by = 15

    def get_queryset(self):
        return Devis.objects.filter(entreprise=self.request.entreprise).select_related("client").order_by("-date_creation")


class DevisDetailView(EntrepriseRequiredMixin, DetailView):
    model = Devis
    template_name = "commercial/devis_detail.html"
    context_object_name = "devis"

    def get_queryset(self):
        return Devis.objects.filter(entreprise=self.request.entreprise)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["lignes"] = self.object.lignes.all()
        return ctx


class DevisCreateView(EntrepriseRequiredMixin, CreateView):
    model = Devis
    form_class = DevisForm
    template_name = "commercial/devis_form.html"
    success_url = reverse_lazy("commercial:devis_liste")

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["user"] = self.request.user
        return kwargs

    def form_valid(self, form):
        form.instance.entreprise = self.request.entreprise
        messages.success(self.request, f"Le devis #{form.instance.id} a été créé.")
        return super().form_valid(form)


class FactureListView(EntrepriseRequiredMixin, ListView):
    model = Facture
    template_name = "commercial/facture_list.html"
    context_object_name = "factures"
    paginate_by = 15

    def get_queryset(self):
        return Facture.objects.filter(entreprise=self.request.entreprise).select_related("contrat").order_by("-date_emission")


class FactureCreateView(EntrepriseRequiredMixin, CreateView):
    model = Facture
    form_class = FactureForm
    template_name = "commercial/facture_form.html"
    success_url = reverse_lazy("commercial:facture_liste")

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["user"] = self.request.user
        return kwargs

    def form_valid(self, form):
        form.instance.entreprise = self.request.entreprise
        messages.success(self.request, f"La facture #{form.instance.id} a été créée.")
        return super().form_valid(form)


class PaiementCreateView(EntrepriseRequiredMixin, CreateView):
    model = Paiement
    form_class = PaiementForm
    template_name = "commercial/paiement_form.html"
    success_url = reverse_lazy("commercial:facture_liste")

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["user"] = self.request.user
        return kwargs

    def form_valid(self, form):
        messages.success(self.request, f"Le paiement de {form.instance.montant} Ar a été enregistré.")
        return super().form_valid(form)
