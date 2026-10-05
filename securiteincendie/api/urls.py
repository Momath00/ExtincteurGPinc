from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    ChangerMotDePasseView,
    ContactView,
    CustomTokenObtainPairView,
    MeView,
    MotDePasseOublieView,
    ReinitialiserMotDePasseView,
    UtilisateurViewSet,
)

router = DefaultRouter()
router.register(r"utilisateurs", UtilisateurViewSet, basename="utilisateur")

urlpatterns = [
    # Authentification
    path("token/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("changer-mot-de-passe/", ChangerMotDePasseView.as_view(), name="changer_mdp"),

    # Mot de passe oublié
    path("mot-de-passe-oublie/", MotDePasseOublieView.as_view(), name="mdp_oublie"),
    path("reinitialiser-mdp/", ReinitialiserMotDePasseView.as_view(), name="reinitialiser_mdp"),

    # Formulaire de contact public
    path("contact/", ContactView.as_view(), name="contact"),

    # /api/utilisateurs/                → liste (GET) — filtrable par ?role=
    # /api/utilisateurs/inviter/        → inviter un technicien/citoyen (POST)
    # /api/utilisateurs/{id}/           → détail (GET)
    # /api/utilisateurs/{id}/desactiver/ → activer/désactiver (POST)
    path("", include(router.urls)),
]