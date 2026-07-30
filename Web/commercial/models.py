"""
Modèles du module Commercial.

Gère les clients, les devis, les contrats, les factures et les paiements.
"""

from django.db import models
from django.utils import timezone


class Client(models.Model):
    """
    Un client de l'entreprise (particulier ou entreprise).
    """

    entreprise = models.ForeignKey(
        "accounts.Entreprise",
        verbose_name="Entreprise",
        related_name="clients",
        on_delete=models.CASCADE,
    )

    TYPE_CHOICES = [
        ("particulier", "Particulier"),
        ("entreprise", "Entreprise"),
    ]
    type = models.CharField("Type", max_length=20, choices=TYPE_CHOICES, default="particulier")
    nom = models.CharField("Nom", max_length=150)
    adresse = models.CharField("Adresse", max_length=255, blank=True)
    telephone = models.CharField("Téléphone", max_length=30, blank=True)
    email = models.EmailField("Email", blank=True)
    date_creation = models.DateTimeField("Créé le", default=timezone.now)

    class Meta:
        verbose_name = "Client"
        verbose_name_plural = "Clients"
        ordering = ["entreprise", "nom"]

    def __str__(self):
        return f"{self.nom} ({self.entreprise.nom})"


class Devis(models.Model):
    """
    Un devis envoyé à un client.

    Un devis peut être transformé en contrat (et donc en chantier).
    """

    entreprise = models.ForeignKey(
        "accounts.Entreprise",
        verbose_name="Entreprise",
        related_name="devis",
        on_delete=models.CASCADE,
    )
    client = models.ForeignKey(
        Client,
        verbose_name="Client",
        related_name="devis",
        on_delete=models.CASCADE,
    )

    date_creation = models.DateField("Date de création", default=timezone.now)
    date_validite = models.DateField("Date de validité", null=True, blank=True)
    montant_total = models.DecimalField("Montant total", max_digits=12, decimal_places=2, default=0)

    STATUT_CHOICES = [
        ("brouillon", "Brouillon"),
        ("envoye", "Envoyé"),
        ("en_cours", "En cours"),
        ("accepte", "Accepté"),
        ("refuse", "Refusé"),
        ("expire", "Expiré"),
    ]
    statut = models.CharField("Statut", max_length=20, choices=STATUT_CHOICES, default="brouillon")

    class Meta:
        verbose_name = "Devis"
        verbose_name_plural = "Devis"
        ordering = ["-date_creation"]

    def __str__(self):
        return f"Devis #{self.id} — {self.client.nom}"


class LigneDevis(models.Model):
    """
    Une ligne de devis (description, quantité, prix unitaire).
    """

    devis = models.ForeignKey(
        Devis,
        verbose_name="Devis",
        related_name="lignes",
        on_delete=models.CASCADE,
    )
    description = models.TextField("Description")
    quantite = models.DecimalField("Quantité", max_digits=10, decimal_places=2)
    prix_unitaire = models.DecimalField("Prix unitaire", max_digits=10, decimal_places=2)

    class Meta:
        verbose_name = "Ligne de devis"
        verbose_name_plural = "Lignes de devis"

    def __str__(self):
        return f"{self.description} ({self.quantite} x {self.prix_unitaire})"

    @property
    def montant(self):
        return self.quantite * self.prix_unitaire


class Contrat(models.Model):
    """
    Un contrat signé avec un client, lié à un devis et générant un chantier.
    """

    entreprise = models.ForeignKey(
        "accounts.Entreprise",
        verbose_name="Entreprise",
        related_name="contrats",
        on_delete=models.CASCADE,
    )
    devis = models.ForeignKey(
        Devis,
        verbose_name="Devis",
        related_name="contrats",
        on_delete=models.PROTECT,
    )
    chantier = models.ForeignKey(
        "chantiers.Chantier",
        verbose_name="Chantier",
        related_name="contrats",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    date_signature = models.DateField("Date de signature", default=timezone.now)
    montant = models.DecimalField("Montant", max_digits=12, decimal_places=2, default=0)

    STATUT_CHOICES = [
        ("signe", "Signé"),
        ("en_cours", "En cours"),
        ("termine", "Terminé"),
        ("resili", "Résilié"),
    ]
    statut = models.CharField("Statut", max_length=20, choices=STATUT_CHOICES, default="signe")

    class Meta:
        verbose_name = "Contrat"
        verbose_name_plural = "Contrats"
        ordering = ["-date_signature"]

    def __str__(self):
        return f"Contrat #{self.id} — {self.devis.client.nom}"


class Facture(models.Model):
    """
    Une facture liée à un contrat.
    """

    entreprise = models.ForeignKey(
        "accounts.Entreprise",
        verbose_name="Entreprise",
        related_name="factures",
        on_delete=models.CASCADE,
    )
    contrat = models.ForeignKey(
        Contrat,
        verbose_name="Contrat",
        related_name="factures",
        on_delete=models.CASCADE,
    )

    date_emission = models.DateField("Date d'émission", default=timezone.now)
    date_echeance = models.DateField("Date d'échéance", null=True, blank=True)
    montant = models.DecimalField("Montant", max_digits=12, decimal_places=2, default=0)

    STATUT_CHOICES = [
        ("brouillon", "Brouillon"),
        ("envoyee", "Envoyée"),
        ("payee", "Payée"),
        ("en_retard", "En retard"),
        ("annulee", "Annulée"),
    ]
    statut = models.CharField("Statut", max_length=20, choices=STATUT_CHOICES, default="brouillon")

    class Meta:
        verbose_name = "Facture"
        verbose_name_plural = "Factures"
        ordering = ["-date_emission"]

    def __str__(self):
        return f"Facture #{self.id} — {self.montant} Ar"


class Paiement(models.Model):
    """
    Un paiement effectué sur une facture.
    """

    facture = models.ForeignKey(
        Facture,
        verbose_name="Facture",
        related_name="paiements",
        on_delete=models.CASCADE,
    )

    date_paiement = models.DateField("Date de paiement", default=timezone.now)
    montant = models.DecimalField("Montant", max_digits=12, decimal_places=2, default=0)

    MODE_CHOICES = [
        ("virement", "Virement"),
        ("especes", "Espèces"),
        ("cheque", "Chèque"),
        ("mobile", "Mobile money"),
    ]
    mode_paiement = models.CharField("Mode de paiement", max_length=20, choices=MODE_CHOICES, default="virement")

    class Meta:
        verbose_name = "Paiement"
        verbose_name_plural = "Paiements"
        ordering = ["-date_paiement"]

    def __str__(self):
        return f"Paiement {self.montant} Ar — {self.facture}"
