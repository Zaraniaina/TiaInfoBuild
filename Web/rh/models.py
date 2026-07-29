"""
Modèles du module Ressources Humaines.

Gère les employés (non-utilisateurs de l'application), les équipes,
les affectations sur les chantiers et le pointage.
"""

from django.db import models
from django.utils import timezone


class Employe(models.Model):
    """
    Un employé de l'entreprise (ressource humaine).

    Note : un Employé n'est pas forcément un Utilisateur de l'application.
    Un Employé peut être lié à un Utilisateur s'il a accès à la plateforme.
    """

    entreprise = models.ForeignKey(
        "accounts.Entreprise",
        verbose_name="Entreprise",
        related_name="employes",
        on_delete=models.CASCADE,
    )
    utilisateur = models.OneToOneField(
        "accounts.Utilisateur",
        verbose_name="Utilisateur lié",
        related_name="employe",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    matricule = models.CharField("Matricule", max_length=30, unique=True)
    nom = models.CharField("Nom", max_length=100)
    prenom = models.CharField("Prénom", max_length=100)
    poste = models.CharField("Poste", max_length=100, blank=True)
    date_embauche = models.DateField("Date d'embauche", default=timezone.now)
    salaire_base = models.DecimalField("Salaire de base", max_digits=10, decimal_places=2, default=0)
    telephone = models.CharField("Téléphone", max_length=30, blank=True)
    adresse = models.CharField("Adresse", max_length=255, blank=True)

    STATUT_CHOICES = [
        ("actif", "Actif"),
        ("inactif", "Inactif"),
        ("conge", "En congé"),
        ("suspendu", "Suspendu"),
    ]
    statut = models.CharField("Statut", max_length=20, choices=STATUT_CHOICES, default="actif")
    date_creation = models.DateTimeField("Créé le", default=timezone.now)

    class Meta:
        verbose_name = "Employé"
        verbose_name_plural = "Employés"
        ordering = ["nom", "prenom"]

    def __str__(self):
        return f"{self.prenom} {self.nom} ({self.matricule})"

    @property
    def nom_complet(self):
        return f"{self.prenom} {self.nom}"


class Equipe(models.Model):
    """
    Une équipe de chantier (groupe d'employés sous la responsabilité d'un chef).
    """

    entreprise = models.ForeignKey(
        "accounts.Entreprise",
        verbose_name="Entreprise",
        related_name="equipes",
        on_delete=models.CASCADE,
    )
    chef_equipe = models.ForeignKey(
        Employe,
        verbose_name="Chef d'équipe",
        related_name="equipes_gerer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    nom = models.CharField("Nom de l'équipe", max_length=100)
    description = models.TextField("Description", blank=True)

    class Meta:
        verbose_name = "Équipe"
        verbose_name_plural = "Équipes"
        ordering = ["entreprise", "nom"]

    def __str__(self):
        return f"{self.nom} ({self.entreprise.nom})"


class MembreEquipe(models.Model):
    """
    Lien many-to-many entre Employé et Équipe (avec date d'affectation).
    """

    equipe = models.ForeignKey(
        Equipe,
        verbose_name="Équipe",
        related_name="membres",
        on_delete=models.CASCADE,
    )
    employe = models.ForeignKey(
        Employe,
        verbose_name="Employé",
        related_name="equipes",
        on_delete=models.CASCADE,
    )
    date_affectation = models.DateField("Date d'affectation", default=timezone.now)

    class Meta:
        verbose_name = "Membre d'équipe"
        verbose_name_plural = "Membres d'équipe"
        unique_together = ["equipe", "employe"]

    def __str__(self):
        return f"{self.employe.nom_complet} → {self.equipe.nom}"


class Pointage(models.Model):
    """
    Un pointage quotidien d'un employé sur un chantier.

    Enregistre l'heure d'arrivée et de départ, ainsi que le statut
    (présent, absent, retard, etc.).
    """

    employe = models.ForeignKey(
        Employe,
        verbose_name="Employé",
        related_name="pointages",
        on_delete=models.CASCADE,
    )
    chantier = models.ForeignKey(
        "chantiers.Chantier",
        verbose_name="Chantier",
        related_name="pointages",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    date_jour = models.DateField("Date", default=timezone.now)
    heure_arrivee = models.TimeField("Heure d'arrivée", null=True, blank=True)
    heure_depart = models.TimeField("Heure de départ", null=True, blank=True)

    STATUT_CHOICES = [
        ("present", "Présent"),
        ("absent", "Absent"),
        ("retard", "En retard"),
        ("conge", "Congé"),
    ]
    statut = models.CharField("Statut", max_length=20, choices=STATUT_CHOICES, default="present")
    remarque = models.TextField("Remarque", blank=True)

    class Meta:
        verbose_name = "Pointage"
        verbose_name_plural = "Pointages"
        ordering = ["-date_jour"]
        unique_together = ["employe", "date_jour"]

    def __str__(self):
        return f"{self.employe.nom_complet} — {self.date_jour}"
