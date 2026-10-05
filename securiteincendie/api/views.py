import random
import string

from django.contrib.auth import get_user_model
from django.utils.html import escape
from rest_framework import permissions, status, viewsets

from securiteincendie.emailing import envoyer_email as _envoyer_email
from securiteincendie.emailing import html_template as _html_template

from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from django.conf import settings

from accounts.models import CodeVerification
from .serializers import (
    ChangerMotDePasseSerializer,
    ContactSerializer,
    InviterUtilisateurSerializer,
    MotDePasseOublieSerializer,
    ReinitialiserMotDePasseSerializer,
    UtilisateurSerializer,
)

Utilisateur = get_user_model()


# ── Connexion ────────────────────────────────────────────────────────────
class CustomTokenObtainPairView(TokenObtainPairView):
    """Bloque la connexion si le compte a été désactivé par le superviseur."""

    def post(self, request, *args, **kwargs):
        username = request.data.get("username")
        try:
            user = Utilisateur.objects.get(username=username)
            if not user.est_actif:
                return Response(
                    {"error": "Votre compte est désactivé. Contactez votre superviseur."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        except Utilisateur.DoesNotExist:
            pass
        from rest_framework.exceptions import AuthenticationFailed
        try:
            return super().post(request, *args, **kwargs)
        except AuthenticationFailed:
            return Response(
                {"detail": "Nom d'utilisateur ou mot de passe incorrect."},
                status=status.HTTP_401_UNAUTHORIZED,
            )


# ── Utilisateur connecté ────────────────────────────────────────────────
class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UtilisateurSerializer(request.user).data)


class ChangerMotDePasseView(APIView):
    """Utilisé après une invitation, pour remplacer le mot de passe temporaire."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangerMotDePasseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data["ancien_mot_de_passe"]):
            return Response(
                {"error": "Ancien mot de passe incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(serializer.validated_data["nouveau_mot_de_passe"])
        user.mdp_temporaire = False
        user.save()
        return Response({"message": "Mot de passe mis à jour."})


# ── Gestion d'équipe (Superviseur seulement) ────────────────────────────
class EstSuperviseur(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.est_superviseur())


CHAMPS_SUIVIS_MODIFICATION = [
    ("Nom d'utilisateur", "username"),
    ("Prénom", "first_name"),
    ("Nom", "last_name"),
    ("Email", "email"),
    ("Téléphone", "telephone"),
    ("Rôle", "role"),
    ("Permis R.E.C.Q.", "permis_recq"),
]


def _envoyer_email_modification_profil(utilisateur, changements: list[tuple[str, str, str]]) -> None:
    """Avise le membre des changements apportés à son profil par un
    superviseur — `changements` : liste de (label, avant, après)."""
    if not utilisateur.email or not changements:
        return
    lignes = "".join(
        f"""<tr>
  <td style="padding:10px 20px;border-bottom:1px solid #e2e8f0;">
    <span style="display:block;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">{escape(label)}</span>
    <span style="font-size:13px;color:#9ca3af;text-decoration:line-through;">{escape(avant)}</span>
    <span style="font-size:13px;color:#0f172a;font-weight:700;"> → {escape(apres)}</span>
  </td>
</tr>"""
        for label, avant, apres in changements
    )
    prenom = utilisateur.first_name or utilisateur.username
    html_body = f"""
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Votre profil a été modifié</h2>
<p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">
  Bonjour <strong style="color:#0f172a;">{escape(prenom)}</strong>,<br>
  Un superviseur a mis à jour les informations suivantes de votre compte ExtincteurGPinc :
</p>
<table role="presentation" cellpadding="0" cellspacing="0"
  style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;">
  {lignes}
</table>
<p style="margin:16px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">
  Si vous n'êtes pas à l'origine de cette demande, contactez votre superviseur.
</p>"""
    _envoyer_email(utilisateur.email, "Votre profil ExtincteurGPinc a été modifié", _html_template(html_body))


class UtilisateurViewSet(viewsets.ModelViewSet):
    """
    Gestion des membres de l'équipe (techniciens et citoyens), réservée au
    superviseur. Pas de création publique : seule la route `inviter` permet
    d'ajouter un utilisateur, avec mot de passe temporaire envoyé par courriel.
    """

    serializer_class = UtilisateurSerializer
    permission_classes = [permissions.IsAuthenticated, EstSuperviseur]

    def get_queryset(self):
        qs = Utilisateur.objects.exclude(pk=self.request.user.pk)
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)
        return qs.order_by("username")

    # Bloque la création/suppression brutes — on passe toujours par `inviter`
    def create(self, request, *args, **kwargs):
        return Response(
            {"error": "Utilisez la route 'inviter/' pour ajouter un utilisateur."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"error": "Utilisez la route 'desactiver/' plutôt que de supprimer."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def perform_update(self, serializer):
        """Avise automatiquement le membre par courriel des champs modifiés
        par le superviseur (fenêtre « Modifier le membre », page Équipe)."""
        instance = serializer.instance
        avant = {champ: getattr(instance, champ) for _, champ in CHAMPS_SUIVIS_MODIFICATION}
        utilisateur = serializer.save()

        def _affiche(champ, valeur):
            if champ == "role":
                return dict(Utilisateur.Role.choices).get(valeur, valeur)
            return valeur or "—"

        changements = [
            (label, _affiche(champ, avant[champ]), _affiche(champ, getattr(utilisateur, champ)))
            for label, champ in CHAMPS_SUIVIS_MODIFICATION
            if avant[champ] != getattr(utilisateur, champ)
        ]
        if changements:
            _envoyer_email_modification_profil(utilisateur, changements)

    @action(detail=False, methods=["post"])
    def inviter(self, request):
        serializer = InviterUtilisateurSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        mdp_temp = "".join(random.choices(string.ascii_letters + string.digits, k=10))

        utilisateur = Utilisateur.objects.create_user(
            username=data["username"],
            email=data["email"],
            password=mdp_temp,
            role=data["role"],
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            telephone=data.get("telephone", ""),
            permis_recq=data.get("permis_recq", ""),
            est_actif=True,
            mdp_temporaire=True,
            invite_par=request.user,
        )

        role_label = utilisateur.get_role_display()
        prenom = data.get('first_name') or data['username']
        html_body = f"""
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Bienvenue !</h2>
<p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
  Bonjour <strong style="color:#0f172a;">{prenom}</strong>,<br>
  vous avez été invité(e) en tant que <strong style="color:#dc2626;">{role_label}</strong>
  sur la plateforme <strong style="color:#0f172a;">ExtincteurGPinc</strong>.
</p>
<table role="presentation" cellpadding="0" cellspacing="0"
  style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
  <tr>
    <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
      <span style="display:block;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Nom d'utilisateur</span>
      <span style="font-size:14px;font-weight:700;color:#0f172a;">{data['username']}</span>
    </td>
  </tr>
  <tr>
    <td style="padding:14px 20px;">
      <span style="display:block;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Mot de passe temporaire</span>
      <code style="display:inline-block;background:#fff2e8;color:#dc2626;font-size:18px;font-weight:800;letter-spacing:3px;padding:8px 16px;border-radius:8px;border:2px solid #fed7aa;">{mdp_temp}</code>
    </td>
  </tr>
</table>
<div style="background:#fffbeb;border-left:3px solid #dc2626;padding:12px 16px;border-radius:0 8px 8px 0;">
  <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5;">
    ⚠️ Ce mot de passe est <strong>temporaire</strong>. Vous serez invité(e) à le modifier dès votre première connexion.
  </p>
</div>"""
        _envoyer_email(
            data["email"],
            f"Invitation — ExtincteurGPinc ({role_label})",
            _html_template(html_body),
        )

        return Response(
            {
                "message": f"{role_label} {data['username']} invité(e) avec succès.",
                "utilisateur": UtilisateurSerializer(utilisateur).data,
                # Renvoyé une seule fois ici, en secours si l'email échoue en développement.
                "mdp_temporaire": mdp_temp,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def desactiver(self, request, pk=None):
        utilisateur = self.get_object()
        utilisateur.est_actif = not utilisateur.est_actif
        utilisateur.save()
        etat = "activé" if utilisateur.est_actif else "désactivé"
        return Response({"message": f"Compte {etat}.", "est_actif": utilisateur.est_actif})


# ── Mot de passe oublié ──────────────────────────────────────────────────
class MotDePasseOublieView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = MotDePasseOublieSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        try:
            user = Utilisateur.objects.get(email=email, est_actif=True)
        except Utilisateur.DoesNotExist:
            return Response(
                {"error": "Aucun compte actif n'est associé à cet email."},
                status=status.HTTP_404_NOT_FOUND,
            )

        CodeVerification.objects.filter(email=email).delete()
        code_obj = CodeVerification.objects.create(email=email)

        html_body = f"""
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Réinitialisation de mot de passe</h2>
<p style="margin:0 0 28px;color:#64748b;font-size:14px;line-height:1.6;">
  Bonjour <strong style="color:#0f172a;">{user.username}</strong>,<br>
  voici votre code de réinitialisation de mot de passe.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:28px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-radius:14px;">
      <tr>
        <td align="center" bgcolor="#123a63"
          style="background-color:#123a63;background-image:linear-gradient(135deg,#123a63,#0a1c2e);padding:24px 48px;border-radius:14px;">
          <p style="margin:0 0 6px;color:rgba(255,255,255,.55);font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;">Code de vérification</p>
          <p style="margin:0;color:#dc2626;font-size:36px;font-weight:800;letter-spacing:10px;font-family:monospace;">{code_obj.code}</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
<p style="margin:0;text-align:center;color:#64748b;font-size:13px;">
  Ce code expire dans <strong style="color:#0f172a;">{CodeVerification.DUREE_VALIDITE_MINUTES} minutes</strong>.
</p>
<p style="margin:8px 0 0;text-align:center;color:#94a3b8;font-size:12px;">
  Si vous n'avez pas demandé cette réinitialisation, ignorez ce message.
</p>"""
        _envoyer_email(
            email,
            "Réinitialisation de mot de passe — ExtincteurGPinc",
            _html_template(html_body),
        )
        return Response({"message": "Un code de vérification vous a été envoyé par email."})


class ReinitialiserMotDePasseView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ReinitialiserMotDePasseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            code_obj = CodeVerification.objects.get(
                email=data["email"], code=data["code"].upper(), utilise=False
            )
        except CodeVerification.DoesNotExist:
            return Response(
                {"error": "Code invalide ou expiré."}, status=status.HTTP_400_BAD_REQUEST
            )

        if not code_obj.est_valide():
            return Response(
                {"error": "Code expiré. Recommencez depuis le début."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = Utilisateur.objects.get(email=data["email"], est_actif=True)
        except Utilisateur.DoesNotExist:
            return Response(
                {"error": "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND
            )

        user.set_password(data["nouveau_mot_de_passe"])
        user.mdp_temporaire = False
        user.save()

        code_obj.utilise = True
        code_obj.save()

        return Response({
            "message": "Mot de passe réinitialisé avec succès.",
            "username": user.username,
        })


# ── Formulaire de contact public (landing page) ──────────────────────────
class ContactView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ContactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        nom_complet = f"{data['prenom']} {data['nom']}"

        # 1. Notifie l'équipe — répondre à ce courriel répond directement au visiteur
        message_html = data["message"].replace("\n", "<br>")
        html_equipe = f"""
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Nouveau message de contact</h2>
<p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">
  Reçu via le formulaire de contact du site public.
</p>
<table role="presentation" cellpadding="0" cellspacing="0"
  style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:20px;">
  <tr>
    <td style="padding:12px 18px;border-bottom:1px solid #e2e8f0;">
      <span style="display:block;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Nom</span>
      <span style="font-size:14px;font-weight:700;color:#0f172a;">{nom_complet}</span>
    </td>
  </tr>
  <tr>
    <td style="padding:12px 18px;">
      <span style="display:block;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Email</span>
      <span style="font-size:14px;font-weight:700;color:#0f172a;">{data['email']}</span>
    </td>
  </tr>
</table>
<p style="margin:0 0 6px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Message</p>
<p style="margin:0;color:#0f172a;font-size:14px;line-height:1.6;">{message_html}</p>"""

        _envoyer_email(
            getattr(settings, "CONTACT_EMAIL", "info@extincteurgpinc.com"),
            f"Nouveau message de contact — {nom_complet}",
            _html_template(html_equipe),
            reply_to=data["email"],
        )

        # 2. Confirmation automatique au visiteur
        html_visiteur = f"""
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Message bien reçu</h2>
<p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">
  Bonjour <strong style="color:#0f172a;">{data['prenom']}</strong>,<br>
  ExtincteurGPinc a bien reçu votre message. Notre équipe vous répondra dans les
  plus brefs délais.
</p>
<div style="background:#f8fafc;border-left:3px solid #dc2626;padding:12px 16px;border-radius:0 8px 8px 0;">
  <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;font-style:italic;">{message_html}</p>
</div>"""

        _envoyer_email(
            data["email"],
            "Votre message a bien été reçu — ExtincteurGPinc",
            _html_template(html_visiteur),
        )

        return Response({"message": "Votre message a été transmis avec succès."})