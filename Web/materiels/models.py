"""
Modèles du module Matériels.

Gère l'inventaire des matériels, leur affectation aux chantiers,
les maintenances et les alertes.
"""

from django.db import models
from django.utils import timezone


class Materiel(models.Model):
    """
    Un matériel appartenant à l'entreprise (ex: pelle, bétonnière, grue).

    Suivi de l'état, de la valeur d'achat, des maintenances et des alertes.
    """

    entreprise = models.ForeignKey(
        "accounts.Entreprise",
        verbose_name="Entreprise",
        related_name="materiels",
        on_delete=models.CASCADE,
    )

    nom = models.CharField("Nom", max_length=150)
    type = models.CharField("Type", max_length=100, blank=True)
    numero_serie = models.CharField("Numéro de série", max_length=100, unique=True)
    date_acquisition = models.DateField("Date d'acquisition", default=timezone.now)
    valeur_achat = models.DecimalField("Valeur d'achat", max_digits=12, decimal_places=2, default=0)

    STATUT_CHOICES = [
        ("disponible", "Disponible"),
        ("affecte", "Affecté"),
        ("en_maintenance", "En maintenance"),
        ("en_panne", "En panne"),
        ("hors_service", "Hors service"),
    ]
    statut = models.CharField("Statut", max_length=20, choices=STATUT_CHOICES, default="disponible")
    date_creation = models.DateTimeField("Créé le", default=timezone.now)

    class Meta:
        verbose_name = "Matériel"
        verbose_name_plural = "Matériels"
        ordering = ["entreprise", "nom"]

    def __str__(self):
        return f"{self.nom} ({self.numero_serie})"

    @property
    def est_disponible(self):
        return self.statut == "disponible"


class AffectationMateriel(models.Model):
    """
    Affectation d'un matériel à un chantier pour une période donnée.
    """

    materiel = models.ForeignKey(
        Materiel,
        verbose_name="Matériel",
        related_name="affectations",
        on_delete=models.CASCADE,
    )
    chantier = models.ForeignKey(
        "chantiers.Chantier",
        verbose_name="Chantier",
        related_name="affectations_materiel",
        on_delete=models.CASCADE,
    )
    date_debut = models.DateField("Date de début", default=timezone.now)
    date_fin = models.DateField("Date de fin", null=True, blank=True)

    class Meta:
        verbose_name = "Affectation de matériel"
        verbose_name_plural = "Affectations de matériel"
        ordering = ["-date_debut"]

    def __str__(self):
        return f"{self.materiel.nom} → {self.chantier.nom}"


class Maintenance(models.Model):
    """
    Une opération de maintenance sur un matériel.

    Types : préventive, corrective, curative.
    """

    materiel = models.ForeignKey(
        Materiel,
        verbose_name="Matériel",
        related_name="maintenances",
        on_delete=models.CASCADE,
    )

    TYPE_CHOICES = [
        ("preventive", "Préventive"),
        ("corrective", "Corrective"),
        ("curative", "Curative"),
    ]
    type = models.CharField("Type", max_length=20, choices=TYPE_CHOICES, default="preventive")
    date_maintenance = models.DateField("Date de maintenance", default=timezone.now)
    cout = models.DecimalField("Coût", max_digits=10, decimal_places=2, default=0)
    description = models.TextField("Description", blank=True)
    prochaine_echeance = models.DateField("Prochaine échéance", null=True, blank=True)

    class Meta:
        verbose_name = "Maintenance"
        verbose_name_plural = "Maintenances"
        ordering = ["-date_maintenance"]

    def __str__(self):
        return f"{self.get_type_display()} — {self.materiel.nom}"


class AlerteMateriel(models.Model):
    """
    Une alerte sur un matériel (ex: maintenance due, panne, hors service).
    """

    materiel = models.ForeignKey(
        Materiel,
        verbose_name="Matériel",
        related_name="alertes",
        on_delete=models.CASCADE,
    )

    TYPE_CHOICES = [
        ("maintenance", "Maintenance due"),
        ("panne", "Panne"),
        ("hors_service", "Hors service"),
    ]
    type = models.CharField("Type", max_length=20, choices=TYPE_CHOICES)
    message = models.TextField("Message")
    date_alerte = models.DateField("Date de l'alerte", default=timezone.now)

    STATUT_CHOICES = [
        ("ouverte", "Ouverte"),
        ("en_cours", "En cours"),
        ("resolue", "Résolue"),
    ]
    statut = models.CharField("Statut", max_length=20, choices=STATUT_CHOICES, default="ouverte")

    class Meta:
        verbose_name = "Alerte matériel"
        verbose_name_plural = "Alertes matériel"
        ordering = ["-date_alerte"]

    def __str__(self):
        return f"{self.get_type_display()} — {self.materiel.nom}"
