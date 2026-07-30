"""
Modèles du module Stocks.

Gère les articles, les fournisseurs et les mouvements de stock
(entrées et sorties).
"""

from django.db import models
from django.utils import timezone


class Article(models.Model):
    """
    Un article stocké par l'entreprise (ex: ciment, sable, tuiles).

    Le seuil d'alerte déclenche une alerte lorsque le stock tombe en dessous.
    """

    entreprise = models.ForeignKey(
        "accounts.Entreprise",
        verbose_name="Entreprise",
        related_name="articles",
        on_delete=models.CASCADE,
    )

    nom = models.CharField("Nom", max_length=150)
    categorie = models.CharField("Catégorie", max_length=100, blank=True)
    unite = models.CharField("Unité", max_length=30, default="pièce")
    seuil_alerte = models.DecimalField("Seuil d'alerte", max_digits=10, decimal_places=2, default=0)
    quantite_stock = models.DecimalField("Quantité en stock", max_digits=12, decimal_places=2, default=0)
    prix_unitaire = models.DecimalField("Prix unitaire", max_digits=10, decimal_places=2, default=0)
    date_creation = models.DateTimeField("Créé le", default=timezone.now)

    class Meta:
        verbose_name = "Article"
        verbose_name_plural = "Articles"
        ordering = ["entreprise", "nom"]

    def __str__(self):
        return f"{self.nom} ({self.quantite_stock} {self.unite})"

    @property
    def est_en_alerte(self):
        """Retourne True si le stock est en dessous du seuil d'alerte."""
        return self.quantite_stock <= self.seuil_alerte


class Fournisseur(models.Model):
    """
    Un fournisseur d'articles pour l'entreprise.
    """

    entreprise = models.ForeignKey(
        "accounts.Entreprise",
        verbose_name="Entreprise",
        related_name="fournisseurs",
        on_delete=models.CASCADE,
    )

    nom = models.CharField("Nom", max_length=150)
    contact = models.CharField("Contact", max_length=100, blank=True)
    adresse = models.CharField("Adresse", max_length=255, blank=True)
    telephone = models.CharField("Téléphone", max_length=30, blank=True)
    email = models.EmailField("Email", blank=True)

    class Meta:
        verbose_name = "Fournisseur"
        verbose_name_plural = "Fournisseurs"
        ordering = ["entreprise", "nom"]

    def __str__(self):
        return f"{self.nom} ({self.entreprise.nom})"


class MouvementStock(models.Model):
    """
    Un mouvement de stock (entrée ou sortie).

    - Entrée : réception d'articles d'un fournisseur
    - Sortie : consommation sur un chantier
    """

    article = models.ForeignKey(
        Article,
        verbose_name="Article",
        related_name="mouvements",
        on_delete=models.CASCADE,
    )
    chantier = models.ForeignKey(
        "chantiers.Chantier",
        verbose_name="Chantier",
        related_name="mouvements_stock",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    fournisseur = models.ForeignKey(
        Fournisseur,
        verbose_name="Fournisseur",
        related_name="mouvements",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    TYPE_CHOICES = [
        ("entree", "Entrée"),
        ("sortie", "Sortie"),
    ]
    type_mouvement = models.CharField("Type", max_length=10, choices=TYPE_CHOICES)
    quantite = models.DecimalField("Quantité", max_digits=12, decimal_places=2)
    date_mouvement = models.DateField("Date", default=timezone.now)
    motif = models.TextField("Motif", blank=True)
    prix_unitaire = models.DecimalField("Prix unitaire", max_digits=10, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Mouvement de stock"
        verbose_name_plural = "Mouvements de stock"
        ordering = ["-date_mouvement"]

    def __str__(self):
        return f"{self.get_type_mouvement_display()} — {self.article.nom} ({self.quantite})"
