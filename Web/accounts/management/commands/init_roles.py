from django.core.management.base import BaseCommand

from accounts.models import Role


class Command(BaseCommand):
    help = "Crée les rôles applicatifs de base (idempotent)."

    def handle(self, *args, **options):
        roles = [
            (Role.ADMINISTRATEUR, "Administrateur", "Accès complet à la plateforme et à la configuration."),
            (Role.DIRECTEUR, "Directeur", "Pilotage global : chantiers, finances, ressources."),
            (Role.CHEF_CHANTIER, "Chef de chantier", "Saisie terrain : avancement, incidents, présence."),
            (Role.COMPTABLE, "Comptable / Gestionnaire", "Gestion financière, devis, factures, paiements."),
            (Role.MAGASINIER, "Magasinier", "Gestion des stocks et des mouvements de matériel."),
            (Role.EMPLOYE, "Employé de terrain", "Accès limité : pointage et informations personnelles."),
            (Role.CLIENT, "Client", "Accès restreint à ses propres chantiers, devis et factures."),
        ]
        for code, nom, description in roles:
            role, created = Role.objects.get_or_create(code=code, defaults={"nom": nom, "description": description})
            statut = "créé" if created else "déjà présent"
            self.stdout.write(self.style.SUCCESS(f"Rôle « {role.nom} » : {statut}."))
