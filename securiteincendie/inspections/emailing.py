from django.conf import settings

from securiteincendie.emailing import envoyer_email, html_template


def envoyer_email_certificat_extincteur_disponible(rapport) -> None:
    """Avertit le citoyen que le certificat de vérification des extincteurs
    portatifs est disponible — envoyé quand le superviseur l'envoie."""
    citoyen = rapport.citoyen
    cert = rapport.certificat
    bat = rapport.batiment
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    lien = f"{frontend_url}/citoyen/rapports-extincteurs/{rapport.id}" if frontend_url else ""

    html_body = f"""
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Votre certificat est disponible</h2>
<p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">
  Bonjour <strong style="color:#0f172a;">{citoyen.get_full_name() or citoyen.username}</strong>,<br>
  le rapport de vérification des extincteurs portatifs au
  <strong style="color:#0f172a;">{adresse}</strong> ainsi que son certificat sont maintenant
  disponibles sur la plateforme.
</p>
<table role="presentation" cellpadding="0" cellspacing="0"
  style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
  <tr>
    <td style="padding:14px 20px;">
      <span style="display:block;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Certificat</span>
      <span style="font-size:14px;font-weight:700;color:#0f172a;">{cert.numero}</span>
    </td>
  </tr>
</table>
{f'<p style="margin:0;text-align:center;"><a href="{lien}" style="display:inline-block;background:#dc2626;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">Voir mon rapport</a></p>' if lien else ''}"""

    envoyer_email(
        citoyen.email,
        "Votre certificat d'extincteurs est disponible — Extincteurs Nationex",
        html_template(html_body),
    )


def envoyer_email_certificat_cuisine_disponible(rapport) -> None:
    """Avertit le citoyen que le certificat de vérification du système
    d'extinction de cuisine est disponible — envoyé quand le superviseur l'envoie."""
    citoyen = rapport.citoyen
    cert = rapport.certificat
    bat = rapport.batiment
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    lien = f"{frontend_url}/citoyen/rapports-cuisine/{rapport.id}" if frontend_url else ""

    html_body = f"""
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Votre certificat est disponible</h2>
<p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">
  Bonjour <strong style="color:#0f172a;">{citoyen.get_full_name() or citoyen.username}</strong>,<br>
  le rapport de vérification du système d'extinction de cuisine au
  <strong style="color:#0f172a;">{adresse}</strong> ainsi que son certificat sont maintenant
  disponibles sur la plateforme.
</p>
<table role="presentation" cellpadding="0" cellspacing="0"
  style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
  <tr>
    <td style="padding:14px 20px;">
      <span style="display:block;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Certificat</span>
      <span style="font-size:14px;font-weight:700;color:#0f172a;">{cert.numero}</span>
    </td>
  </tr>
</table>
{f'<p style="margin:0;text-align:center;"><a href="{lien}" style="display:inline-block;background:#dc2626;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">Voir mon rapport</a></p>' if lien else ''}"""

    envoyer_email(
        citoyen.email,
        "Votre certificat du système de cuisine est disponible — Extincteurs Nationex",
        html_template(html_body),
    )


# ── Envoi direct (client sans espace dédié) ─────────────────────────────────

def envoyer_email_documents_directs(batiment, elements: list[dict]) -> None:
    """Mode « direct » (clients sans compte) : UN SEUL courriel regroupant
    tous les documents prêts du bâtiment — rapports + certificats en PDF
    joints, exactement ce qu'un citoyen verrait sur son espace."""
    client = batiment.client
    adresse = f"{batiment.numero_civique} {batiment.rue}, {batiment.ville}"
    destinataire_nom = client.contact_nom or client.nom

    cartes = ""
    attachments: list[tuple[str, bytes, str]] = []
    for el in elements:
        cartes += f"""
<tr>
  <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
    <span style="display:block;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">{el['label']}</span>
    <span style="font-size:14px;font-weight:700;color:#0f172a;">{el['numero']}</span>
  </td>
</tr>"""
        attachments.extend(el["attachments"])

    html_body = f"""
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Vos documents d'inspection</h2>
<p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">
  Bonjour <strong style="color:#0f172a;">{destinataire_nom}</strong>,<br>
  Extincteurs Nationex a réalisé l'inspection du
  <strong style="color:#0f172a;">{adresse}</strong>. Vous trouverez ci-joint vos
  rapport(s) et certificat(s) en format PDF.
</p>
<table role="presentation" cellpadding="0" cellspacing="0"
  style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;">
  {cartes}
</table>
<p style="margin:16px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">
  📎 {len(attachments)} pièce{'s' if len(attachments) > 1 else ''} jointe{'s' if len(attachments) > 1 else ''}
</p>"""

    sujet = f"Extincteurs Nationex — Documents d'inspection ({adresse})"
    envoyer_email(client.contact_email, sujet, html_template(html_body), attachments=attachments)


