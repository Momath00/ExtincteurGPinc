from django.contrib import admin

from .models import EclairageItem, HistoriqueRapportEclairage, RapportEclairage


class EclairageItemInline(admin.TabularInline):
    model = EclairageItem
    extra = 0


class HistoriqueRapportEclairageInline(admin.TabularInline):
    model = HistoriqueRapportEclairage
    extra = 0
    readonly_fields = ("utilisateur", "description", "date_heure")
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(RapportEclairage)
class RapportEclairageAdmin(admin.ModelAdmin):
    list_display = ("batiment", "statut", "liste_techniciens", "date_inspection", "date_fermeture")
    list_filter = ("statut", "batiment__client")
    filter_horizontal = ("techniciens",)
    inlines = [EclairageItemInline, HistoriqueRapportEclairageInline]

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
