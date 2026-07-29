from django.contrib import messages
from django.contrib.auth import logout, update_session_auth_hash
from django.contrib.auth.forms import PasswordChangeForm
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.contrib.auth.views import LoginView, LogoutView
from django.urls import reverse_lazy
from django.shortcuts import get_object_or_404, redirect, render
from django.views import View
from django.views.generic import ListView, CreateView, UpdateView

from .forms import ConnexionForm, EntrepriseInscriptionForm, UtilisateurCreationForm, UtilisateurModificationForm, ProfilForm
from .models import Utilisateur, Role, Entreprise


class ConnexionView(LoginView):
    """Vue de connexion par adresse email.

    Après une connexion réussie :
    - Un super-administrateur (is_superuser) est redirigé vers le dashboard
      de la plateforme (/super-admin/).
    - Un utilisateur lié à une entreprise est redirigé vers son dashboard
      entreprise (/).
    - Un utilisateur sans entreprise est redirigé vers son profil.
    """

    template_name = "registration/login.html"
    authentication_form = ConnexionForm
    redirect_authenticated_user = True

    def get_success_url(self):
        user = self.request.user
        if user.is_superuser:
            return reverse_lazy("core:super_admin_dashboard")
        if getattr(user, "entreprise", None):
            return reverse_lazy("core:dashboard")
        return reverse_lazy("accounts:profil")

    def form_valid(self, form):
        messages.success(self.request, f"Bon retour, {form.get_user().get_full_name() or form.get_user().email} !")
        return super().form_valid(form)


class DeconnexionView(LogoutView):
    template_name = "registration/logout.html"
    next_page = reverse_lazy("accounts:login")
    http_method_names = ["get", "post"]

    def get(self, request, *args, **kwargs):
        return self.render_to_response(self.get_context_data())

    def post(self, request, *args, **kwargs):
        logout(request)
        messages.success(request, "Vous avez été déconnecté avec succès.")
        return redirect(self.next_page)


class GestionUtilisateursMixin(LoginRequiredMixin, UserPassesTestMixin):
    """Réservé aux rôles internes de pilotage (admin / directeur)."""

    login_url = reverse_lazy("accounts:login")

    def test_func(self):
        user = self.request.user
        if user.is_superuser:
            return True
        return bool(user.role and user.role.code in (Role.ADMINISTRATEUR, Role.DIRECTEUR))

    def handle_no_permission(self):
        if self.request.user.is_authenticated:
            messages.error(self.request, "Vous n'avez pas les droits pour accéder à cette page.")
            return redirect("core:dashboard")
        return super().handle_no_permission()


class UtilisateurListView(GestionUtilisateursMixin, ListView):
    model = Utilisateur
    template_name = "accounts/utilisateur_list.html"
    context_object_name = "utilisateurs"
    paginate_by = 15

    def get_queryset(self):
        qs = Utilisateur.objects.select_related("role", "entreprise")
        if not self.request.user.is_superuser and self.request.user.entreprise_id:
            qs = qs.filter(entreprise_id=self.request.user.entreprise_id)
        recherche = self.request.GET.get("q")
        if recherche:
            qs = qs.filter(email__icontains=recherche) | qs.filter(last_name__icontains=recherche) | qs.filter(first_name__icontains=recherche)
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["recherche"] = self.request.GET.get("q", "")
        ctx["total_actifs"] = self.get_queryset().filter(statut="actif").count()
        return ctx


class UtilisateurCreateView(GestionUtilisateursMixin, CreateView):
    model = Utilisateur
    form_class = UtilisateurCreationForm
    template_name = "accounts/utilisateur_form.html"
    success_url = reverse_lazy("accounts:utilisateur_liste")

    def form_valid(self, form):
        response = super().form_valid(form)
        messages.success(self.request, f"L'utilisateur {self.object.email} a été créé avec succès.")
        return response

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["mode"] = "creation"
        return ctx


class UtilisateurUpdateView(GestionUtilisateursMixin, UpdateView):
    model = Utilisateur
    form_class = UtilisateurModificationForm
    template_name = "accounts/utilisateur_form.html"
    success_url = reverse_lazy("accounts:utilisateur_liste")

    def form_valid(self, form):
        response = super().form_valid(form)
        messages.success(self.request, f"Les informations de {self.object.email} ont été mises à jour.")
        return response

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["mode"] = "modification"
        return ctx


