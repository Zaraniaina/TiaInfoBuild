from django.apps import AppConfig


class CommercialConfig(AppConfig):
    """Module Commercial — clients, devis, contrats, factures, paiements."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'commercial'
