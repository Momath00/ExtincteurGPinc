from rest_framework import serializers

from api.serializers import UtilisateurSerializer
from accounts.models import Utilisateur
from .models import (
    Batiment,
    BoyauItem,
    CertificatCuisine,
    CertificatExtincteur,
    Client,
    ExtincteurItem,
    HistoriqueRapportCuisine,
    HistoriqueRapportExtincteur,
    HotteCuisine,
    RapportCuisine,
    RapportExtincteur,
)


class ClientSerializer(serializers.ModelSerializer):
    nb_batiments = serializers.SerializerMethodField()
    mode_livraison_display = serializers.CharField(source="get_mode_livraison_display", read_only=True)

    def get_nb_batiments(self, obj):
        return obj.batiments.count()

    class Meta:
        model = Client
        fields = [
            "id", "nom", "contact_nom", "contact_email", "contact_telephone",
            "adresse", "mode_livraison", "mode_livraison_display", "nb_batiments", "date_creation",
        ]


class BatimentSerializer(serializers.ModelSerializer):
    adresse_complete = serializers.CharField(read_only=True)
    client_nom = serializers.CharField(source="client.nom", read_only=True)
    client_mode_livraison = serializers.CharField(source="client.mode_livraison", read_only=True)
    client_contact_email = serializers.CharField(source="client.contact_email", read_only=True)
    proprietaire = UtilisateurSerializer(read_only=True)
    proprietaire_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Batiment
        fields = [
            "id", "client", "client_nom", "client_mode_livraison", "client_contact_email", "numero_civique", "rue", "ville", "code_postal",
            "adresse_complete", "direction",
            "type_application", "proprietaire", "proprietaire_id", "date_creation",
        ]


class ExtincteurItemSerializer(serializers.ModelSerializer):
    format_display = serializers.CharField(source="get_format_display", read_only=True)
    type_extincteur_display = serializers.CharField(source="get_type_extincteur_display", read_only=True)
    marque_display = serializers.CharField(source="get_marque_display", read_only=True)
    etat_display = serializers.CharField(source="get_etat_display", read_only=True)

    class Meta:
        model = ExtincteurItem
        fields = [
            "id", "rapport", "ordre", "etage", "etat", "etat_display", "emplacement", "date_fabrication",
            "format", "format_display", "type_extincteur", "type_extincteur_display",
            "marque", "marque_display", "prochaine_maintenance",
            "prochain_test_hydrostatique", "remarque",
        ]
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
    nb_extincteurs = serializers.SerializerMethodField()
    certificat = serializers.SerializerMethodField()
    rapport_eclairage_lie = serializers.SerializerMethodField()
    rapport_cuisine_lie = serializers.SerializerMethodField()

    def get_nb_extincteurs(self, obj):
        return obj.extincteurs.count()

    def get_certificat(self, obj):
        try:
            c = obj.certificat
            return {"numero": c.numero, "certificat_envoye": c.certificat_envoye}
        except Exception:
            return None

    def get_rapport_eclairage_lie(self, obj):
        eclairage = getattr(obj, "rapport_eclairage_lie", None)
        if eclairage is None:
            return None
        return {"id": eclairage.id, "statut": eclairage.statut}

    def get_rapport_cuisine_lie(self, obj):
        cuisine = getattr(obj, "rapport_cuisine_lie", None)
        if cuisine is None:
            return None
        return {"id": cuisine.id, "statut": cuisine.statut}

    class Meta:
        model = RapportExtincteur
        fields = [
            "id", "batiment", "techniciens", "citoyen", "numero_job",
            "statut", "statut_display", "date_inspection", "date_derniere_sauvegarde",
            "date_fermeture", "nb_extincteurs", "certificat", "rapport_eclairage_lie",
            "rapport_cuisine_lie",
        ]


