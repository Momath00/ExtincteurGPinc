from rest_framework import serializers

from api.serializers import UtilisateurSerializer
from accounts.models import Utilisateur
from inspections.serializers import BatimentSerializer
from .models import EclairageItem, HistoriqueRapportEclairage, RapportEclairage


class EclairageItemSerializer(serializers.ModelSerializer):
    etat_display = serializers.CharField(source="get_etat_display", read_only=True)

    class Meta:
        model = EclairageItem
        fields = [
            "id", "rapport", "ordre", "emplacement", "etage",
            "modele", "voltage", "etat", "etat_display", "remarque",
        ]
        read_only_fields = ["rapport"]


class HistoriqueRapportEclairageSerializer(serializers.ModelSerializer):
    utilisateur = UtilisateurSerializer(read_only=True)

    class Meta:
        model = HistoriqueRapportEclairage
        fields = ["id", "utilisateur", "description", "date_heure"]


class RapportEclairageListSerializer(serializers.ModelSerializer):
    """Version allégée — pour les listes."""

    batiment = BatimentSerializer(read_only=True)
    techniciens = UtilisateurSerializer(many=True, read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    nb_lumieres = serializers.SerializerMethodField()
    rapport_extincteur_id = serializers.IntegerField(source="rapport_extincteur.id", read_only=True, default=None)

    def get_nb_lumieres(self, obj):
        return obj.lumieres.count()

    class Meta:
        model = RapportEclairage
        fields = [
            "id", "batiment", "techniciens", "numero_job",
            "statut", "statut_display", "date_inspection", "date_derniere_sauvegarde",
            "date_fermeture", "nb_lumieres", "rapport_extincteur_id",
        ]


class RapportEclairageDetailSerializer(RapportEclairageListSerializer):
    cree_par = UtilisateurSerializer(read_only=True)
    lumieres = EclairageItemSerializer(many=True, read_only=True)
    historique = HistoriqueRapportEclairageSerializer(many=True, read_only=True)

    class Meta(RapportEclairageListSerializer.Meta):
        fields = RapportEclairageListSerializer.Meta.fields + [
            "cree_par", "lumieres", "historique",
        ]


class RapportEclairageCreateSerializer(serializers.ModelSerializer):
    """Utilisé par le superviseur — création manuelle."""

    techniciens = serializers.PrimaryKeyRelatedField(
        many=True, required=False,
        queryset=Utilisateur.objects.filter(role=Utilisateur.Role.TECHNICIEN),
    )

    class Meta:
        model = RapportEclairage
        fields = ["id", "batiment", "techniciens", "numero_job", "date_inspection"]
        read_only_fields = ["id"]
