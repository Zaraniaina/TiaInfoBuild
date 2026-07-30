"""
Middleware multi-tenant pour TIA INFO BUILD.

Ce middleware injecte ``request.entreprise`` sur chaque requête afin que les
vues et les modèles puissent facilement isoler les données par entreprise
( SaaS multi-tenant ).

Règles :
- Un super-utilisateur (is_superuser) n'est rattaché à aucune entreprise
  (request.entreprise = None) → il voit l'ensemble des données.
- Un utilisateur normal possède une clé étrangère ``entreprise`` → on la
  charge en une seule requête grâce à select_related.
- Si l'utilisateur n'est pas authentifié, request.entreprise = None.
"""

from django.utils.deprecation import MiddlewareMixin


class EntrepriseMiddleware(MiddlewareMixin):
    """Injecte la propriété ``entreprise`` sur l'objet request."""

    def process_request(self, request):
        # Par défaut, aucune entreprise (super-admin ou anonyme)
        request.entreprise = None

        if request.user.is_authenticated:
            # Super-admin : pas d'entreprise rattachée → accès global
            if request.user.is_superuser:
                request.entreprise = None
            else:
                # On récupère l'entreprise rattachée à l'utilisateur
                # (déjà chargée via select_related dans le manager si possible)
                request.entreprise = getattr(request.user, "entreprise", None)
