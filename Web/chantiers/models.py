"""
Modèles du module Chantiers.

Un Chantier est le cœur du système BTP : il regroupe des phases, des
incidents et des affectations de ressources (employés, matériels).

Chaque entité est rattachée à une Entreprise (multi-tenant SaaS).
"""

from django.db import models
from django.utils import timezone


class Chantier(models.Model):
    """
    Un chantier de construction.

    Attributs clés :
    - entreprise : lien multi-tenant (isolation des données)
    - client : client propriétaire du chantier (module Commercial)
    - chef_chantier : utilisateur responsable (module accounts)
    - budget_prevu / budget_reel : suivi financier
    - statut : progression du chantier
    """

    STATUT_CHOICES = [
        ("planification", "Planification"),
        ("actif", "Actif"),
        ("en_pause", "En pause"),
        ("termine", "Terminé"),
        ("annule", "Annulé"),
    ]

    entreprise = models.ForeignKey(
        "accounts.Entreprise",
        verbose_name="Entreprise",
        related_name="chantiers",
        on_delete=models.CASCADE,
    )
    client = models.ForeignKey(
        "commercial.Client",
        verbose_name="Client",
        related_name="chantiers",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    chef_chantier = models.ForeignKey(
        "accounts.Utilisateur",
        verbose_name="Chef de chantier",
        related_name="chantiers_chef",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    nom = models.CharField("Nom du chantier", max_length=150)
    adresse = models.CharField("Adresse", max_length=255, blank=True)
    description = models.TextField("Description", blank=True)

    date_debut = models.DateField("Date de début", null=True, blank=True)
    date_fin_prevue = models.DateField("Date de fin prévue", null=True, blank=True)
    date_fin_reelle = models.DateField("Date de fin réelle", null=True, blank=True)

    budget_prevu = models.DecimalField("Budget prévu", max_digits=12, decimal_places=2, default=0)
    budget_reel = models.DecimalField("Budget réel", max_digits=12, decimal_places=2, default=0)

    statut = models.CharField("Statut", max_length=20, choices=STATUT_CHOICES, default="planification")
    date_creation = models.DateTimeField("Créé le", default=timezone.now)
    date_modification = models.DateTimeField("Modifié le", auto_now=True)

    class Meta:
        verbose_name = "Chantier"
        verbose_name_plural = "Chantiers"
        ordering = ["-date_creation"]
        # Un chantier est unique par entreprise + nom
        unique_together = ["entreprise", "nom"]

    def __str__(self):
        return f"{self.nom} ({self.entreprise.nom})"

    @property
    def est_actif(self):
        """Retourne True si le chantier est dans un statut actif."""
        return self.statut in ("actif", "en_pause")

    @property
    def avancement_pct(self):
        """Calcule le pourcentage d'avancement basé sur les phases."""
        phases = self.phases.all()
        if not phases:
            return 0
        total = sum(p.avancement_pct for p in phases)
        return round(total / len(phases))


class Phase(models.Model):
    """
    Une phase d'un chantier (ex: fondations, charpente, finitions).

    Chaque phase a un ordre, des dates et un pourcentage d'avancement.
    """

    chantier = models.ForeignKey(
        Chantier,
        verbose_name="Chantier",
        related_name="phases",
        on_delete=models.CASCADE,
    )
    nom = models.CharField("Nom de la phase", max_length=150)
    description = models.TextField("Description", blank=True)
    date_debut = models.DateField("Date de début", null=True, blank=True)
    date_fin = models.DateField("Date de fin", null=True, blank=True)
    avancement_pct = models.IntegerField("Avancement (%)", default=0)
    ordre = models.IntegerField("Ordre", default=0)

    STATUT_CHOICES = [
        ("non_commencee", "Non commencée"),
        ("en_cours", "En cours"),
        ("terminee", "Terminée"),
        ("bloquee", "Bloquée"),
    ]
    statut = models.CharField("Statut", max_length=20, choices=STATUT_CHOICES, default="non_commencee")

    class Meta:
        verbose_name = "Phase"
        verbose_name_plural = "Phases"
        ordering = ["chantier", "ordre"]

    def __str__(self):
        return f"{self.nom} ({self.chantier.nom})"


class Incident(models.Model):
    """
    Un incident déclaré sur un chantier (ex: retard, accident, problème qualité).

    Les incidents sont déclarés par un utilisateur et suivis jusqu'à résolution.
    """

    GRAVITE_CHOICES = [
        ("faible", "Faible"),
        ("moyenne", "Moyenne"),
        ("elevee", "Élevée"),
        ("critique", "Critique"),
    ]

    STATUT_CHOICES = [
        ("signale", "Signalé"),
        ("en_cours", "En cours"),
        ("resolu", "Résolu"),
        ("clos", "Clos"),
    ]

    chantier = models.ForeignKey(
        Chantier,
        verbose_name="Chantier",
        related_name="incidents",
        on_delete=models.CASCADE,
    )
    declare_par = models.ForeignKey(
        "accounts.Utilisateur",
        verbose_name="Déclaré par",
        related_name="incidents_declares",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    titre = models.CharField("Titre", max_length=150)
    description = models.TextField("Description")
    date_incident = models.DateField("Date de l'incident", default=timezone.now)
    gravite = models.CharField("Gravité", max_length=20, choices=GRAVITE_CHOICES, default="moyenne")
    statut = models.CharField("Statut", max_length=20, choices=STATUT_CHOICES, default="signale")

    date_creation = models.DateTimeField("Créé le", default=timezone.now)
    date_modification = models.DateTimeField("Modifié le", auto_now=True)

    class Meta:
        verbose_name = "Incident"
        verbose_name_plural = "Incidents"
        ordering = ["-date_creation"]

    def __str__(self):
        return f"{self.titre} ({self.get_gravite_display()})"
