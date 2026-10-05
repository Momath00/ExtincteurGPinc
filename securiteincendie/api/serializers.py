from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from accounts.models import Utilisateur


class UtilisateurSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = Utilisateur
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "role_display",
            "telephone",
            "permis_recq",
            "est_actif",
            "mdp_temporaire",
            "date_creation",
        ]
        read_only_fields = ["est_actif", "mdp_temporaire", "date_creation"]


# ── Invitation par le Superviseur (Technicien ou Citoyen) ──────────────────
class InviterUtilisateurSerializer(serializers.Serializer):
    username = serializers.CharField()
    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=[
            Utilisateur.Role.SUPERVISEUR,
            Utilisateur.Role.TECHNICIEN,
            Utilisateur.Role.CITOYEN,
        ]
    )
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    telephone = serializers.CharField(required=False, allow_blank=True)
    permis_recq = serializers.CharField(required=False, allow_blank=True)

    def validate_username(self, value):
        if Utilisateur.objects.filter(username=value).exists():
            raise serializers.ValidationError("Ce nom d'utilisateur est déjà utilisé.")
        return value

    def validate_email(self, value):
        if Utilisateur.objects.filter(email=value).exists():
            raise serializers.ValidationError("Cet email est déjà utilisé.")
        return value

    def validate(self, data):
        if data["role"] == Utilisateur.Role.CITOYEN and data.get("permis_recq"):
            raise serializers.ValidationError(
                {"permis_recq": "Un citoyen n'a pas de numéro de permis R.E.C.Q."}
            )
        return data


class ChangerMotDePasseSerializer(serializers.Serializer):
    ancien_mot_de_passe = serializers.CharField(write_only=True)
    nouveau_mot_de_passe = serializers.CharField(
        write_only=True, validators=[validate_password]
    )


class MotDePasseOublieSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ReinitialiserMotDePasseSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)
    nouveau_mot_de_passe = serializers.CharField(
        write_only=True, validators=[validate_password]
    )


# ── Formulaire de contact public (landing page) ─────────────────────────
class ContactSerializer(serializers.Serializer):
    nom = serializers.CharField(max_length=100)
    prenom = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    message = serializers.CharField(max_length=3000, min_length=10)