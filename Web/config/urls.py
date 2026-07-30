"""
URLs racines du projet TIA INFO BUILD.

Inclut les URLs de toutes les applications :
- accounts : authentification, inscription, gestion utilisateurs
- core : dashboard, administration plateforme
- chantiers : gestion des chantiers
- rh : ressources humaines
- materiels : gestion des matériels
- stocks : gestion des stocks
- commercial : module commercial
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('comptes/', include('accounts.urls')),
    path('', include('core.urls')),
    path('chantiers/', include('chantiers.urls')),
    path('rh/', include('rh.urls')),
    path('materiels/', include('materiels.urls')),
    path('stocks/', include('stocks.urls')),
    path('commercial/', include('commercial.urls')),
    path('api/', include('api.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
