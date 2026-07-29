from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    path("connexion/", views.ConnexionView.as_view(), name="login"),
    path("inscription/", views.InscriptionView.as_view(), name="inscription"),
    path("deconnexion/", views.DeconnexionView.as_view(), name="logout"),
    path("profil/", views.ProfilView.as_view(), name="profil"),
    path("utilisateurs/", views.UtilisateurListView.as_view(), name="utilisateur_liste"),
    path("utilisateurs/nouveau/", views.UtilisateurCreateView.as_view(), name="utilisateur_creer"),
    path("utilisateurs/<int:pk>/modifier/", views.UtilisateurUpdateView.as_view(), name="utilisateur_modifier"),
    path("utilisateurs/<int:pk>/statut/", views.UtilisateurToggleStatutView.as_view(), name="utilisateur_statut"),
]
