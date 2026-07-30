from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Entreprise, Role, Utilisateur


@admin.register(Entreprise)
class EntrepriseAdmin(admin.ModelAdmin):
    list_display = ("nom", "abonnement", "est_active", "date_creation")
    list_filter = ("abonnement", "est_active")
    search_fields = ("nom", "email")


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("nom", "code")


@admin.register(Utilisateur)
class UtilisateurAdmin(UserAdmin):
    model = Utilisateur
    ordering = ("-date_creation",)
    list_display = ("email", "first_name", "last_name", "role", "entreprise", "statut", "is_staff")
    list_filter = ("statut", "role", "entreprise", "is_staff")
    search_fields = ("email", "first_name", "last_name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Informations personnelles", {"fields": ("first_name", "last_name", "telephone", "photo")}),
        ("Organisation", {"fields": ("entreprise", "role", "statut")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_creation")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "password1", "password2", "entreprise", "role"),
        }),
    )
    readonly_fields = ("date_creation",)
