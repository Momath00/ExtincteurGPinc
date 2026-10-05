from django.contrib import admin

from .models import (
    Batiment,
    CertificatExtincteur,
    Client,
    ExtincteurItem,
    HistoriqueRapportExtincteur,
    RapportExtincteur,
)


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("nom", "contact_nom", "contact_email", "contact_telephone")
    search_fields = ("nom", "contact_nom", "contact_email")


@admin.register(Batiment)
class BatimentAdmin(admin.ModelAdmin):
    list_display = ("adresse_complete", "client", "ville", "direction", "type_application", "proprietaire")
    list_filter = ("client", "ville", "direction", "type_application")
    search_fields = ("numero_civique", "rue", "ville")


class ExtincteurItemInline(admin.TabularInline):
    model = ExtincteurItem
    extra = 0


class HistoriqueRapportExtincteurInline(admin.TabularInline):
    model = HistoriqueRapportExtincteur
    extra = 0
    readonly_fields = ("utilisateur", "description", "date_heure")
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(RapportExtincteur)
class RapportExtincteurAdmin(admin.ModelAdmin):
    list_display = ("batiment", "statut", "liste_techniciens", "citoyen", "date_inspection", "date_fermeture")
    list_filter = ("statut", "batiment__client")
    filter_horizontal = ("techniciens",)
    inlines = [ExtincteurItemInline, HistoriqueRapportExtincteurInline]

    def liste_techniciens(self, obj):
        return ", ".join(t.username for t in obj.techniciens.all()) or "—"
    liste_techniciens.short_description = "Techniciens"

    def save_model(self, request, obj, form, change):
        """Historise la création/modification faite depuis l'admin."""
        nouveau = obj.pk is None
        super().save_model(request, obj, form, change)
        if nouveau:
            obj.historiser(request.user, "Rapport créé (admin)")
        else:
            obj.historiser(request.user, "Rapport modifié (admin)")


@admin.register(CertificatExtincteur)
class CertificatExtincteurAdmin(admin.ModelAdmin):
    list_display = ("numero", "rapport", "date_emission", "emis_par")
    readonly_fields = ("numero", "date_emission")
