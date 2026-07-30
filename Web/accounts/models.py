from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

from .managers import UtilisateurManager


class Entreprise(models.Model):
    """Une entreprise cliente du SaaS (isolation multi-tenant)."""

    nom = models.CharField("Nom de l'entreprise", max_length=150)
    adresse = models.CharField("Adresse", max_length=255, blank=True)
    telephone = models.CharField("Téléphone", max_length=30, blank=True)
    email = models.EmailField("Email", blank=True)
    logo = models.ImageField("Logo", upload_to="entreprises/logos/", blank=True, null=True)
    abonnement = models.CharField(
        "Plan d'abonnement",
        max_length=30,
        choices=[
            ("essai", "Essai gratuit"),
            ("standard", "Standard"),
            ("premium", "Premium"),
        ],
        default="essai",
    )
    est_active = models.BooleanField("Active", default=True)
    date_creation = models.DateTimeField("Créée le", default=timezone.now)

    class Meta:
        verbose_name = "Entreprise"
        verbose_name_plural = "Entreprises"
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class Role(models.Model):
    """Rôle applicatif : détermine les permissions dans l'application."""

    ADMINISTRATEUR = "administrateur"
    DIRECTEUR = "directeur"
    CHEF_CHANTIER = "chef_chantier"
    COMPTABLE = "comptable"
    MAGASINIER = "magasinier"
    EMPLOYE = "employe"
    CLIENT = "client"

    CODE_CHOICES = [
        (ADMINISTRATEUR, "Administrateur"),
        (DIRECTEUR, "Directeur"),
        (CHEF_CHANTIER, "Chef de chantier"),
        (COMPTABLE, "Comptable / Gestionnaire"),
        (MAGASINIER, "Magasinier"),
        (EMPLOYE, "Employé de terrain"),
        (CLIENT, "Client"),
    ]

    code = models.CharField("Code", max_length=30, choices=CODE_CHOICES, unique=True)
    nom = models.CharField("Nom affiché", max_length=60)
    description = models.CharField("Description", max_length=255, blank=True)

    class Meta:
        verbose_name = "Rôle"
        verbose_name_plural = "Rôles"
        ordering = ["nom"]

    def __str__(self):
        return self.nom

    @property
    def est_interne(self):
        return self.code != self.CLIENT


class Utilisateur(AbstractUser):
    """Utilisateur de la plateforme. Connexion par email. Rattaché à une entreprise + un rôle."""

    username = None
    email = models.EmailField("Adresse email", unique=True)

    entreprise = models.ForeignKey(
        Entreprise,
        verbose_name="Entreprise",
        related_name="utilisateurs",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    role = models.ForeignKey(
        Role,
        verbose_name="Rôle",
        related_name="utilisateurs",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    # Le module Commercial (Client) sera créé plus tard ; ce lien sera activé à ce moment-là
    # via un champ client = models.ForeignKey("commercial.Client", null=True, blank=True, ...)

    telephone = models.CharField("Téléphone", max_length=30, blank=True)
    photo = models.ImageField("Photo de profil", upload_to="utilisateurs/photos/", blank=True, null=True)
    STATUT_CHOICES = [
        ("actif", "Actif"),
        ("inactif", "Inactif"),
        ("suspendu", "Suspendu"),
    ]
    statut = models.CharField("Statut", max_length=20, choices=STATUT_CHOICES, default="actif")
    doit_changer_mot_de_passe = models.BooleanField("Doit changer son mot de passe", default=True)
    derniere_connexion_ip = models.GenericIPAddressField("Dernière IP de connexion", null=True, blank=True)
    date_creation = models.DateTimeField("Créé le", default=timezone.now)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UtilisateurManager()

    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"
        ordering = ["-date_creation"]

    def __str__(self):
        full = self.get_full_name()
        return full if full else self.email

    @property
    def est_client(self):
        return bool(self.role and self.role.code == Role.CLIENT)

    @property
    def initiales(self):
        prenom = (self.first_name or "")[:1]
        nom = (self.last_name or "")[:1]
        base = (prenom + nom).upper()
        return base or self.email[:2].upper()
