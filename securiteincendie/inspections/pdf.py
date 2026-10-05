"""Génère de vrais PDF (octets, pour pièce jointe courriel) à partir du HTML
RÉEL des documents — les mêmes actions que le superviseur ouvre dans son
navigateur (`certificat-pdf`, `telecharger`) — via un navigateur headless
(Playwright/Chromium). Le PDF joint correspond donc exactement à ce que le
superviseur voit à l'écran, sans réimplémentation qui finirait par diverger."""

from rest_framework.test import APIRequestFactory, force_authenticate

# Chromium n'applique pas toujours les marges CSS @page en impression PDF —
# répétées ici explicitement (proches de celles des gabarits HTML).
_MARGE = {"top": "10mm", "bottom": "10mm", "left": "12mm", "right": "12mm"}


def _html_vers_pdf(html: str) -> bytes:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page()
            page.set_content(html, wait_until="load")
            return page.pdf(format="Letter", print_background=True, margin=_MARGE)
        finally:
            browser.close()


def _html_action(viewset_cls, action: str, pk: int, utilisateur) -> str:
    """Appelle une action HTML d'un ViewSet (ex. `telecharger`) comme le
    ferait le navigateur du superviseur, et renvoie le HTML produit."""
    requete = APIRequestFactory().get("/")
    force_authenticate(requete, user=utilisateur)
    reponse = viewset_cls.as_view({"get": action})(requete, pk=pk)
    if reponse.status_code != 200:
        raise ValueError(f"{viewset_cls.__name__}.{action}({pk}) → HTTP {reponse.status_code}")
    return reponse.content.decode("utf-8")


def pdf_action(viewset_cls, action: str, pk: int, utilisateur) -> bytes:
    return _html_vers_pdf(_html_action(viewset_cls, action, pk, utilisateur))
