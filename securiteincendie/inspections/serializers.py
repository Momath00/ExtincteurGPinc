from django.conf import settings
from rest_framework import serializers

from api.serializers import UtilisateurSerializer
from accounts.models import Utilisateur
from .models import (
    CODES_NON_CONFORMITES,
    Batiment,
    BoyauItem,
    CertificatExtincteur,
    Client,
    ExtincteurItem,
    HistoriqueRapportExtincteur,
    RapportExtincteur,
    SectionExtincteurs,
)


class ClientSerializer(serializers.ModelSerializer):
    nb_batiments = serializers.SerializerMethodField()
    mode_livraison_display = serializers.CharField(source="get_mode_livraison_display", read_only=True)

    def get_nb_batiments(self, obj):
        return obj.batiments.count()

    class Meta:
        model = Client
        fields = [
            "id", "nom", "contact_nom", "contact_email", "contact_telephone", "contact_cellulaire",
            "adresse", "ville", "code_postal", "mode_livraison", "mode_livraison_display", "nb_batiments", "date_creation",
        ]


class BatimentSerializer(serializers.ModelSerializer):
    adresse_complete = serializers.CharField(read_only=True)
    client_nom = serializers.CharField(source="client.nom", read_only=True)
    client_mode_livraison = serializers.CharField(source="client.mode_livraison", read_only=True)
    client_contact_email = serializers.CharField(source="client.contact_email", read_only=True)
    proprietaire = UtilisateurSerializer(read_only=True)
    proprietaire_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    # Bloc « Facturer à » du rapport.
    client_facturation = serializers.SerializerMethodField()

    def get_client_facturation(self, obj):
        c = obj.client
        return {
            "nom": c.nom,
            "adresse": c.adresse,
            "ville": c.ville,
            "code_postal": c.code_postal,
            "contact_nom": c.contact_nom,
            "contact_telephone": c.contact_telephone,
            "contact_cellulaire": c.contact_cellulaire,
            "contact_email": c.contact_email,
        }

    class Meta:
        model = Batiment
        fields = [
            "id", "client", "client_nom", "client_mode_livraison", "client_contact_email", "client_facturation",
            "nom", "numero_civique", "rue", "ville", "province", "code_postal",
            "adresse_complete", "direction",
            "type_application", "proprietaire", "proprietaire_id", "date_creation",
        ]


class ExtincteurItemSerializer(serializers.ModelSerializer):
    format_display = serializers.CharField(source="get_format_display", read_only=True)
    type_extincteur_display = serializers.CharField(source="get_type_extincteur_display", read_only=True)
    marque_display = serializers.CharField(source="get_marque_display", read_only=True)
    etat_display = serializers.CharField(source="get_etat_display", read_only=True)

    def validate_non_conformites(self, valeur):
        if not isinstance(valeur, list):
            raise serializers.ValidationError("Liste de codes attendue.")
        inconnus = [c for c in valeur if c not in CODES_NON_CONFORMITES]
        if inconnus:
            raise serializers.ValidationError(f"Code(s) inconnu(s) : {', '.join(map(str, inconnus))}")
        # Ordre de la légende, sans doublon.
        return [c for c in CODES_NON_CONFORMITES if c in valeur]

    def validate(self, attrs):
        section = attrs.get("section")
        if section and self.instance and section.rapport_id != self.instance.rapport_id:
            raise serializers.ValidationError({"section": "Cette section appartient à un autre rapport."})
        return attrs

    class Meta:
        model = ExtincteurItem
        fields = [
            "id", "rapport", "section", "ordre", "numero", "etage", "numero_serie", "etat", "etat_display",
            "emplacement", "code_equipement", "non_conformites", "modele", "date_fabrication", "format", "format_display", "type_extincteur", "type_extincteur_display",
            "marque", "marque_display", "prochaine_maintenance",
            "dernier_test_hydrostatique", "prochain_test_hydrostatique", "remarque",
        ]
        read_only_fields = ["rapport"]


class SectionExtincteursSerializer(serializers.ModelSerializer):
    class Meta:
        model = SectionExtincteurs
        fields = ["id", "rapport", "nom", "note", "ordre"]
        read_only_fields = ["rapport"]


