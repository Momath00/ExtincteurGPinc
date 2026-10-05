from django.db.models import ProtectedError
from django.http import HttpResponse
from django.utils.html import escape
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from securiteincendie.emailing import logo_wordmark_data_uri, pied_de_page_entreprise

from accounts.models import Utilisateur
from .models import (
    Batiment,
    BoyauItem,
    CertificatExtincteur,
    Client,
    ExtincteurItem,
    ModeEnvoi,
    RapportExtincteur,
)
from .serializers import (
    BatimentSerializer,
    BoyauItemSerializer,
    ClientSerializer,
    ExtincteurItemSerializer,
    HistoriqueRapportExtincteurSerializer,
    RapportExtincteurCreateSerializer,
    RapportExtincteurDetailSerializer,
    RapportExtincteurListSerializer,
)

# ── Légende du rapport extincteurs portatifs ─────────────────────────────
LEGENDE_EXTINCTEURS = [
    ("HT", "Test hydro, pour boyaux et/ou extincteurs, voir (Notes)"),
    ("T/O", "Les extincteurs ou les boyaux ont dépassé le temps recommandé, voir (Notes)"),
    ("MQ", "Extincteur ou boyaux manquant, doit être ajouté, voir (Notes)"),
    ("RM", "Recommandation, voir (Notes)"),
    ("D", "Déficience, voir (Notes)"),
    ("MT", "Maintenance requise, voir (Notes)"),
]


_MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
            'septembre', 'octobre', 'novembre', 'décembre']


def _date_fr(d):
    if d is None:
        return "—"
    return f"{d.day} {_MOIS_FR[d.month - 1]} {d.year}"


def _date_inspection_fr(rapport):
    """Date d'inspection affichée sur les certificats et rapports : le jour
    de fermeture du rapport (fin de l'inspection sur place — la compagnie
    ne planifie pas de date à l'avance). Fixe : le même document affiche
    toujours la même date, peu importe quand il est téléchargé. Rapport
    encore ouvert (aperçu en cours d'inspection) : date du jour."""
    if rapport.date_fermeture:
        return _date_fr(timezone.localdate(rapport.date_fermeture))
    return _date_fr(timezone.localdate())


def _date_emission_fr(cert):
    """Date d'émission du certificat — fixée à sa création (fermeture)."""
    return _date_fr(timezone.localdate(cert.date_emission))


def _est_conforme_unifie(rapport):
    """Non conforme dès qu'un extincteur est défectueux — même logique que le certificat unifié
    affiché sur certificat-pdf. Une unité d'éclairage d'urgence
    défectueuse ne rend PAS le certificat non conforme : la ligne
    Éclairage d'urgence passe alors à « S.O. » (décision d'affaires)."""
    items = list(rapport.extincteurs.all())
    return not any(it.etat == "D" for it in items)


class EstSuperviseur(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.est_superviseur())


class EstSuperviseurOuTechnicien(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and (request.user.est_superviseur() or request.user.est_technicien())
        )


# ── Client ───────────────────────────────────────────────────────────────
class ClientViewSet(viewsets.ModelViewSet):
    """Gestion des entreprises clientes — superviseur et technicien (ex.
    nouveau client rencontré directement sur le terrain)."""

    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated, EstSuperviseurOuTechnicien]
    queryset = Client.objects.all()

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Impossible de supprimer ce client : des bâtiments lui sont encore rattachés."},
                status=status.HTTP_400_BAD_REQUEST,
            )


# ── Bâtiment ─────────────────────────────────────────────────────────────
class BatimentViewSet(viewsets.ModelViewSet):
    serializer_class = BatimentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Batiment.objects.select_related("client")
        if user.est_citoyen():
            qs = qs.filter(proprietaire=user)
        # le superviseur et le technicien voient/gèrent tous les bâtiments —
        # le technicien doit pouvoir en créer un nouveau ou en réutiliser un
        # existant sur le terrain, pas seulement ceux déjà liés à ses rapports.

        client_id = self.request.query_params.get("client")
        if client_id:
            qs = qs.filter(client_id=client_id)
        return qs

    def get_permissions(self):
        if self.action in ["documents_a_envoyer", "envoyer_documents"]:
            return [permissions.IsAuthenticated(), EstSuperviseur()]
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), EstSuperviseurOuTechnicien()]
        return super().get_permissions()

    @action(detail=True, methods=["get"], url_path="documents-a-envoyer")
    def documents_a_envoyer(self, request, pk=None):
        """Aperçu — documents prêts (rapports fermés, certificat pas encore
        envoyé) de ce bâtiment, pour la bannière d'envoi direct."""
        from .emailing import _documents_prets_directs, _label_direct

        batiment = self.get_object()
        client = batiment.client
        mode_direct = client.mode_livraison == Client.ModeLivraison.DIRECT
        rapports = _documents_prets_directs(batiment) if mode_direct else []
        return Response({
            "mode_direct": mode_direct,
            "contact_email": client.contact_email,
            "count": len(rapports),
            "labels": [_label_direct(r) for r in rapports],
        })

    @action(detail=True, methods=["post"], url_path="envoyer-documents")
    def envoyer_documents(self, request, pk=None):
        """Envoie en un seul courriel tous les documents prêts du bâtiment."""
        from .emailing import envoyer_certificats_directs_batiment

        ok, message = envoyer_certificats_directs_batiment(self.get_object(), request.user)
        if not ok:
            return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"message": message})


