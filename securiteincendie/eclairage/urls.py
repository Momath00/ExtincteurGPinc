from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import EclairageItemViewSet, RapportEclairageViewSet

router = DefaultRouter()
router.register(r"rapports-eclairage", RapportEclairageViewSet, basename="rapport-eclairage")
router.register(r"eclairages", EclairageItemViewSet, basename="eclairage")

# Routes générées, à titre de référence :
# GET/POST    /api/rapports-eclairage/                  → liste / créer un rapport (superviseur)
# GET/PATCH   /api/rapports-eclairage/{id}/              → détail / (bloqué si fermé)
# PATCH       /api/rapports-eclairage/{id}/reassigner/    → réassigner bâtiment/techniciens
# POST        /api/rapports-eclairage/{id}/fermer/         → fermer le rapport
# POST        /api/rapports-eclairage/{id}/rouvrir/          → rouvrir un rapport fermé
# GET/POST    /api/rapports-eclairage/{id}/lumieres/           → lister/ajouter une unité
# GET         /api/rapports-eclairage/{id}/historique/            → historique du rapport
# GET         /api/rapports-eclairage/{id}/telecharger/             → rapport imprimable (HTML)
# GET/PATCH   /api/eclairages/{id}/                                   → corriger une ligne d'unité

urlpatterns = [
    path("", include(router.urls)),
]