class BoyauItemSerializer(serializers.ModelSerializer):
    longueur_display = serializers.CharField(source="get_longueur_display", read_only=True)
    etat_display = serializers.CharField(source="get_etat_display", read_only=True)

    class Meta:
        model = BoyauItem
        fields = [
            "id", "rapport", "ordre", "etage", "etat", "etat_display", "emplacement",
            "longueur", "longueur_display", "date_fabrication",
            "prochain_test_hydrostatique", "remarque",
        ]
        read_only_fields = ["rapport"]


class CertificatExtincteurSerializer(serializers.ModelSerializer):
    class Meta:
        model = CertificatExtincteur
        fields = ["id", "numero", "date_emission", "emis_par", "certificat_envoye", "mode_envoi", "date_envoi", "envoye_a"]


class HistoriqueRapportExtincteurSerializer(serializers.ModelSerializer):
    utilisateur = UtilisateurSerializer(read_only=True)

    class Meta:
        model = HistoriqueRapportExtincteur
        fields = ["id", "utilisateur", "description", "date_heure"]


class RapportExtincteurListSerializer(serializers.ModelSerializer):
    """Version allégée — pour les listes."""

    batiment = BatimentSerializer(read_only=True)
    techniciens = UtilisateurSerializer(many=True, read_only=True)
    citoyen = UtilisateurSerializer(read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    frequence_display = serializers.CharField(source="get_frequence_display", read_only=True)
    nb_extincteurs = serializers.SerializerMethodField()
    certificat = serializers.SerializerMethodField()
    rapport_eclairage_lie = serializers.SerializerMethodField()

    def get_nb_extincteurs(self, obj):
        return obj.extincteurs.count()

    def get_certificat(self, obj):
        try:
            c = obj.certificat
            return {"numero": c.numero, "certificat_envoye": c.certificat_envoye}
        except Exception:
            return None

    def get_rapport_eclairage_lie(self, obj):
        if not settings.MODULE_ECLAIRAGE:
            return None
        eclairage = getattr(obj, "rapport_eclairage_lie", None)
        if eclairage is None:
            return None
        return {"id": eclairage.id, "statut": eclairage.statut}

    class Meta:
        model = RapportExtincteur
        fields = [
            "id", "batiment", "techniciens", "citoyen", "numero_job", "frequence", "frequence_display",
            "statut", "statut_display", "date_inspection", "date_derniere_sauvegarde",
            "date_fermeture", "nb_extincteurs", "certificat", "rapport_eclairage_lie",
        ]


class RapportExtincteurDetailSerializer(RapportExtincteurListSerializer):
    cree_par = UtilisateurSerializer(read_only=True)
    sections = SectionExtincteursSerializer(many=True, read_only=True)
    extincteurs = ExtincteurItemSerializer(many=True, read_only=True)
    boyaux = BoyauItemSerializer(many=True, read_only=True)
    historique = HistoriqueRapportExtincteurSerializer(many=True, read_only=True)
    certificat = CertificatExtincteurSerializer(read_only=True)

    class Meta(RapportExtincteurListSerializer.Meta):
        fields = RapportExtincteurListSerializer.Meta.fields + [
            "cree_par", "sections", "extincteurs", "boyaux", "historique", "certificat",
        ]


class RapportExtincteurCreateSerializer(serializers.ModelSerializer):
    """Utilisé par le superviseur — création automatique (liée) ou manuelle."""

    techniciens = serializers.PrimaryKeyRelatedField(
        many=True, required=False,
        queryset=Utilisateur.objects.filter(role=Utilisateur.Role.TECHNICIEN),
    )
    citoyen = serializers.PrimaryKeyRelatedField(
        required=False, allow_null=True,
        queryset=Utilisateur.objects.filter(role=Utilisateur.Role.CITOYEN),
    )

    class Meta:
        model = RapportExtincteur
        fields = ["id", "batiment", "techniciens", "citoyen", "numero_job", "frequence", "date_inspection"]
        read_only_fields = ["id"]