def _case_certificat(actif, couleur=None):
    if actif:
        fond = couleur or "#0a0b0d"
        return (
            f"<span style='display:inline-flex;align-items:center;justify-content:center;"
            f"width:20px;height:20px;border-radius:4px;background:{fond};color:#fff;"
            f"font-size:13px;font-weight:900;line-height:1;box-shadow:0 1px 2px rgba(0,0,0,0.15);'>&#10003;</span>"
        )
    return (
        "<span style='display:inline-block;width:20px;height:20px;border-radius:4px;"
        "border:1.5px solid #d1d5db;background:#fafafa;'></span>"
    )


def _badge_equipement_certificat(conforme, non_conforme, so):
    if so:
        return "<span style='display:inline-block;font-size:7.5pt;font-weight:800;letter-spacing:0.5px;color:#9ca3af;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:100px;padding:3px 10px;'>S.O.</span>"
    if non_conforme:
        return "<span style='display:inline-block;font-size:7.5pt;font-weight:800;letter-spacing:0.5px;color:#e11324;background:#fee2e2;border:1px solid #fecaca;border-radius:100px;padding:3px 10px;'>NON CONFORME</span>"
    if conforme:
        return "<span style='display:inline-block;font-size:7.5pt;font-weight:800;letter-spacing:0.5px;color:#16a34a;background:#dcfce7;border:1px solid #bbf7d0;border-radius:100px;padding:3px 10px;'>CONFORME</span>"
    return "<span class='muted' style='font-size:8pt;'>—</span>"


def _ligne_equipement_certificat(nom, applicable, items_liste, etat_attr="etat", etat_defectueux="D", defaut_en_so=False):
    if defaut_en_so and any(getattr(it, etat_attr) == etat_defectueux for it in items_liste):
        # Éclairage d'urgence : une unité défectueuse affiche la
        # ligne en « S.O. » plutôt que NON CONFORME (voir
        # _est_conforme_unifie).
        applicable = False
    so = not applicable or not items_liste
    defectueux = applicable and any(getattr(it, etat_attr) == etat_defectueux for it in items_liste)
    conforme = applicable and bool(items_liste) and not defectueux
    return (
        f"<tr><td class='bold'>{nom}</td>"
        f"<td class='center'>{_case_certificat(conforme, '#16a34a')}</td>"
        f"<td class='center'>{_case_certificat(defectueux, '#e11324')}</td>"
        f"<td class='center'>{_case_certificat(so, '#9ca3af')}</td>"
        f"<td class='center'>{_badge_equipement_certificat(conforme, defectueux, so)}</td></tr>"
    )


