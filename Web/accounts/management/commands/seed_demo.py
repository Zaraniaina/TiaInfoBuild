"""
Commande de création de données de démonstration.

Crée :
- Un super-administrateur (admin@tia-build.mg / admin123)
- Une entreprise de démonstration avec son administrateur
- Des chantiers, employés, matériels, articles et clients

Usage :
    python manage.py seed_demo
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from datetime import date, timedelta

from accounts.models import Utilisateur, Role, Entreprise
from chantiers.models import Chantier, Phase, Incident
from rh.models import Employe, Equipe
from materiels.models import Materiel, Maintenance
from stocks.models import Article, Fournisseur, MouvementStock
from commercial.models import Client, Devis, Facture

User = get_user_model()


class Command(BaseCommand):
    help = "Crée des données de démonstration pour TIA INFO BUILD"

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING("Création des données de démonstration..."))

        # ─── Super-administrateur ───
        if not User.objects.filter(email="admin@tia-build.mg").exists():
            User.objects.create_superuser(
                email="admin@tia-build.mg",
                password="admin123",
                first_name="Super",
                last_name="Admin",
            )
            self.stdout.write(self.style.SUCCESS("  ✓ Super-admin créé : admin@tia-build.mg / admin123"))

        # ─── Rôles ───
        roles = [
            (Role.ADMINISTRATEUR, "Administrateur", "Accès complet"),
            (Role.DIRECTEUR, "Directeur", "Gestion de l'entreprise"),
            (Role.CHEF_CHANTIER, "Chef de chantier", "Pilotage de chantier"),
            (Role.EMPLOYE, "Employé", "Accès restreint"),
        ]
        for code, nom, desc in roles:
            Role.objects.get_or_create(code=code, defaults={"nom": nom, "description": desc})

        # ─── Entreprise de démonstration ───
        entreprise, created = Entreprise.objects.get_or_create(
            nom="BTP Construction Madagascar",
            defaults={
                "adresse": "123 Avenue de l'Indépendance, Antananarivo",
                "telephone": "+261 20 00 000 00",
                "email": "contact@btp-madagascar.mg",
                "abonnement": "premium",
                "est_active": True,
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"  ✓ Entreprise créée : {entreprise.nom}"))

        # ─── Administrateur de l'entreprise ───
        if not Utilisateur.objects.filter(email="admin@btp-madagascar.mg").exists():
            Utilisateur.objects.create_user(
                email="admin@btp-madagascar.mg",
                password="admin123",
                first_name="Jean",
                last_name="Rakoto",
                entreprise=entreprise,
                role=Role.objects.get(code=Role.ADMINISTRATEUR),
                statut="actif",
            )
            self.stdout.write(self.style.SUCCESS("  ✓ Admin entreprise créé : admin@btp-madagascar.mg / admin123"))

        # ─── Chantiers ───
        chantier1 = Chantier.objects.get_or_create(
            entreprise=entreprise,
            nom="Construction Maison Victoire",
            defaults={
                "adresse": "45 Rue du Lac, Antsirabe",
                "description": "Construction d'une maison de 200m²",
                "date_debut": date.today() - timedelta(days=30),
                "date_fin_prevue": date.today() + timedelta(days=60),
                "budget_prevu": 25000000,
                "budget_reel": 12000000,
                "statut": "actif",
            },
        )[0]

        chantier2 = Chantier.objects.get_or_create(
            entreprise=entreprise,
            nom="Rénovation Hôtel Palmier",
            defaults={
                "adresse": "12 Boulevard du 26 Décembre, Fianarantsoa",
                "description": "Rénovation complète d'un hôtel 3 étoiles",
                "date_debut": date.today() - timedelta(days=15),
                "date_fin_prevue": date.today() + timedelta(days=45),
                "budget_prevu": 45000000,
                "budget_reel": 8000000,
                "statut": "actif",
            },
        )[0]

        # ─── Phases ───
        Phase.objects.get_or_create(
            chantier=chantier1, nom="Fondations",
            defaults={"date_debut": date.today() - timedelta(days=30), "date_fin": date.today() - timedelta(days=15),
                       "avancement_pct": 100, "ordre": 1, "statut": "terminee"}
        )
        Phase.objects.get_or_create(
            chantier=chantier1, nom="Charpente",
            defaults={"date_debut": date.today() - timedelta(days=15), "date_fin": date.today() + timedelta(days=30),
                       "avancement_pct": 60, "ordre": 2, "statut": "en_cours"}
        )

        # ─── Employés ───
        Employe.objects.get_or_create(
            entreprise=entreprise, matricule="EMP001",
            defaults={"nom": "Rakoto", "prenom": "Mbola", "poste": "Maçon",
                       "date_embauche": date.today() - timedelta(days=365), "salaire_base": 350000, "statut": "actif"}
        )
        Employe.objects.get_or_create(
            entreprise=entreprise, matricule="EMP002",
            defaults={"nom": "Rasoamanarivo", "prenom": "Andry", "poste": "Électricien",
                       "date_embauche": date.today() - timedelta(days=200), "salaire_base": 420000, "statut": "actif"}
        )

        # ─── Matériels ───
        Materiel.objects.get_or_create(
            entreprise=entreprise, numero_serie="MAT001",
            defaults={"nom": "Pelle électrique", "type": "Excavatrice", "date_acquisition": date.today() - timedelta(days=180),
                       "valeur_achat": 8500000, "statut": "disponible"}
        )
        Materiel.objects.get_or_create(
            entreprise=entreprise, numero_serie="MAT002",
            defaults={"nom": "Bétonnière", "type": "Béton", "date_acquisition": date.today() - timedelta(days=120),
                       "valeur_achat": 3200000, "statut": "en_maintenance"}
        )

        # ─── Articles / Stocks ───
        ciment = Article.objects.get_or_create(
            entreprise=entreprise, nom="Ciment CPA 30",
            defaults={"categorie": "Matière première", "unite": "sac", "seuil_alerte": 50,
                       "quantite_stock": 120, "prix_unitaire": 12000}
        )[0]
        Article.objects.get_or_create(
            entreprise=entreprise, nom="Sable de rivière",
            defaults={"categorie": "Matière première", "unite": "m³", "seuil_alerte": 10,
                       "quantite_stock": 25, "prix_unitaire": 85000}
        )

        # ─── Fournisseurs ───
        Fournisseur.objects.get_or_create(
            entreprise=entreprise, nom="Cimenterie du Madagasikara",
            defaults={"contact": "Pierre Andry", "telephone": "+261 34 00 000 00", "email": "contact@cmd.mg"}
        )

        # ─── Mouvement de stock ───
        MouvementStock.objects.get_or_create(
            article=ciment, fournisseur=Fournisseur.objects.first(),
            defaults={"type_mouvement": "entree", "quantite": 120, "date_mouvement": date.today() - timedelta(days=5),
                       "motif": "Réception fournisseur", "prix_unitaire": 12000}
        )

        # ─── Clients ───
        Client.objects.get_or_create(
            entreprise=entreprise, nom="Société Immobilière Victoire",
            defaults={"type": "entreprise", "adresse": "78 Avenue du 14 Juillet, Antananarivo",
                       "telephone": "+261 33 00 000 00", "email": "contact@siv.mg"}
        )

        # ─── Devis ───
        client = Client.objects.first()
        Devis.objects.get_or_create(
            entreprise=entreprise, client=client,
            defaults={"date_creation": date.today() - timedelta(days=10),
                       "date_validite": date.today() + timedelta(days=20),
                       "montant_total": 25000000, "statut": "en_cours"}
        )

        self.stdout.write(self.style.SUCCESS("\n✓ Données de démonstration créées avec succès !"))
        self.stdout.write(self.style.WARNING("\nComptes de démonstration :"))
        self.stdout.write("  Super-admin : admin@tia-build.mg / admin123")
        self.stdout.write("  Entreprise  : admin@btp-madagascar.mg / admin123")
