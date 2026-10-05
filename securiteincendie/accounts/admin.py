from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import CodeVerification, Utilisateur


@admin.register(Utilisateur)
class UtilisateurAdmin(UserAdmin):
    list_display = ("username", "email", "role", "est_actif", "mdp_temporaire", "date_creation")
    list_filter = ("role", "est_actif", "mdp_temporaire")
    fieldsets = UserAdmin.fieldsets + (
        (
            "Extincteurs Nationex",
            {
                "fields": (
                    "role",
                    "telephone",
                    "permis_recq",
                    "est_actif",
                    "mdp_temporaire",
                    "invite_par",
                )
            },
        ),
    )


@admin.register(CodeVerification)
class CodeVerificationAdmin(admin.ModelAdmin):
    list_display = ("email", "code", "utilise", "date_creation")
    list_filter = ("utilise",)