def _html_certificat_unifie(*, cert, bat, date_insp, techniciens, equipement_rows, est_conforme,
                            sous_titre="Extincteurs portatifs"):
    """Gabarit du certificat unifié (extincteurs + éclairage d'urgence)."""
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    if bat.code_postal:
        adresse += f"  {bat.code_postal}"
    date_cert = _date_emission_fr(cert)

    def _nom_pro(utilisateur):
        return utilisateur.get_full_name() or utilisateur.username.capitalize()

    tech_noms = ", ".join(_nom_pro(t) for t in techniciens) or "—"

    logo_content = logo_wordmark_data_uri(46)
    emetteur = _nom_pro(cert.emis_par) if cert.emis_par else "—"

    conformite_bg = "#dcfce7" if est_conforme else "#fee2e2"
    conformite_border = "#16a34a" if est_conforme else "#e11324"
    conformite_texte = "CONFORME" if est_conforme else "NON CONFORME"

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Certificat {cert.numero}</title>
<style>
  @page {{ margin: 8mm 12mm; }}
  *{{ box-sizing:border-box; margin:0; padding:0; }}
  body{{ font-family:Arial,Helvetica,sans-serif; font-size:9pt; color:#111; background:#fff; }}
  .header{{ display:flex; align-items:center; justify-content:space-between; background:#0a0b0d; padding:9px 16px; border-radius:6px; margin-bottom:9px; }}
  .brand{{ display:flex; align-items:center; gap:10px; }}
  .logo-box{{ height:36px; max-width:170px; display:flex; align-items:center; flex-shrink:0; }} .logo-box img{{ max-height:100%; max-width:100%; }}
  .brand-text h1{{ font-size:11.5pt; font-weight:900; color:#ffffff; text-transform:uppercase; letter-spacing:1px; }}
  .brand-text p{{ font-size:7.5pt; color:rgba(255,255,255,0.7); margin-top:1px; }}
  .cert-badge{{ text-align:right; }}
  .title-banner{{ background:#0a0b0d; color:#fff; text-align:center; padding:6px 0; border-radius:4px; margin-bottom:9px; }}
  .title-banner h2{{ font-size:11pt; font-weight:700; letter-spacing:2px; text-transform:uppercase; }}
  .title-banner p{{ font-size:7.5pt; color:rgba(255,255,255,0.7); margin-top:2px; letter-spacing:1px; }}
  .info-card{{ border:1px solid #e5e7eb; border-radius:6px; padding:6px 12px; }}
  .card-title{{ font-size:6.5pt; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#e11324; margin-bottom:3px; }}
  .card-main{{ font-size:11pt; font-weight:700; color:#0a0b0d; line-height:1.2; }}
  .sec-title{{ font-size:7.5pt; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#0a0b0d; border-bottom:1.5px solid #0a0b0d; padding-bottom:3px; margin-bottom:5px; margin-top:9px; }}
  table{{ width:100%; border-collapse:collapse; font-size:8.5pt; }}
  th{{ background:#fef2f2; color:#0a0b0d; font-weight:700; padding:4px 10px; text-align:left; font-size:7.5pt; text-transform:uppercase; }}
  td{{ padding:3px 10px; border-bottom:1px solid #fef2f2; color:#111; }}
  .center{{ text-align:center; }} .bold{{ font-weight:700; }} .muted{{ color:#9ca3af; font-style:italic; }}
  .equip-table{{ border:1.5px solid #0a0b0d; border-radius:6px; overflow:hidden; }}
  .equip-table th{{ background:#0a0b0d; color:#fff; padding:5px 12px; font-size:7pt; border:none; border-right:1px solid rgba(255,255,255,0.15); }}
  .equip-table th:last-child{{ border-right:none; }}
  .equip-table td{{ padding:5px 12px; border-bottom:1px solid #e5e7eb; border-right:1px solid #e5e7eb; vertical-align:middle; }}
  .equip-table td:last-child{{ border-right:none; }}
  .equip-table tr:last-child td{{ border-bottom:none; }}
  .sig-row{{ display:flex; gap:24px; margin-top:10px; }}
  .sig-block{{ flex:1; border-top:1.5px solid #111; padding-top:4px; }}
  .sig-label{{ font-size:7pt; color:#777; text-transform:uppercase; letter-spacing:1px; }}
  .sig-name{{ font-size:9.5pt; font-weight:700; color:#0a0b0d; margin-top:1px; }}
  @media print{{ body{{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }} .no-print{{ display:none!important; }} }}
</style>
</head>
<body>
<div class="no-print" style="text-align:right;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
  <button onclick="window.print()" style="background:#0a0b0d;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:700;cursor:pointer;font-size:10pt;">Imprimer / Enregistrer PDF</button>
</div>
<div style="padding:12px 16px;">
<div class="header">
  <div class="brand">
<div class="logo-box">{logo_content}</div>
<div class="brand-text">
  <h1>Extincteur<span style="color:#e11324;">GP</span><span style="font-weight:400;">inc</span></h1>
  <p>Inspection &amp; Certification — {sous_titre}</p>
</div>
  </div>
  <div class="cert-badge">
<div style="font-size:10.5pt; font-weight:700; color:#ffffff;">{date_insp}</div>
<div style="font-size:7pt;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:1px;">Date d'inspection</div>
<div style="font-size:7.5pt;color:rgba(255,255,255,0.8);margin-top:2px;">Certificat N° {cert.numero}</div>
<div style="font-size:7.5pt;color:rgba(255,255,255,0.8);margin-top:2px;">Technicien(s) : <strong style="color:#fff;">{tech_noms}</strong></div>
  </div>
</div>
<div class="title-banner">
  <h2>Certificat de vérification</h2>
  <p>{sous_titre}</p>
</div>
<div style="text-align:center;margin-bottom:9px;">
  <span style="display:inline-block;background:{conformite_bg};border:1.5px solid {conformite_border};color:{conformite_border};font-size:9.5pt;font-weight:900;letter-spacing:2px;padding:4px 20px;border-radius:100px;">{conformite_texte}</span>
</div>
<div style="text-align:left;margin-bottom:5px;">
  <div class="card-title">Client</div>
  <div class="card-main" style="font-size:10.5pt;">{bat.client.nom}</div>
</div>
<div class="info-card" style="text-align:center;margin-bottom:9px;">
  <div class="card-title">Adresse inspectée</div>
  <div class="card-main" style="font-size:15pt; font-weight:900;">{adresse}</div>
</div>
<div style="background:#0a0b0d;color:#fff;text-align:center;padding:6px 10px;border-radius:4px;margin-top:9px;margin-bottom:5px;">
  <span style="font-size:8pt;font-weight:800;letter-spacing:0.3px;">La vérification de l'équipement sous mentionné est conforme aux normes en vigueur</span>
</div>
<table class="equip-table">
  <thead><tr><th>Équipement</th><th class="center">Conforme</th><th class="center">Non conforme</th><th class="center">S.O.</th><th class="center">Statut</th></tr></thead>
  <tbody>{equipement_rows}</tbody>
</table>
<p style="text-align:center;font-weight:700;font-size:8.5pt;color:#0a0b0d;margin-top:10px;line-height:1.4;">
  L'inspection régulière et l'entretien de l'équipement tels que recommandés<br>par le manufacturier ont été effectués.
</p>
<div class="sig-row">
  <div class="sig-block">
<div class="sig-label">Superviseur / Responsable</div>
<div class="sig-name">{emetteur}</div>
<div style="font-size:7.5pt;color:#555;">ExtincteurGPinc</div>
  </div>
  <div class="sig-block">
<div class="sig-label">Date d'émission</div>
<div class="sig-name">{date_cert}</div>
<div style="font-size:7.5pt;color:#555;">Certificat N° {cert.numero}</div>
  </div>
</div>
<div style="font-size:7pt;color:#9ca3af;margin-top:10px;">Ce certificat atteste la vérification des extincteurs portatifs et de l'éclairage d'urgence à la date d'inspection indiquée.</div>
{pied_de_page_entreprise()}
</div>
</body>
</html>"""
    return html


# ── Rapport extincteurs ─────────────────────────────────────────────────
class RapportExtincteurViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "list":
            return RapportExtincteurListSerializer
        if self.action in ["create", "update", "partial_update"]:
            # Le superviseur peut réassigner les techniciens (ex. absence) —
            # RapportExtincteurDetailSerializer déclare `techniciens` en lecture
            # seule (affichage imbriqué), il faut le serializer d'écriture ici.
            return RapportExtincteurCreateSerializer
        return RapportExtincteurDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs = RapportExtincteur.objects.select_related(
            "batiment", "batiment__client", "cree_par", "citoyen"
        ).prefetch_related("techniciens")

        if user.est_citoyen():
            qs = qs.filter(citoyen=user)
        elif user.est_technicien():
            qs = qs.filter(techniciens=user)
        # le superviseur voit tout

        client_id = self.request.query_params.get("client")
        statut = self.request.query_params.get("statut")
        if client_id:
            qs = qs.filter(batiment__client_id=client_id)
        if statut:
            qs = qs.filter(statut=statut)

        return qs.distinct()

    def get_permissions(self):
        if self.action == "create":
            # Le technicien peut créer un rapport sur le terrain (nouveau
            # client/bâtiment rencontré directement chez le client) — il est
            # alors auto-assigné dessus, voir perform_create().
            return [permissions.IsAuthenticated(), EstSuperviseurOuTechnicien()]
        if self.action in ["destroy", "update", "partial_update", "reassigner", "rouvrir"]:
            # Réassigner d'autres techniciens ou rouvrir un rapport fermé
            # restent réservés au superviseur.
            return [permissions.IsAuthenticated(), EstSuperviseur()]
        return super().get_permissions()

    @action(detail=True, methods=["patch"])
    def reassigner(self, request, pk=None):
        """Superviseur seulement — change le bâtiment et/ou les techniciens assignés après création."""
        rapport = self.get_object()
        changements = []

        if "batiment" in request.data:
            try:
                nouveau_batiment = Batiment.objects.get(pk=request.data["batiment"])
            except (Batiment.DoesNotExist, TypeError, ValueError):
                return Response({"error": "Bâtiment introuvable."}, status=status.HTTP_400_BAD_REQUEST)
            if nouveau_batiment.id != rapport.batiment_id:
                rapport.batiment = nouveau_batiment
                changements.append(f"Bâtiment changé pour {nouveau_batiment.adresse_complete}")

        if "techniciens" in request.data:
            rapport.techniciens.set(request.data.get("techniciens") or [])
            changements.append("Techniciens réassignés")

        if "citoyen" in request.data:
            citoyen_id = request.data.get("citoyen")
            if citoyen_id:
                try:
                    nouveau_citoyen = Utilisateur.objects.get(pk=citoyen_id, role=Utilisateur.Role.CITOYEN)
                except (Utilisateur.DoesNotExist, TypeError, ValueError):
                    return Response({"error": "Citoyen introuvable."}, status=status.HTTP_400_BAD_REQUEST)
                rapport.citoyen = nouveau_citoyen
                changements.append(f"Citoyen réassigné à {nouveau_citoyen.username}")
            else:
                rapport.citoyen = None
                changements.append("Citoyen retiré du rapport")

        if changements:
            rapport.save()
            for c in changements:
                rapport.historiser(request.user, c)

        return Response(RapportExtincteurDetailSerializer(rapport).data)

    @action(detail=True, methods=["post"])
    def rouvrir(self, request, pk=None):
        rapport = self.get_object()
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut rouvrir un rapport."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut != RapportExtincteur.Statut.FERME:
            return Response({"error": "Ce rapport est déjà ouvert."}, status=status.HTTP_400_BAD_REQUEST)

        rapport.rouvrir(request.user)
        return Response(RapportExtincteurDetailSerializer(rapport).data)

    def perform_create(self, serializer):
        rapport = serializer.save(cree_par=self.request.user)
        if self.request.user.est_technicien() and not rapport.techniciens.filter(pk=self.request.user.pk).exists():
            # Auto-assignation — un technicien qui crée son propre rapport
            # doit forcément en faire partie, personne d'autre ne le ferait.
            rapport.techniciens.add(self.request.user)
        rapport.historiser(self.request.user, "Rapport créé")

        # Une inspection couvre extincteurs + éclairage d'urgence en même
        # temps — le rapport éclairage correspondant est donc créé et lié
        # automatiquement, pour n'avoir qu'un seul certificat à la fermeture.
        from eclairage.models import RapportEclairage

        rapport_eclairage = RapportEclairage.objects.create(
            batiment=rapport.batiment,
            cree_par=self.request.user,
            numero_job=rapport.numero_job,
            date_inspection=rapport.date_inspection,
            rapport_extincteur=rapport,
        )
        rapport_eclairage.techniciens.set(rapport.techniciens.all())
        rapport_eclairage.historiser(
            self.request.user, "Rapport créé automatiquement avec le rapport extincteur"
        )

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.statut == RapportExtincteur.Statut.FERME and not self.request.user.est_superviseur():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Ce rapport est fermé et ne peut plus être modifié.")
        rapport = serializer.save()
        rapport.historiser(self.request.user, "Rapport modifié")

    @action(detail=True, methods=["post"])
    def fermer(self, request, pk=None):
        rapport = self.get_object()
        if not (request.user.est_superviseur() or request.user.est_technicien()):
            return Response(
                {"error": "Seuls le superviseur et le technicien peuvent fermer un rapport."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut == RapportExtincteur.Statut.FERME:
            return Response({"error": "Ce rapport est déjà fermé."}, status=status.HTTP_400_BAD_REQUEST)

        rapport.fermer(request.user)
        return Response(RapportExtincteurDetailSerializer(rapport).data)

    @action(detail=True, methods=["post"], url_path="envoyer-certificat")
    def envoyer_certificat(self, request, pk=None):
        rapport = self.get_object()
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut envoyer le certificat."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut != RapportExtincteur.Statut.FERME:
            return Response(
                {"error": "Le rapport doit être fermé avant d'envoyer le certificat."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not hasattr(rapport, "certificat"):
            return Response({"error": "Aucun certificat trouvé pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)

        if rapport.batiment.client.mode_livraison == Client.ModeLivraison.DIRECT:
            from .emailing import envoyer_certificats_directs_batiment

            ok, message = envoyer_certificats_directs_batiment(rapport.batiment, request.user)
            if not ok:
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"message": message})

        rapport.certificat.certificat_envoye = True
        rapport.certificat.mode_envoi = ModeEnvoi.CITOYEN
        rapport.certificat.date_envoi = timezone.now()
        rapport.certificat.envoye_a = rapport.citoyen.username if rapport.citoyen else ""
        rapport.certificat.save()
        rapport.historiser(request.user, f"Certificat envoyé au citoyen {rapport.citoyen.username if rapport.citoyen else '—'}")

        if rapport.citoyen and rapport.citoyen.email:
            from .emailing import envoyer_email_certificat_extincteur_disponible

            envoyer_email_certificat_extincteur_disponible(rapport)

        return Response({"message": "Certificat envoyé au citoyen."})

    @action(detail=True, methods=["get", "post"])
    def extincteurs(self, request, pk=None):
        rapport = self.get_object()

        if request.method == "GET":
            return Response(ExtincteurItemSerializer(rapport.extincteurs.all(), many=True).data)

        if rapport.statut == RapportExtincteur.Statut.FERME and not request.user.est_superviseur():
            return Response(
                {"error": "Ce rapport est fermé, impossible d'ajouter un extincteur."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ExtincteurItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ordre = serializer.validated_data.get("ordre") or (rapport.extincteurs.count() + 1)
        serializer.save(rapport=rapport, ordre=ordre)
        rapport.historiser(request.user, "Extincteur ajouté")
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"])
    def boyaux(self, request, pk=None):
        rapport = self.get_object()

        if request.method == "GET":
            return Response(BoyauItemSerializer(rapport.boyaux.all(), many=True).data)

        if rapport.statut == RapportExtincteur.Statut.FERME and not request.user.est_superviseur():
            return Response(
                {"error": "Ce rapport est fermé, impossible d'ajouter un boyau."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = BoyauItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ordre = serializer.validated_data.get("ordre") or (rapport.boyaux.count() + 1)
        serializer.save(rapport=rapport, ordre=ordre)
        rapport.historiser(request.user, "Boyau ajouté")
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def historique(self, request, pk=None):
        rapport = self.get_object()
        return Response(HistoriqueRapportExtincteurSerializer(rapport.historique.all(), many=True).data)

    @action(detail=True, methods=["get"], url_path="certificat-pdf")
    def certificat_pdf(self, request, pk=None):
        rapport = self.get_object()
        if rapport.statut != RapportExtincteur.Statut.FERME:
            return Response({"error": "Le rapport doit être fermé."}, status=status.HTTP_400_BAD_REQUEST)
        if not hasattr(rapport, "certificat"):
            return Response({"error": "Aucun certificat pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)

        cert = rapport.certificat
        bat = rapport.batiment
        adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
        if bat.code_postal:
            adresse += f"  {bat.code_postal}"
        date_insp = _date_inspection_fr(rapport)
        date_cert = _date_emission_fr(cert)
        techniciens = list(rapport.techniciens.all())
        items = list(rapport.extincteurs.all())

        # ── Certificat unifié : une visite couvre extincteurs + éclairage
        # d'urgence en même temps, un seul certificat doit donc refléter
        # l'état des deux équipements (voir rapport_eclairage_lie).
        rapport_eclairage = getattr(rapport, "rapport_eclairage_lie", None)
        lumieres = list(rapport_eclairage.lumieres.all()) if rapport_eclairage else []

        equipement_rows = (
            _ligne_equipement_certificat("Extincteur", True, items)
            + _ligne_equipement_certificat("Éclairage d'urgence", rapport_eclairage is not None, lumieres, defaut_en_so=True)
        )

        return HttpResponse(
            _html_certificat_unifie(
                cert=cert, bat=bat, date_insp=date_insp, techniciens=techniciens,
                equipement_rows=equipement_rows, est_conforme=_est_conforme_unifie(rapport),
            ),
            content_type="text/html; charset=utf-8",
        )

    @action(detail=True, methods=["get"], url_path="telecharger")
    def telecharger(self, request, pk=None):
        rapport = self.get_object()
        bat = rapport.batiment
        adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
        date_insp = _date_inspection_fr(rapport)
        techniciens = list(rapport.techniciens.all())
        tech_noms = ", ".join(t.get_full_name() or t.username for t in techniciens) or "—"

        legende_rows = "".join(
            f"<tr><td class='bold' style='width:50px;'>{code}</td><td>{desc}</td></tr>"
            for code, desc in LEGENDE_EXTINCTEURS
        )

        items = list(rapport.extincteurs.all())
        item_rows = ""
        for it in items:
            is_defect = it.etat == ExtincteurItem.Etat.DEFECTUEUX
            is_ni = not is_defect and it.etat == "NI"
            bg = ' style="background:#fef2f2;"' if is_defect else ' style="background:#fef3c7;"' if is_ni else ""
            etat_style = ' style="color:#cc0000;"' if is_defect else ' style="color:#b45309;"' if is_ni else ""
            item_rows += (
                f"<tr{bg}>"
                f"<td class='center'>{it.ordre}</td>"
                f"<td>{it.etage or '—'}</td>"
                f"<td>{it.emplacement or '—'}</td>"
                f"<td class='center'>{it.get_type_extincteur_display() if it.type_extincteur else '—'}</td>"
                f"<td class='center'>{it.get_format_display() if it.format else '—'}</td>"
                f"<td>{it.get_marque_display() if it.marque else '—'}</td>"
                f"<td class='center'>{it.date_fabrication or '—'}</td>"
                f"<td class='center'>{it.prochaine_maintenance or '—'}</td>"
                f"<td class='center'>{it.prochain_test_hydrostatique or '—'}</td>"
                f"<td>{escape(it.numero_serie) or '—'}</td>"
                f"<td class='center bold'{etat_style}>{it.etat or '—'}</td>"
                f"<td>{it.remarque or ''}</td>"
                f"</tr>"
            )
        if not item_rows:
            item_rows = "<tr><td colspan='12' class='muted center'>Aucun extincteur enregistré</td></tr>"

        boyaux = list(rapport.boyaux.all())
        boyau_rows = ""
        for b in boyaux:
            is_defect = b.etat == ExtincteurItem.Etat.DEFECTUEUX
            is_ni = not is_defect and b.etat == "NI"
            bg = ' style="background:#fef2f2;"' if is_defect else ' style="background:#fef3c7;"' if is_ni else ""
            etat_style = ' style="color:#cc0000;"' if is_defect else ' style="color:#b45309;"' if is_ni else ""
            boyau_rows += (
                f"<tr{bg}>"
                f"<td class='center'>{b.ordre}</td>"
                f"<td>{b.etage or '—'}</td>"
                f"<td>{b.emplacement or '—'}</td>"
                f"<td class='center'>{b.get_longueur_display() if b.longueur else '—'}</td>"
                f"<td class='center'>{b.date_fabrication or '—'}</td>"
                f"<td class='center'>{b.prochain_test_hydrostatique or '—'}</td>"
                f"<td class='center bold'{etat_style}>{b.etat or '—'}</td>"
                f"<td>{b.remarque or ''}</td>"
                f"</tr>"
            )
        if not boyau_rows:
            boyau_rows = "<tr><td colspan='8' class='muted center'>Aucun boyau enregistré</td></tr>"

        logo_content = logo_wordmark_data_uri(46)

        html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport de vérification extincteurs portatifs — {adresse}</title>
<style>
  @page {{ margin: 14mm 12mm; }}
  *{{ box-sizing:border-box; margin:0; padding:0; }}
  body{{ font-family:Arial,Helvetica,sans-serif; font-size:9pt; color:#000; background:#fff; }}
  .header{{ display:flex; align-items:center; justify-content:space-between; background:#0a0b0d; padding:12px 18px; border-radius:6px; margin-bottom:14px; }}
  .brand{{ display:flex; align-items:center; gap:12px; }}
  .logo-box{{ height:46px; max-width:180px; display:flex; align-items:center; flex-shrink:0; }} .logo-box img{{ max-height:100%; max-width:100%; }}
  .brand-text h1{{ font-size:12pt; font-weight:900; color:#ffffff; text-transform:uppercase; }}
  .brand-text p{{ font-size:7.5pt; color:rgba(255,255,255,0.7); margin-top:1px; }}
  .info-grid{{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:18px; }}
  .info-card{{ border:1px solid #ccc; border-radius:4px; padding:8px 12px; }}
  .card-title{{ font-size:7pt; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#555; margin-bottom:4px; }}
  .card-main{{ font-size:10pt; font-weight:700; color:#000; }}
  .title-banner{{ background:#0a0b0d; color:#fff; text-align:center; padding:8px 0; border-radius:4px; margin-bottom:12px; }}
  .title-banner h2{{ font-size:11pt; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; }}
  .sec-title{{ font-size:8.5pt; font-weight:700; text-transform:uppercase; color:#000; border-bottom:2px solid #000; padding-bottom:3px; margin-bottom:6px; margin-top:14px; }}
  table{{ width:100%; border-collapse:collapse; font-size:8pt; }}
  th{{ background:#fef2f2; color:#000; font-weight:700; padding:4px 6px; text-align:left; font-size:7.5pt; border:1px solid #ccc; }}
  td{{ padding:4px 6px; border:1px solid #ddd; color:#000; }}
  .center{{ text-align:center; }} .bold{{ font-weight:700; }} .muted{{ color:#777; font-style:italic; }}
  .legende-box{{ border:1px solid #999; border-radius:4px; padding:8px 10px; margin-bottom:10px; background:#fafafa; }}
  .legende-box table td{{ border:none; padding:2px 8px; font-size:8pt; }}
  .footer{{ margin-top:20px; padding-top:8px; border-top:1px solid #ccc; display:flex; justify-content:space-between; font-size:7pt; color:#555; }}
  @media print{{ body{{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }} .no-print{{ display:none!important; }} }}
</style>
</head>
<body>
<div class="no-print" style="text-align:right;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
  <button onclick="window.print()" style="background:#0a0b0d;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:700;cursor:pointer;font-size:10pt;">Imprimer / Enregistrer PDF</button>
</div>
<div style="padding:16px 20px;">
<div class="header">
  <div class="brand">
    <div class="logo-box">{logo_content}</div>
    <div class="brand-text">
      <h1>Extincteur<span style="color:#e11324;">GP</span><span style="font-weight:400;">inc</span></h1>
      <p>Rapport de vérification — Extincteurs portatifs</p>
    </div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:8pt;font-weight:700;text-transform:uppercase;color:{'#4ade80' if rapport.statut == 'ferme' else '#f87171'};">{rapport.get_statut_display()}</div>
    <div style="font-size:7.5pt;color:rgba(255,255,255,0.7);margin-top:4px;">Date d'inspection : <strong style="color:#fff;">{date_insp}</strong></div>
    <div style="font-size:7.5pt;color:rgba(255,255,255,0.7);margin-top:1px;">Technicien(s) : <strong style="color:#fff;">{tech_noms}</strong></div>
  </div>
</div>
<div class="title-banner"><h2>Rapport de vérification — Extincteurs portatifs</h2></div>
<div style="text-align:left;margin-bottom:8px;">
  <div class="card-title">Client</div>
  <div class="card-main" style="font-size:11pt;">{bat.client.nom}</div>
</div>
<div class="info-card" style="text-align:center;margin-bottom:18px;">
  <div class="card-title">Adresse</div>
  <div class="card-main" style="font-size:14pt;">{adresse}</div>
</div>
<div class="legende-box">
<table><tbody>{legende_rows}</tbody></table>
</div>
<div class="sec-title">Détail des extincteurs</div>
<table>
  <thead><tr>
    <th>No</th><th>Étage</th><th>Emplacement</th><th>Type</th><th>Format</th>
    <th>Marque</th><th>Date fabrication</th><th>Prochaine maintenance</th>
    <th>Prochain test hydro.</th><th>N° série</th><th title="D=Défectueux, C=Conforme, NI=Non inspecté">État</th><th>Remarque</th>
  </tr></thead>
  <tbody>{item_rows}</tbody>
</table>
<div class="sec-title">Détail des boyaux</div>
<table>
  <thead><tr>
    <th>No</th><th>Étage</th><th>Emplacement</th><th>Longueur</th>
    <th>Date fabrication</th><th>Prochain test hydro.</th>
    <th title="D=Défectueux, C=Conforme, NI=Non inspecté">État</th><th>Remarque</th>
  </tr></thead>
  <tbody>{boyau_rows}</tbody>
</table>
{pied_de_page_entreprise()}
</div>
</body>
</html>"""
        return HttpResponse(html, content_type="text/html; charset=utf-8")


class ExtincteurItemViewSet(viewsets.ModelViewSet):
    """Accès direct à une ligne d'extincteur — pour la corriger ou la supprimer."""

    serializer_class = ExtincteurItemSerializer
    permission_classes = [permissions.IsAuthenticated, EstSuperviseurOuTechnicien]

    def get_queryset(self):
        user = self.request.user
        qs = ExtincteurItem.objects.select_related("rapport")
        if user.est_technicien():
            qs = qs.filter(rapport__techniciens=user)
        return qs.distinct()

    def perform_update(self, serializer):
        item = self.get_object()
        if item.rapport.statut == RapportExtincteur.Statut.FERME and not self.request.user.est_superviseur():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Le rapport associé est fermé.")
        serializer.save()


class BoyauItemViewSet(viewsets.ModelViewSet):
    """Accès direct à une ligne de boyau — pour la corriger ou la supprimer."""

    serializer_class = BoyauItemSerializer
    permission_classes = [permissions.IsAuthenticated, EstSuperviseurOuTechnicien]

    def get_queryset(self):
        user = self.request.user
        qs = BoyauItem.objects.select_related("rapport")
        if user.est_technicien():
            qs = qs.filter(rapport__techniciens=user)
        return qs.distinct()

    def perform_update(self, serializer):
        item = self.get_object()
        if item.rapport.statut == RapportExtincteur.Statut.FERME and not self.request.user.est_superviseur():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Le rapport associé est fermé.")
        serializer.save()


# ── Certificats — vue agrégée tous rapports confondus ──────────────────────
def _certificats_extincteur():
    """Un seul certificat unifié par visite — extincteurs + éclairage
    d'urgence."""
    certs = CertificatExtincteur.objects.select_related(
        "rapport", "rapport__batiment", "rapport__batiment__client", "emis_par"
    )
    resultats = []
    for c in certs:
        r = c.rapport
        bat = r.batiment
        resultats.append({
            "cle": f"extincteur-{c.id}",
            "type": "extincteur",
            "type_display": "Extincteur & éclairage",
            "numero": c.numero,
            "date_emission": c.date_emission,
            "certificat_envoye": c.certificat_envoye,
            "conforme": _est_conforme_unifie(r),
            "adresse": bat.adresse_complete,
            "client_nom": bat.client.nom,
            "client_id": bat.client_id,
            "rapport_id": r.id,
            "statut_rapport": r.statut,
            "url_rapport": f"/superviseur/rapports-extincteurs/{r.id}",
            "url_certificat_pdf": f"/api/rapports-extincteurs/{r.id}/certificat-pdf/",
        })
    return resultats


def _lister_certificats(request):
    """Agrège les certificats de tous les modules, filtrés par les
    paramètres de requête communs (recherche, type, statut, conformité)."""
    resultats = []
    type_filtre = request.query_params.get("type")
    if type_filtre in (None, "", "extincteur"):
        resultats += _certificats_extincteur()

    recherche = (request.query_params.get("recherche") or "").strip().lower()
    if recherche:
        resultats = [
            r for r in resultats
            if recherche in r["adresse"].lower()
            or recherche in r["client_nom"].lower()
            or recherche in r["numero"].lower()
        ]

    statut_filtre = request.query_params.get("statut")
    if statut_filtre == "envoye":
        resultats = [r for r in resultats if r["certificat_envoye"]]
    elif statut_filtre == "non_envoye":
        resultats = [r for r in resultats if not r["certificat_envoye"]]

    conformite_filtre = request.query_params.get("conforme")
    if conformite_filtre == "oui":
        resultats = [r for r in resultats if r["conforme"]]
    elif conformite_filtre == "non":
        resultats = [r for r in resultats if not r["conforme"]]

    client_id = request.query_params.get("client")
    if client_id:
        resultats = [r for r in resultats if str(r["client_id"]) == str(client_id)]

    resultats.sort(key=lambda r: r["date_emission"], reverse=True)
    return resultats


class CertificatsUnifiesView(APIView):
    """Vue agrégée de tous les certificats émis — pour le superviseur qui
    veut retrouver un certificat sans naviguer dans chaque rapport."""

    permission_classes = [permissions.IsAuthenticated, EstSuperviseur]

    def get(self, request):
        resultats = _lister_certificats(request)
        return Response([
            {**r, "date_emission": r["date_emission"].isoformat()}
            for r in resultats
        ])
