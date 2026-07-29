from django.apps import AppConfig


class MaterielsConfig(AppConfig):
    """Module Gestion des Matériels — inventaire, affectation, maintenance, alertes."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'materiels'
