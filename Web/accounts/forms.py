from django import forms
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm, UserChangeForm

from .models import Utilisateur, Role, Entreprise


class BootstrapFormMixin:
    """Ajoute automatiquement les classes Bootstrap 5 à tous les champs du formulaire."""

    def _bootstrapify(self):
        for name, field in self.fields.items():
            widget = field.widget
            css = "form-select" if isinstance(widget, forms.Select) else "form-control"
            if isinstance(widget, forms.CheckboxInput):
                css = "form-check-input"
            existing = widget.attrs.get("class", "")
            widget.attrs["class"] = (existing + " " + css).strip()


class ConnexionForm(BootstrapFormMixin, AuthenticationForm):
    username = forms.EmailField(
        label="Adresse email",
        widget=forms.EmailInput(attrs={"placeholder": "nom@entreprise.mg", "autofocus": True}),
    )
    password = forms.CharField(
        label="Mot de passe",
        widget=forms.PasswordInput(attrs={"placeholder": "••••••••"}),
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bootstrapify()


class UtilisateurCreationForm(BootstrapFormMixin, UserCreationForm):
    class Meta:
        model = Utilisateur
        fields = ["email", "first_name", "last_name", "telephone", "entreprise", "role", "statut"]
        labels = {
            "first_name": "Prénom",
            "last_name": "Nom",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bootstrapify()
        self.fields["entreprise"].queryset = Entreprise.objects.filter(est_active=True)
        self.fields["entreprise"].required = False
        self.fields["role"].queryset = Role.objects.all()


class UtilisateurModificationForm(BootstrapFormMixin, forms.ModelForm):
    class Meta:
        model = Utilisateur
        fields = ["email", "first_name", "last_name", "telephone", "entreprise", "role", "statut", "photo"]
        labels = {
            "first_name": "Prénom",
            "last_name": "Nom",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bootstrapify()


class ProfilForm(BootstrapFormMixin, forms.ModelForm):
    class Meta:
        model = Utilisateur
        fields = ["first_name", "last_name", "telephone", "photo"]
        labels = {
            "first_name": "Prénom",
            "last_name": "Nom",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bootstrapify()


class EntrepriseInscriptionForm(BootstrapFormMixin, forms.ModelForm):
    """
    Formulaire d'inscription d'une nouvelle entreprise.

    Crée en une seule opération :
    - L'Entreprise (avec ses informations de base)
    - Le premier Utilisateur (administrateur de l'entreprise)
      avec un mot de passe temporaire à changer à la première connexion.

    Les champs du mot de passe sont gérés manuellement car le modèle
    Utilisateur ne les expose pas directement (set_password est appelé
    dans la vue).
    """

    # Informations de l'entreprise
    nom = forms.CharField(
        label="Nom de l'entreprise",
        max_length=150,
        widget=forms.TextInput(attrs={"placeholder": "Ex: BTP Construction Madagascar"}),
    )
    adresse = forms.CharField(
        label="Adresse",
        max_length=255,
        required=False,
        widget=forms.TextInput(attrs={"placeholder": "Adresse complète"}),
    )
    telephone = forms.CharField(
        label="Téléphone",
        max_length=30,
        required=False,
        widget=forms.TextInput(attrs={"placeholder": "+261 34 00 000 00"}),
    )
    email = forms.EmailField(
        label="Email de l'entreprise",
        required=False,
        widget=forms.EmailInput(attrs={"placeholder": "contact@entreprise.mg"}),
    )

    # Informations du premier administrateur
    admin_prenom = forms.CharField(
        label="Prénom",
        max_length=150,
        widget=forms.TextInput(attrs={"placeholder": "Prénom du responsable"}),
    )
    admin_nom = forms.CharField(
        label="Nom",
        max_length=150,
        widget=forms.TextInput(attrs={"placeholder": "Nom du responsable"}),
    )
    admin_email = forms.EmailField(
        label="Email du responsable",
        widget=forms.EmailInput(attrs={"placeholder": "nom@entreprise.mg", "autofocus": True}),
    )
    admin_telephone = forms.CharField(
        label="Téléphone du responsable",
        max_length=30,
        required=False,
        widget=forms.TextInput(attrs={"placeholder": "+261 34 00 000 00"}),
    )
    password1 = forms.CharField(
        label="Mot de passe",
        widget=forms.PasswordInput(attrs={"placeholder": "••••••••"}),
    )
    password2 = forms.CharField(
        label="Confirmation",
        widget=forms.PasswordInput(attrs={"placeholder": "••••••••"}),
    )

    class Meta:
        model = Entreprise
        fields = ["nom", "adresse", "telephone", "email"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bootstrapify()

    def clean_admin_email(self):
        """Vérifie que l'email du responsable n'est pas déjà utilisé."""
        email = self.cleaned_data["admin_email"]
        if Utilisateur.objects.filter(email=email).exists():
            raise forms.ValidationError("Cet email est déjà utilisé par un autre compte.")
        return email

    def clean(self):
        """Vérifie que les deux mots de passe correspondent."""
        cleaned = super().clean()
        p1 = cleaned.get("password1")
        p2 = cleaned.get("password2")
        if p1 and p2 and p1 != p2:
            self.add_error("password2", "Les mots de passe ne correspondent pas.")
        return cleaned