class UtilisateurToggleStatutView(GestionUtilisateursMixin, View):
    def post(self, request, pk):
        utilisateur = get_object_or_404(Utilisateur, pk=pk)
        if utilisateur == request.user:
            messages.error(request, "Vous ne pouvez pas modifier votre propre statut.")
        else:
            utilisateur.statut = "inactif" if utilisateur.statut == "actif" else "actif"
            utilisateur.is_active = utilisateur.statut == "actif"
            utilisateur.save(update_fields=["statut", "is_active"])
            messages.success(request, f"Statut de {utilisateur.email} mis à jour : {utilisateur.get_statut_display()}.")
        return redirect("accounts:utilisateur_liste")


class ProfilView(LoginRequiredMixin, View):
    template_name = "accounts/profil.html"

    def get(self, request):
        return render(request, self.template_name, {
            "form": ProfilForm(instance=request.user),
            "password_form": PasswordChangeForm(user=request.user),
        })

    def post(self, request):
        if "changer_mdp" in request.POST:
            password_form = PasswordChangeForm(user=request.user, data=request.POST)
            form = ProfilForm(instance=request.user)
            if password_form.is_valid():
                password_form.save()
                update_session_auth_hash(request, password_form.user)
                messages.success(request, "Votre mot de passe a été mis à jour.")
                return redirect("accounts:profil")
        else:
            form = ProfilForm(request.POST, request.FILES, instance=request.user)
            password_form = PasswordChangeForm(user=request.user)
            if form.is_valid():
                form.save()
                messages.success(request, "Votre profil a été mis à jour.")
                return redirect("accounts:profil")
        return render(request, self.template_name, {"form": form, "password_form": password_form})


class InscriptionView(View):
    """
    Vue d'inscription d'une nouvelle entreprise.

    Flow :
    1. L'entreprise saisit ses informations + celles du responsable.
    2. À la validation, on crée l'Entreprise puis l'Utilisateur (administrateur).
    3. L'utilisateur est automatiquement connecté.
    4. Redirection vers le dashboard entreprise.

    Le mot de passe doit être changé à la première connexion
    (doit_changer_mot_de_passe = True).
    """

    template_name = "registration/inscription.html"

    def get(self, request):
        form = EntrepriseInscriptionForm()
        return render(request, self.template_name, {"form": form})

    def post(self, request):
        form = EntrepriseInscriptionForm(request.POST, request.FILES)
        if form.is_valid():
            # ─── Création de l'entreprise ───
            entreprise = Entreprise.objects.create(
                nom=form.cleaned_data["nom"],
                adresse=form.cleaned_data["adresse"],
                telephone=form.cleaned_data["telephone"],
                email=form.cleaned_data["email"],
                abonnement="essai",  # Plan d'essai gratuit par défaut
                est_active=True,
            )

            # ─── Récupération du rôle administrateur ───
            try:
                role_admin = Role.objects.get(code=Role.ADMINISTRATEUR)
            except Role.DoesNotExist:
                # Si les rôles n'ont pas été initialisés, on crée le rôle
                role_admin = Role.objects.create(
                    code=Role.ADMINISTRATEUR,
                    nom="Administrateur",
                    description="Accès complet à la plateforme et à la configuration.",
                )

            # ─── Création du premier utilisateur (administrateur) ───
            utilisateur = Utilisateur.objects.create_user(
                email=form.cleaned_data["admin_email"],
                password=form.cleaned_data["password1"],
                first_name=form.cleaned_data["admin_prenom"],
                last_name=form.cleaned_data["admin_nom"],
                telephone=form.cleaned_data["admin_telephone"],
                entreprise=entreprise,
                role=role_admin,
                statut="actif",
                doit_changer_mot_de_passe=True,
            )

            # ─── Connexion automatique ───
            from django.contrib.auth import login
            login(request, utilisateur)

            messages.success(
                request,
                f"Bienvenue {utilisateur.get_full_name()} ! Votre entreprise « {entreprise.nom} » "
                f"a été créée avec succès. Vous êtes connecté en tant qu'administrateur."
            )
            return redirect("core:dashboard")

        return render(request, self.template_name, {"form": form})
