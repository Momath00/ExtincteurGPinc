"""Helpers d'envoi de courriel partagés (Resend) — gabarit HTML aux couleurs
de la plateforme, avec le logo réel intégré en base64."""
import base64
import io
from pathlib import Path

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from django.utils.html import strip_tags

_LOGO_CACHE: dict = {}
_WORDMARK_CACHE: dict = {}
# icon-192.png est déjà recadré au plus près de l'icône (contrairement à logo.png,
# un visuel marketing avec de grandes marges blanches qui le rendent illisible une
# fois réduit à la taille d'un timbre dans l'en-tête d'un certificat/courriel).
_LOGO_MAX_SIDE = 160


def logo_data_uri(size_px: int = 52) -> str:
    """Logo encodé en base64 (img data URI, redimensionné), ou repli texte « EN » si absent."""
    if size_px not in _LOGO_CACHE:
        path = Path(settings.BASE_DIR).parent / "frontend" / "public" / "icon-192.png"
        if path.exists():
            try:
                from PIL import Image

                with Image.open(path) as img:
                    img = img.convert("RGBA")
                    img.thumbnail((_LOGO_MAX_SIDE, _LOGO_MAX_SIDE), Image.LANCZOS)
                    buf = io.BytesIO()
                    img.save(buf, format="PNG", optimize=True)
                    raw = buf.getvalue()
            except Exception:
                raw = path.read_bytes()
            b64 = base64.b64encode(raw).decode("ascii")
            _LOGO_CACHE[size_px] = (
                f'<img src="data:image/png;base64,{b64}" '
                f'style="width:{size_px}px;height:{size_px}px;object-fit:cover;" alt="ExtincteurGPinc" />'
            )
        else:
            _LOGO_CACHE[size_px] = (
                f'<span style="font-size:{size_px // 3}pt;font-weight:900;color:#e11324;letter-spacing:1px;">GP</span>'
            )
    return _LOGO_CACHE[size_px]


def logo_wordmark_data_uri(height_px: int = 46) -> str:
    """Bandeau rectangulaire (img data URI, hauteur fixe / largeur libre — le
    logo garde son ratio naturel), pour les en-têtes de certificat/rapport où
    un cadre carré ou circulaire écraserait le texte du logo. Repli texte
    « EXTINCTEUR GP INC » si l'image est absente."""
    if height_px not in _WORDMARK_CACHE:
        path = Path(settings.BASE_DIR).parent / "frontend" / "public" / "logo-wordmark.png"
        if path.exists():
            try:
                from PIL import Image

                with Image.open(path) as img:
                    img = img.convert("RGBA")
                    ratio = height_px * 3 / img.height
                    target_h = height_px * 3
                    target_w = round(img.width * ratio)
                    img = img.resize((target_w, target_h), Image.LANCZOS)
                    buf = io.BytesIO()
                    img.save(buf, format="PNG", optimize=True)
                    raw = buf.getvalue()
            except Exception:
                raw = path.read_bytes()
            b64 = base64.b64encode(raw).decode("ascii")
            _WORDMARK_CACHE[height_px] = (
                f'<img src="data:image/png;base64,{b64}" '
                f'style="height:{height_px}px;width:auto;max-width:{height_px * 4}px;object-fit:contain;" '
                f'alt="ExtincteurGPinc" />'
            )
        else:
            _WORDMARK_CACHE[height_px] = (
                f'<span style="font-size:{height_px // 3}pt;font-weight:900;color:#ffffff;letter-spacing:1px;">'
                f'EXTINCTEUR<span style="color:#e11324;">GP</span>INC</span>'
            )
    return _WORDMARK_CACHE[height_px]


def logo_img_tag(size_px: int = 44) -> str:
    """
    <img> pointant vers le logo hébergé par le frontend (FRONTEND_URL/icon-192.png).
    Les clients courriel (Gmail en tête) bloquent ou cassent souvent les images
    encodées en base64 (data:) — une vraie URL publique est nécessaire pour un
    affichage fiable dans les courriels (contrairement aux PDF, où le base64
    reste préférable pour un rendu autonome hors-ligne).
    """
    frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    if frontend_url:
        return (
            f'<img src="{frontend_url}/icon-192.png" width="{size_px}" height="{size_px}" '
            f'style="width:{size_px}px;height:{size_px}px;object-fit:cover;display:block;" '
            f'alt="ExtincteurGPinc" />'
        )
    return f'<span style="font-size:{size_px // 3}pt;font-weight:900;color:#e11324;letter-spacing:1px;">GP</span>'


