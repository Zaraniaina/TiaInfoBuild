from django.apps import AppConfig


class StocksConfig(AppConfig):
    """Module Gestion des Stocks — articles, fournisseurs, mouvements de stock."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'stocks'