def _documents_prets_directs(batiment) -> list:
    """Rapports fermés dont le certificat n'est pas encore envoyé — rapports
    extincteurs (certificat unifié : extincteurs + éclairage + cuisine liés)
    et rapports cuisine indépendants. Liste de rapports ; les PDF ne sont
    générés qu'à l'envoi (voir `_element_direct`)."""
    rapports = [
        r for r in batiment.rapports_extincteurs.filter(statut="ferme")
        if hasattr(r, "certificat") and not r.certificat.certificat_envoye
    ]
    rapports += [
        r for r in batiment.rapports_cuisine.filter(statut="ferme", rapport_extincteur__isnull=True)
        if hasattr(r, "certificat") and not r.certificat.certificat_envoye
    ]
    return rapports


def _label_direct(rapport) -> str:
    from .models import RapportCuisine

    if isinstance(rapport, RapportCuisine):
        return "Système d'extinction de cuisine"
    parties = ["Extincteurs portatifs"]
    if getattr(rapport, "rapport_eclairage_lie", None):
        parties.append("éclairage d'urgence")
    if getattr(rapport, "rapport_cuisine_lie", None):
        parties.append("cuisine")
    return " + ".join(parties)


def _element_direct(rapport, utilisateur) -> dict:
    """Pièces jointes (rapport(s) + certificat en PDF) d'un rapport fermé."""
    from eclairage.views import RapportEclairageViewSet

    from .models import RapportCuisine
    from .pdf import pdf_action
    from .views import RapportCuisineViewSet, RapportExtincteurViewSet

    cert = rapport.certificat
    pdf = "application/pdf"
    if isinstance(rapport, RapportCuisine):
        attachments = [
            (f"rapport-cuisine-{cert.numero}.pdf", pdf_action(RapportCuisineViewSet, "telecharger", rapport.pk, utilisateur), pdf),
            (f"certificat-{cert.numero}.pdf", pdf_action(RapportCuisineViewSet, "certificat_pdf", rapport.pk, utilisateur), pdf),
        ]
    else:
        attachments = [
            (f"rapport-extincteurs-{cert.numero}.pdf", pdf_action(RapportExtincteurViewSet, "telecharger", rapport.pk, utilisateur), pdf),
        ]
        eclairage = getattr(rapport, "rapport_eclairage_lie", None)
        if eclairage:
            attachments.append(
                (f"rapport-eclairage-{cert.numero}.pdf", pdf_action(RapportEclairageViewSet, "telecharger", eclairage.pk, utilisateur), pdf)
            )
        cuisine = getattr(rapport, "rapport_cuisine_lie", None)
        if cuisine:
            attachments.append(
                (f"rapport-cuisine-{cert.numero}.pdf", pdf_action(RapportCuisineViewSet, "telecharger", cuisine.pk, utilisateur), pdf)
            )
        attachments.append(
            (f"certificat-{cert.numero}.pdf", pdf_action(RapportExtincteurViewSet, "certificat_pdf", rapport.pk, utilisateur), pdf)
        )
    return {"label": _label_direct(rapport), "numero": cert.numero, "attachments": attachments, "_obj": rapport}


def envoyer_certificats_directs_batiment(batiment, utilisateur) -> tuple[bool, str]:
    """Envoie en un seul courriel TOUS les documents prêts de ce bâtiment —
    déclenché depuis n'importe quel rapport du bâtiment."""
    from django.utils import timezone

    from .models import Client, ModeEnvoi

    client = batiment.client
    if client.mode_livraison != Client.ModeLivraison.DIRECT:
        return False, "Ce client n'est pas en mode d'envoi direct."
    if not client.contact_email:
        return False, "Ce client n'a pas d'adresse courriel de contact — impossible d'envoyer en mode direct."

    rapports = _documents_prets_directs(batiment)
    if not rapports:
        return False, "Aucun rapport fermé à envoyer pour ce bâtiment."

    try:
        elements = [_element_direct(r, utilisateur) for r in rapports]
    except Exception as exc:  # génération PDF (Chromium absent, vue en erreur…)
        return False, f"Impossible de générer les PDF : {exc}"

    envoyer_email_documents_directs(batiment, elements)

    for el in elements:
        cert = el["_obj"].certificat
        cert.certificat_envoye = True
        cert.mode_envoi = ModeEnvoi.DIRECT
        cert.date_envoi = timezone.now()
        cert.envoye_a = client.contact_email
        cert.save()
        el["_obj"].historiser(utilisateur, f"Rapport et certificat envoyés par courriel (mode direct) à {client.contact_email}")

    noms = " · ".join(el["label"] for el in elements)
    return True, f"Envoyé ! {client.nom} recevra ses documents par courriel à {client.contact_email} ({noms})."