def _icone_case(svg_inner: str) -> str:
    return (
        "<div style='width:20px;height:20px;border-radius:4px;background:#dc2626;"
        "display:flex;align-items:center;justify-content:center;flex-shrink:0;'>"
        f"<svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='#fff' "
        f"stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>{svg_inner}</svg>"
        "</div>"
    )


def pied_de_page_entreprise() -> str:
    """
    Pied de page réutilisé sur les rapports et certificats PDF — coordonnées
    de l'entreprise + pictogrammes « Protection contre incendie ».
    """
    icone_extincteur = _icone_case(
        "<path d='M9 3h4l1 3'/><path d='M10 6v3'/>"
        "<rect x='7' y='9' width='7' height='11' rx='1.5'/>"
        "<path d='M14 11l5-2'/><path d='M19 9v2'/>"
    )
    icone_boyau = _icone_case(
        "<circle cx='12' cy='12' r='8'/><circle cx='12' cy='12' r='4.5'/><circle cx='12' cy='12' r='1'/>"
    )
    icone_sortie = _icone_case(
        "<rect x='5' y='4' width='9' height='16' rx='1'/>"
        "<path d='M14 12h6'/><path d='M17 9l3 3-3 3'/>"
    )
    icone_douche = _icone_case(
        "<circle cx='12' cy='6' r='2'/>"
        "<path d='M6 11c1-2 3-3 6-3s5 1 6 3'/>"
        "<path d='M8 14v2'/><path d='M12 14v3'/><path d='M16 14v2'/>"
    )

    contact = getattr(settings, "CONTACT_EMAIL", "")

    return f"""<div style="margin-top:22px;padding-top:12px;border-top:1.5px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;">
  <div style="font-size:7.5pt;line-height:1.55;color:#111;font-weight:700;">
    <div style="font-weight:900;letter-spacing:0.3px;color:#0a0b0d;">EXTINCTEUR<span style="color:#e11324;">GP</span>INC</div>
    <div><strong>TÉL. :</strong> 514-943-0099</div>
    <div>{contact}</div>
  </div>
  <div style="display:flex;align-items:flex-end;gap:12px;">
    <div>
      <div style="font-size:6pt;font-weight:800;letter-spacing:0.8px;color:#0a0b0d;text-transform:uppercase;margin-bottom:4px;">Protection contre incendie</div>
      <div style="display:flex;gap:4px;">{icone_extincteur}{icone_boyau}{icone_sortie}{icone_douche}</div>
    </div>
  </div>
</div>"""


def html_template(body: str) -> str:
    """Enveloppe un corps de courriel dans le gabarit aux couleurs de la plateforme."""
    year = timezone.now().year
    return f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" style="width:100%;max-width:480px;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="background:#0a0b0d;padding:28px 32px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 10px;">
              <tr><td style="width:44px;height:44px;background:#fff;border-radius:50%;text-align:center;vertical-align:middle;overflow:hidden;">
                {logo_img_tag(44)}
              </td></tr>
            </table>
            <p style="margin:0;color:#fff;font-size:12px;font-weight:700;letter-spacing:2px;">EXTINCTEUR GP INC</p>
          </td>
        </tr>
        <tr><td style="background:#fff;padding:32px;">{body}</td></tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">© {year} ExtincteurGPinc · Courriel confidentiel</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def envoyer_email(
    to_email: str,
    subject: str,
    html: str,
    reply_to: str | None = None,
    attachments: list[tuple[str, bytes, str]] | None = None,
) -> None:
    """Envoie via Resend si RESEND_API_KEY est défini, sinon repli SMTP Django.
    `attachments` : liste de `(nom_fichier, contenu_octets, type_mime)`."""
    api_key = getattr(settings, "RESEND_API_KEY", "")
    from_email = getattr(settings, "RESEND_FROM_EMAIL", settings.DEFAULT_FROM_EMAIL)
    if api_key:
        try:
            import resend as _resend

            _resend.api_key = api_key
            payload = {"from": from_email, "to": [to_email], "subject": subject, "html": html}
            if reply_to:
                payload["reply_to"] = [reply_to]
            if attachments:
                payload["attachments"] = [
                    {"filename": nom, "content": list(contenu)} for nom, contenu, _mime in attachments
                ]
            _resend.Emails.send(payload)
            return
        except Exception:
            pass
    email = EmailMultiAlternatives(
        subject=subject,
        body=strip_tags(html),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
        reply_to=[reply_to] if reply_to else None,
    )
    email.attach_alternative(html, "text/html")
    for nom, contenu, mime in (attachments or []):
        email.attach(nom, contenu, mime)
    email.send(fail_silently=True)