class RapportExtincteurDetailSerializer(RapportExtincteurListSerializer):
    cree_par = UtilisateurSerializer(read_only=True)
    extincteurs = ExtincteurItemSerializer(many=True, read_only=True)
    boyaux = BoyauItemSerializer(many=True, read_only=True)
    historique = HistoriqueRapportExtincteurSerializer(many=True, read_only=True)
    certificat = CertificatExtincteurSerializer(read_only=True)

    class Meta(RapportExtincteurListSerializer.Meta):
        fields = RapportExtincteurListSerializer.Meta.fields + [
            "cree_par", "extincteurs", "boyaux", "historique", "certificat",
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
        fields = ["id", "batiment", "techniciens", "citoyen", "numero_job", "date_inspection"]
        read_only_fields = ["id"]


# ── Système d'extinction de cuisine (hotte) ────────────────────────────────


class HotteCuisineSerializer(serializers.ModelSerializer):
    class Meta:
        model = HotteCuisine
        fields = ["id", "rapport", "ordre", "label", "nombre_buses", "buses", "elevations", "appareils", "dividers", "tailles"]
        read_only_fields = ["rapport"]


class CertificatCuisineSerializer(serializers.ModelSerializer):
    class Meta:
        model = CertificatCuisine
        fields = ["id", "numero", "date_emission", "emis_par", "certificat_envoye", "mode_envoi", "date_envoi", "envoye_a"]


class HistoriqueRapportCuisineSerializer(serializers.ModelSerializer):
    utilisateur = UtilisateurSerializer(read_only=True)

    class Meta:
        model = HistoriqueRapportCuisine
        fields = ["id", "utilisateur", "description", "date_heure"]


class RapportCuisineListSerializer(serializers.ModelSerializer):
    """Version allégée — pour les listes."""

    batiment = BatimentSerializer(read_only=True)
    techniciens = UtilisateurSerializer(many=True, read_only=True)
    citoyen = UtilisateurSerializer(read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    type_agent_display = serializers.CharField(source="get_type_agent_display", read_only=True)
    dispositif_coupure_display = serializers.CharField(source="get_dispositif_coupure_display", read_only=True)
    nb_hottes = serializers.SerializerMethodField()
    rapport_extincteur_id = serializers.IntegerField(source="rapport_extincteur.id", read_only=True, default=None)
    certificat = serializers.SerializerMethodField()
    est_conforme = serializers.BooleanField(read_only=True)
    nb_verifications_conformes = serializers.IntegerField(read_only=True)

    def get_nb_hottes(self, obj):
        return obj.hottes.count()

    def get_certificat(self, obj):
        try:
            c = obj.certificat
            return {"numero": c.numero, "certificat_envoye": c.certificat_envoye}
        except Exception:
            return None

    class Meta:
        model = RapportCuisine
        fields = [
            "id", "batiment", "techniciens", "citoyen", "numero_job",
            "statut", "statut_display", "date_inspection", "date_derniere_sauvegarde",
            "date_fermeture", "nb_hottes", "rapport_extincteur_id", "certificat",
            "courtier", "fabricant", "modele", "numero_serie", "date_installation",
            "type_agent", "type_agent_display", "alimentation",
            "dispositif_coupure", "dispositif_coupure_display",
            "nombre_buses", "liens_fusibles_360f", "liens_fusibles_450f", "liens_fusibles_500f",
            "buses_liens_fusibles",
            "date_dernier_essai_hydrostatique", "date_derniere_recharge",
            "prochaine_inspection", "raccordement", "conforme_recommandations",
            "est_conforme", "nb_verifications_conformes",
        ]


class RapportCuisineDetailSerializer(RapportCuisineListSerializer):
    cree_par = UtilisateurSerializer(read_only=True)
    hottes = HotteCuisineSerializer(many=True, read_only=True)
    historique = HistoriqueRapportCuisineSerializer(many=True, read_only=True)
    certificat = CertificatCuisineSerializer(read_only=True)

    class Meta(RapportCuisineListSerializer.Meta):
        fields = RapportCuisineListSerializer.Meta.fields + [
            "cree_par", "hottes", "historique", "certificat", "commentaires",
        ] + RapportCuisine.CHAMPS_VERIFICATION


class RapportCuisineCreateSerializer(serializers.ModelSerializer):
    """Utilisé pour la création et la mise à jour (infos système + checklist
    inclus — pas de sous-endpoint « fiche » séparé)."""

    techniciens = serializers.PrimaryKeyRelatedField(
        many=True, required=False,
        queryset=Utilisateur.objects.filter(role=Utilisateur.Role.TECHNICIEN),
    )
    citoyen = serializers.PrimaryKeyRelatedField(
        required=False, allow_null=True,
        queryset=Utilisateur.objects.filter(role=Utilisateur.Role.CITOYEN),
    )

    class Meta:
        model = RapportCuisine
        fields = [
            "id", "batiment", "techniciens", "citoyen", "numero_job", "date_inspection",
            "courtier", "fabricant", "modele", "numero_serie", "date_installation",
            "type_agent", "alimentation", "dispositif_coupure",
            "nombre_buses", "liens_fusibles_360f", "liens_fusibles_450f", "liens_fusibles_500f",
            "buses_liens_fusibles",
            "date_dernier_essai_hydrostatique", "date_derniere_recharge",
            "prochaine_inspection", "raccordement", "commentaires", "conforme_recommandations",
        ] + RapportCuisine.CHAMPS_VERIFICATION
        read_only_fields = ["id"]
