from django.apps import AppConfig


class ChantiersConfig(AppConfig):
    """Module Gestion des Chantiers — cœur du système BTP.

    Gère les chantiers de construction, leurs phases, les incidents
    et l'affectation des ressources (employés et matériels).
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'chantiers'
