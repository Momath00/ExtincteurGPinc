from collections import Counter

from django.db.models import ProtectedError
from django.http import HttpResponse
from django.utils.html import escape
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from securiteincendie.emailing import logo_wordmark_data_uri, pied_de_page_nationex

from accounts.models import Utilisateur
from .models import (
    Batiment,
    BoyauItem,
    CertificatCuisine,
    CertificatExtincteur,
    Client,
    ExtincteurItem,
    HotteCuisine,
    ModeEnvoi,
    RapportCuisine,
    RapportExtincteur,
)
from .serializers import (
    BatimentSerializer,
    BoyauItemSerializer,
    ClientSerializer,
    ExtincteurItemSerializer,
    HistoriqueRapportCuisineSerializer,
    HistoriqueRapportExtincteurSerializer,
    HotteCuisineSerializer,
    RapportCuisineCreateSerializer,
    RapportCuisineDetailSerializer,
    RapportCuisineListSerializer,
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

# ── Liste des vérifications du système d'extinction de cuisine (ULC ORD 1254.6) ──
CHECKLIST_CUISINE = [
    ("appareils_proteges", "Vérifier si les appareils sont protégés de façon adéquate"),
    ("liens_fusibles_remplaces", "Remplacer le(s) lien(s)-fusible(s)"),
    ("installation_conforme_fabricant", "Vérifier si le système est installé selon les normes du fabricant"),
    ("cable_tension_verifie", "Vérifier le câble de tension pour corrosion ou effilochure"),
    ("pression_manometre_verifiee", "Vérifier la pression du manomètre"),
    ("conduits_decharge_verifies", "Vérifier tous les conduits de déchargement et fixations"),
    ("cylindres_supports_inspectes", "Inspecter et nettoyer le(s) cylindre(s) et le(s) support(s)"),
    ("extincteur_portatif_type_k", "Vérifier la présence d'un extincteur portatif conforme (type K)"),
    ("station_manuelle_degagee", "Vérifier l'absence d'obstruction devant la station manuelle"),
    ("etiquettes_verification_apposees", "Apposer les étiquettes de vérification"),
    ("buses_protecteurs_nettoyes", "Nettoyer et vérifier les buses et leurs protecteurs"),
    ("systeme_condition_normale", "Laisser le système en condition d'opération normale"),
    ("liens_fusibles_nettoyes", "Nettoyer et vérifier le(s) lien(s)-fusible(s)"),
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
    """Non conforme dès qu'un extincteur ou le système cuisine liés sont
    défectueux/non conformes — même logique que le certificat unifié
    affiché sur certificat-pdf. Une unité d'éclairage d'urgence
    défectueuse ne rend PAS le certificat non conforme : la ligne
    Éclairage d'urgence passe alors à « S.O. » (décision d'affaires)."""
    rapport_cuisine = getattr(rapport, "rapport_cuisine_lie", None)
    items = list(rapport.extincteurs.all())
    return (
        not any(it.etat == "D" for it in items)
        and (rapport_cuisine is None or rapport_cuisine.est_conforme)
    )


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


def _ligne_equipement_certificat(nom, applicable, items_liste, etat_attr="etat", etat_defectueux="D", conforme_override=None, defaut_en_so=False):
    if defaut_en_so and any(getattr(it, etat_attr) == etat_defectueux for it in items_liste):
        # Éclairage d'urgence : une unité défectueuse affiche la
        # ligne en « S.O. » plutôt que NON CONFORME (voir
        # _est_conforme_unifie).
        applicable = False
    if conforme_override is not None:
        # Utilisé pour les équipements dont la conformité est un
        # simple booléen (ex. rapport cuisine) plutôt qu'une liste
        # d'items avec un attribut d'état individuel.
        so = not applicable
        defectueux = applicable and not conforme_override
        conforme = applicable and conforme_override
    else:
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
    """Gabarit du certificat unifié (extincteurs + éclairage d'urgence +
    cuisine) — partagé par le certificat du rapport extincteurs et par celui
    d'un rapport cuisine indépendant (seule la ligne cuisine y est
    applicable, le reste en S.O.)."""
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    if bat.code_postal:
        adresse += f"  {bat.code_postal}"
    date_cert = _date_emission_fr(cert)

    def _nom_pro(utilisateur):
        return utilisateur.get_full_name() or utilisateur.username.capitalize()

    tech_noms = ", ".join(_nom_pro(t) for t in techniciens) or "—"

    logo_content = logo_wordmark_data_uri(46)
    emetteur = _nom_pro(cert.emis_par) if cert.emis_par else "—"

    # Rapport cuisine lié SANS certificat propre : le détail (schéma,
    # checklist) reste uniquement dans son rapport imprimable
    # (GET /api/rapports-cuisine/{id}/telecharger/, accessible même sans
    # certificat) — seule la ligne de conformité apparaît ici.
    cuisine_section = ""

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
  <h1>Extincteurs Nationex <span style="font-weight:400;">Inc.</span></h1>
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
{cuisine_section}
<p style="text-align:center;font-weight:700;font-size:8.5pt;color:#0a0b0d;margin-top:10px;line-height:1.4;">
  L'inspection régulière et l'entretien de l'équipement tels que recommandés<br>par le manufacturier ont été effectués.
</p>
<div class="sig-row">
  <div class="sig-block">
<div class="sig-label">Superviseur / Responsable</div>
<div class="sig-name">{emetteur}</div>
<div style="font-size:7.5pt;color:#555;">Extincteurs Nationex</div>
  </div>
  <div class="sig-block">
<div class="sig-label">Date d'émission</div>
<div class="sig-name">{date_cert}</div>
<div style="font-size:7.5pt;color:#555;">Certificat N° {cert.numero}</div>
  </div>
</div>
<div style="font-size:7pt;color:#9ca3af;margin-top:10px;">Ce certificat atteste la vérification des extincteurs portatifs et de l'éclairage d'urgence à la date d'inspection indiquée.</div>
{pied_de_page_nationex()}
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

        # Le système d'extinction de cuisine n'équipe pas tous les
        # bâtiments (surtout les cuisines commerciales) — il n'est créé que
        # si le formulaire indique explicitement que le bâtiment en est
        # équipé, contrairement à l'éclairage ci-dessus.
        # Un rapport cuisine déjà ouvert pour ce bâtiment (créé seul, depuis
        # la page Rapports cuisine) fait partie de la même visite — on le
        # rattache plutôt que d'en créer un second, pour qu'il apparaisse
        # sur le certificat unifié au lieu d'avoir son propre certificat.
        cuisine_existante = (
            RapportCuisine.objects.filter(
                batiment=rapport.batiment,
                statut=RapportCuisine.Statut.OUVERT,
                rapport_extincteur__isnull=True,
                certificat__isnull=True,
            )
            .order_by("-date_creation")
            .first()
        )
        if cuisine_existante is not None:
            cuisine_existante.rapport_extincteur = rapport
            cuisine_existante.save(update_fields=["rapport_extincteur"])
            cuisine_existante.historiser(
                self.request.user, "Rattaché au rapport extincteur (certificat unifié)"
            )
        elif self.request.data.get("avec_systeme_cuisine"):
            rapport_cuisine = RapportCuisine.objects.create(
                batiment=rapport.batiment,
                cree_par=self.request.user,
                numero_job=rapport.numero_job,
                date_inspection=rapport.date_inspection,
                rapport_extincteur=rapport,
            )
            rapport_cuisine.techniciens.set(rapport.techniciens.all())
            rapport_cuisine.historiser(
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

        rapport_cuisine = getattr(rapport, "rapport_cuisine_lie", None)
        cuisine_applicable = rapport_cuisine is not None
        equipement_rows = (
            _ligne_equipement_certificat(
                "Système automatique de cuisine", cuisine_applicable, [],
                conforme_override=(rapport_cuisine.est_conforme if cuisine_applicable else None),
            )
            + _ligne_equipement_certificat("Extincteur", True, items)
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
                f"<td class='center bold'{etat_style}>{it.etat or '—'}</td>"
                f"<td>{it.remarque or ''}</td>"
                f"</tr>"
            )
        if not item_rows:
            item_rows = "<tr><td colspan='11' class='muted center'>Aucun extincteur enregistré</td></tr>"

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
      <h1>Extincteurs Nationex <span style="font-weight:400;">Inc.</span></h1>
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
    <th>Prochain test hydro.</th><th title="D=Défectueux, C=Conforme, NI=Non inspecté">État</th><th>Remarque</th>
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
{pied_de_page_nationex()}
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


# ── Système d'extinction de cuisine (hotte, norme ULC ORD 1254.6 / ULC 300) ──

_HOTTE_BOX = {"x0": 34, "x1": 456, "topY": 92, "botY": 167}


def _icone_appareil_svg(code, color="#334155", size=15):
    """Icône monoligne d'un appareil — mêmes tracés que AppareilIcon côté
    frontend (frontend/components/rapports-cuisine/SchemaHottes.tsx), pour
    que le rapport imprimé corresponde exactement à l'éditeur."""
    attrs = f'width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'
    formes = {
        "F": '<rect x="5" y="4" width="14" height="16"/><rect x="9" y="6.5" width="6" height="7"/><path d="M12 20v-6.5"/><path d="M9.7 15.7L12 13.5l2.3 2.2"/>',
        "B": '<path d="M5 10h11l-1.2 8a2 2 0 0 1-2 1.7H8.2a2 2 0 0 1-2-1.7L5 10Z"/><path d="M9 13h5"/><circle cx="18.5" cy="7.5" r="2.5"/><path d="M18.5 6v1.5l1 1"/>',
        "P": '<rect x="2" y="8" width="20" height="8"/>',
        "R2": '<rect x="7" y="3" width="10" height="18" rx="1.5"/><circle cx="12" cy="8" r="2"/><circle cx="12" cy="16" r="2"/>',
        "R4": '<rect x="4" y="4" width="16" height="16" rx="1.5"/><circle cx="9" cy="9" r="1.8"/><circle cx="15" cy="9" r="1.8"/><circle cx="9" cy="15" r="1.8"/><circle cx="15" cy="15" r="1.8"/>',
        "R6": '<rect x="2" y="6" width="20" height="12" rx="1.5"/><circle cx="7" cy="10" r="1.4"/><circle cx="12" cy="10" r="1.4"/><circle cx="17" cy="10" r="1.4"/><circle cx="7" cy="14" r="1.4"/><circle cx="12" cy="14" r="1.4"/><circle cx="17" cy="14" r="1.4"/>',
        "GC": '<rect x="4" y="5" width="16" height="14"/><path d="M6 19l1.5-14M9.5 19l1.5-14M13 19l1.5-14M16.5 19l1.5-14"/>',
        "GZ": '<rect x="4" y="5" width="16" height="14"/><path d="M6 9h12M6 12h12M6 15h12"/>',
        "S": '<rect x="4" y="9" width="16" height="9"/><path d="M6.5 9v-3M10 9v-3M13.5 9v-3M17 9v-3"/>',
        "SP": f'<rect x="4" y="4" width="16" height="16" rx="1.5"/><circle cx="12" cy="12" r="1.4" fill="{color}"/><path d="M12 6.5v2.2M12 15.3v2.2M5.5 12h2.2M16.3 12h2.2M8 8l1.5 1.5M14.5 14.5L16 16M8 16l1.5-1.5M14.5 9.5L16 8"/>',
        "BP": '<path d="M4 10c1.5 1 3 1.5 8 1.5s6.5-.5 8-1.5"/><path d="M4 10v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3"/>',
        "W": '<path d="M3 12a9 9 0 0 0 18 0"/><path d="M3 12h18M5 9l-2-1.5M19 9l2-1.5"/>',
        "SH": '<path d="M12 1.5V21"/><path d="M7 4h10l-3.5 12.5h-3Z"/><path d="M8 7.5h8M9 11h6"/><path d="M6.5 21h11"/>',
    }
    contenu = formes.get(code, '<rect x="5" y="5" width="14" height="14" rx="2.5"/><path d="M9 9l6 6M15 9l-6 6"/>')
    return f"<svg {attrs}>{contenu}</svg>"


_CUISINIERE_DIMS = {
    "R2": {"w": 16, "h": 30, "cols": 1, "rows": 2},
    "R4": {"w": 26, "h": 26, "cols": 2, "rows": 2},
    "R6": {"w": 40, "h": 26, "cols": 3, "rows": 2},
}

_clip_seq_appareil = 0


def _unite_appareil_svg(code, qty, x, y, taille=None):
    """Rendu réaliste d'un appareil avec sa quantité (batterie de friteuses,
    cuisinière à feux fixes, plaque/grille sur N sections) — même logique que
    AppareilUnit côté frontend."""
    global _clip_seq_appareil
    n = max(1, qty or 1)
    step = 15
    w = 22 + (n - 1) * step
    h = 26
    stroke = "#334155"

    if code in _CUISINIERE_DIMS:
        dims = _CUISINIERE_DIMS[code]
        gap = 6
        total_w = dims["w"] * n + gap * (n - 1)
        cell_w = dims["w"] / (dims["cols"] + 1)
        cell_h = dims["h"] / (dims["rows"] + 1)
        r = min(cell_w, cell_h) * 0.32
        units = []
        for i in range(n):
            bx = x - total_w / 2 + dims["w"] / 2 + i * (dims["w"] + gap)
            burners = "".join(
                f'<circle cx="{bx - dims["w"] / 2 + cell_w * (c + 1)}" cy="{y - dims["h"] / 2 + cell_h * (row + 1)}" r="{r}" fill="none" stroke="{stroke}" stroke-width="1.1"/>'
                for row in range(dims["rows"]) for c in range(dims["cols"])
            )
            units.append(
                f'<rect x="{bx - dims["w"] / 2}" y="{y - dims["h"] / 2}" width="{dims["w"]}" height="{dims["h"]}" rx="3" fill="#fff" stroke="{stroke}" stroke-width="1.4"/>{burners}'
            )
        return "".join(units)

    if code == "F":
        # Rectangle net avec panier intérieur et tige relevée (poignée) —
        # comme la friteuse dessinée à la main.
        paniers = "".join(
            (lambda cx: (
                f'<rect x="{cx - 5}" y="{y - 7}" width="10" height="12" fill="none" stroke="{stroke}" stroke-width="1.1"/>'
                f'<path d="M {cx} {y + h / 2 - 2} V {y - 4}" fill="none" stroke="{stroke}" stroke-width="1.1"/>'
                f'<path d="M {cx - 2} {y - 1.5} L {cx} {y - 4.5} L {cx + 2} {y - 1.5}" fill="none" stroke="{stroke}" stroke-width="1.1"/>'
            ))(x - w / 2 + 11 + i * step)
            for i in range(n)
        )
        return f'<rect x="{x - w / 2}" y="{y - h / 2}" width="{w}" height="{h}" fill="#fff" stroke="{stroke}" stroke-width="1.4"/>{paniers}'

    if code == "B":
        paniers = "".join(
            (lambda cx: (
                f'<path d="M {cx - 5} {y - 6} h 10 l -1.4 9 a 1.6 1.6 0 0 1 -1.6 1.4 h -3.6 a 1.6 1.6 0 0 1 -1.6 -1.4 Z" fill="none" stroke="{stroke}" stroke-width="1.1"/>'
                f'<path d="M {cx - 3.2} {y - 6} v -1.6 h 6.4 v 1.6" fill="none" stroke="{stroke}" stroke-width="1.1"/>'
            ))(x - w / 2 + 11 + i * step)
            for i in range(n)
        )
        return f'<rect x="{x - w / 2}" y="{y - h / 2}" width="{w}" height="{h}" rx="5" fill="#fff" stroke="{stroke}" stroke-width="1.4"/>{paniers}'

    if code == "P":
        # Plaque — largeur réelle en pouces (12/24/36/48/60), pas liée à la
        # quantité. Une division tous les 12 po (segments de la plaque) —
        # même logique que AppareilUnit côté frontend.
        inch = taille or 24
        w_plaque = inch * 2
        segments = max(1, round(inch / 12))
        dividers = "".join(
            f'<line x1="{x - w_plaque / 2 + (i + 1) * (w_plaque / segments)}" y1="{y - h / 2 + 4}" x2="{x - w_plaque / 2 + (i + 1) * (w_plaque / segments)}" y2="{y + h / 2 - 4}" stroke="{stroke}" stroke-width="1"/>'
            for i in range(segments - 1)
        )
        taille_label = f'<text x="{x}" y="{y + 3}" text-anchor="middle" fill="{stroke}" font-size="9" font-weight="700">{inch}″</text>'
        return f'<rect x="{x - w_plaque / 2}" y="{y - h / 2}" width="{w_plaque}" height="{h}" fill="#fff" stroke="{stroke}" stroke-width="1.4"/>{dividers}{taille_label}'

    if code == "GC":
        # Rectangle net (coins non arrondis) rempli de traits quasi verticaux
        # (léger biais), serrés, comme une grille de charbon vue de face.
        _clip_seq_appareil += 1
        clip_id = f"grillClip{_clip_seq_appareil}"
        slant = 6
        diag_lines = []
        dx = -slant
        while dx <= w + slant:
            lx1 = x - w / 2 + dx
            ly1 = y + h / 2
            lx2 = lx1 + slant
            ly2 = y - h / 2
            diag_lines.append(f'<line x1="{lx1}" y1="{ly1}" x2="{lx2}" y2="{ly2}" stroke="{stroke}" stroke-width="1"/>')
            dx += 6
        return (
            f'<defs><clipPath id="{clip_id}"><rect x="{x - w / 2}" y="{y - h / 2}" width="{w}" height="{h}"/></clipPath></defs>'
            f'<rect x="{x - w / 2}" y="{y - h / 2}" width="{w}" height="{h}" fill="#fff" stroke="{stroke}" stroke-width="1.4"/>'
            f'<g clip-path="url(#{clip_id})">{"".join(diag_lines)}</g>'
        )

    if code == "GZ":
        # Grille à gaz — même rectangle que la grille charbon, barreaux
        # horizontaux (même rendu que AppareilUnit côté frontend).
        barreaux = "".join(
            f'<line x1="{x - w / 2 + 3}" y1="{y - h / 2 + dy}" x2="{x + w / 2 - 3}" y2="{y - h / 2 + dy}" stroke="{stroke}" stroke-width="1"/>'
            for dy in range(4, h - 2, 5)
        )
        return f'<rect x="{x - w / 2}" y="{y - h / 2}" width="{w}" height="{h}" fill="#fff" stroke="{stroke}" stroke-width="1.4"/>{barreaux}'

    if code == "S":
        tick_count = max(3, round(w / 8))
        ticks = "".join(
            f'<line x1="{x - w / 2 + 4 + (i * (w - 8)) / (tick_count - 1)}" y1="{y - h / 2}" x2="{x - w / 2 + 4 + (i * (w - 8)) / (tick_count - 1)}" y2="{y - h / 2 + 6}" stroke="{stroke}" stroke-width="1"/>'
            for i in range(tick_count)
        )
        return f'<rect x="{x - w / 2}" y="{y - h / 2}" width="{w}" height="{h}" fill="#fff" stroke="{stroke}" stroke-width="1.4"/>{ticks}'

    # Même boîte arrondie que friteuse/cuisinière/grille — la quantité est une
    # pastille ×N plutôt qu'une icône répétée, pour rester lisible.
    w_badge = 34
    badge = (
        f'<circle cx="{x + w_badge / 2 - 3}" cy="{y + h / 2 - 3}" r="7" fill="#dc2626"/>'
        f'<text x="{x + w_badge / 2 - 3}" y="{y + h / 2 - 2.5}" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="9" font-weight="800">×{n}</text>'
        if n > 1 else ""
    )
    icone = _icone_appareil_svg(code, stroke, 17)
    return (
        f'<rect x="{x - w_badge / 2}" y="{y - h / 2}" width="{w_badge}" height="{h}" rx="6" fill="#fff" stroke="{stroke}" stroke-width="1.4"/>'
        f'<g transform="translate({x - 8.5},{y - 8.5})">{icone}</g>{badge}'
    )


def _buse_salamandre_svg(a, y):
    """Buse coudée à 90° à l'intérieur d'une salamandre — « |_> » (droite)
    ou « <_| » (gauche). Même tracé que traceBuseSalamandre dans
    SchemaHottes.tsx."""
    sens = a.get("buse")
    if a.get("code") != "S" or sens not in ("gauche", "droite"):
        return ""
    x = a.get("x", 0)
    s = 1 if sens == "droite" else -1
    shaft = f"M {x - 6 * s} {y - 5} L {x - 6 * s} {y + 5} L {x + 4 * s} {y + 5}"
    tip = f"{x + 4 * s},{y + 2} {x + 4 * s},{y + 8} {x + 8 * s},{y + 5}"
    couleur = "#dc2626" if a.get("buse_conforme") is False else "#16a34a"
    return (
        f'<path d="{shaft}" fill="none" stroke="{couleur}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
        f'<polygon points="{tip}" fill="{couleur}"/>'
    )


def _rendu_hotte_html(hotte):
    """Rendu SVG d'une hotte pour l'impression (rapport et certificat) —
    même schéma que l'éditeur interactif (frontend/components/rapports-cuisine/
    SchemaHottes.tsx) : les buses sont les flèches rouges placées manuellement
    (indépendantes des appareils — leur nombre ne correspond pas forcément au
    nombre d'appareils), appareils en rangée séparée avec leur quantité réelle."""
    b = _HOTTE_BOX
    appareils = hotte.appareils or []
    # Placement manuel des buses uniquement — aucune génération automatique à
    # partir de l'ancien compteur, le technicien les place lui-même. Chaque
    # buse peut être droite (par défaut, verticale) ou oblique (gauche/droite,
    # dessinée plus courte pour rester lisible) — même logique que
    # frontend/components/rapports-cuisine/SchemaHottes.tsx.
    y1_sous = b["botY"] + 6
    y1_interieur = (b["topY"] + b["botY"]) / 2
    y1_exterieur = 61

    def _buse_svg(pos):
        x = pos.get("x", 0)
        direction = pos.get("direction")
        if pos.get("exterieur"):
            y1 = y1_exterieur
        elif pos.get("interieur"):
            y1 = y1_interieur
        else:
            y1 = y1_sous
        if direction == "gauche":
            shaft = f'M {x} {y1} L {x - 7} {y1 + 10}'
            tip = f'{x - 5},{y1 + 11} {x - 10},{y1 + 8} {x - 10},{y1 + 13}'
        elif direction == "droite":
            shaft = f'M {x} {y1} L {x + 7} {y1 + 10}'
            tip = f'{x + 5},{y1 + 11} {x + 10},{y1 + 8} {x + 10},{y1 + 13}'
        elif direction == "horizontale":
            shaft = f'M {x} {y1} L {x + 12} {y1}'
            tip = f'{x + 12},{y1 - 2} {x + 12},{y1 + 2} {x + 16},{y1}'
        elif direction == "haut":
            shaft = f'M {x} {y1} L {x} {y1 - 12}'
            tip = f'{x - 2},{y1 - 12} {x + 2},{y1 - 12} {x},{y1 - 16}'
        elif direction == "fusible":
            # Lien-fusible — représenté « |--| » : deux repères verticaux
            # reliés par un trait horizontal, sans flèche.
            shaft = f'M {x - 8} {y1 - 4} L {x - 8} {y1 + 4} M {x - 8} {y1} L {x + 8} {y1} M {x + 8} {y1 - 4} L {x + 8} {y1 + 4}'
            tip = ''
        else:
            shaft = f'M {x} {y1} L {x} {y1 + 12}'
            tip = f'{x - 2},{y1 + 12} {x + 2},{y1 + 12} {x},{y1 + 16}'
        # Verte par défaut (conforme) ; rouge si marquée non conforme par le
        # technicien (mal placée, ne protège pas l'appareil visé, ou absence
        # d'une buse attendue) — même règle que SchemaHottes.tsx.
        if pos.get("conforme") is False:
            couleur = "#dc2626"
        elif direction == "fusible":
            couleur = "#2563eb"
        else:
            couleur = "#16a34a"
        tip_svg = f'<polygon points="{tip}" fill="{couleur}"/>' if tip else ''
        return f'<path d="{shaft}" fill="none" stroke="{couleur}" stroke-width="4" stroke-linecap="round"/>{tip_svg}'

    buses_svg = "".join(_buse_svg(pos) for pos in (hotte.buses or []))

    elevations_svg = "".join(
        f'<rect x="{pos.get("x", 0) - 16}" y="{(b["topY"] + b["botY"]) / 2 - 17 if pos.get("interieur") else 44}" width="32" height="34" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.75"/>'
        for pos in (hotte.elevations or [])
    )

    icon_y = 245
    # La salamandre (S) est montée en hauteur, toujours plus haute que les
    # autres appareils — même règle que SchemaHottes.tsx.
    appareils_svg = "".join(
        _unite_appareil_svg(a.get("code", ""), a.get("qty", 1), a.get("x", 0), icon_y - 40 if a.get("code") == "S" else icon_y, a.get("taille"))
        + _buse_salamandre_svg(a, icon_y - 40)
        + f'<text x="{a.get("x", 0)}" y="{(icon_y - 40 if a.get("code") == "S" else icon_y) + 24}" text-anchor="middle" fill="#334155" font-size="9" font-weight="800">{escape(_libelle_appareil(a))}</text>'
        for a in appareils
    )
    # Petits carrés « taille de hotte » (3′ à 18′), en haut à l'intérieur de
    # la hotte — même rendu que SchemaHottes.tsx (Y_TAILLE, 20×20).
    y_taille = b["topY"] + 12
    tailles_svg = "".join(
        f'<rect x="{t.get("x", 0) - 10}" y="{y_taille - 10}" width="20" height="20" fill="#fff" stroke="#334155" stroke-width="1.2"/>'
        f'<text x="{t.get("x", 0)}" y="{y_taille + 3.5}" text-anchor="middle" fill="#0f172a" font-size="9.5" font-weight="800" style="font-family:Arial,Helvetica,sans-serif;">{int(t.get("pieds", 0))}′</text>'
        for t in (hotte.tailles or [])
    )
    dividers_svg = "".join(
        f'<line x1="{d}" y1="{b["topY"]}" x2="{d}" y2="{b["botY"]}" stroke="#334155" stroke-width="2.4"/>'
        for d in (hotte.dividers or [])
    )
    svg = f"""<svg viewBox="0 0 512 270" style="width:100%;height:249px;overflow:visible;display:block;">
  <polygon points="{b['x0']},{b['topY']} {b['x1']},{b['topY']} {b['x1'] + 20},{b['topY'] - 14} {b['x0'] + 20},{b['topY'] - 14}" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.5"/>
  <polygon points="{b['x1']},{b['topY']} {b['x1'] + 20},{b['topY'] - 14} {b['x1'] + 20},{b['botY'] - 14} {b['x1']},{b['botY']}" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.5"/>
  <rect x="{b['x0']}" y="{b['topY']}" width="{b['x1'] - b['x0']}" height="{b['botY'] - b['topY']}" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.75"/>
  {dividers_svg}
  {elevations_svg}
  {tailles_svg}
  {buses_svg}
  {appareils_svg}
</svg>"""
    return f"<div style='background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:8px 8px 24px;'>{svg}</div>"


_STYLE_INFO_GRILLE = (
    "<style>"
    ".info-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-bottom:4px;}"
    ".info-tile{background:#f8fafc;border:1px solid #e5e7eb;border-left:3px solid #dc2626;border-radius:5px;padding:5px 8px;break-inside:avoid;}"
    ".info-tile .l{font-size:7.5pt;font-weight:900;text-transform:uppercase;letter-spacing:0.6px;color:#0a0b0d;}"
    ".info-tile .v{font-size:9pt;font-weight:700;color:#0a0b0d;margin-top:2px;}"
    "</style>"
)


def _grille_infos_cuisine(rapport, client_nom):
    """Section « Informations du système » du rapport cuisine — grille de
    tuiles (étiquette discrète + valeur en gras), 4 par ligne."""
    def _d(date):
        return date.strftime("%d/%m/%Y") if date else "—"

    liens = " / ".join(
        f"{n}×{t}" for n, t in (
            (rapport.liens_fusibles_360f, "360°F"),
            (rapport.liens_fusibles_450f, "450°F"),
            (rapport.liens_fusibles_500f, "500°F"),
        ) if n
    ) or "—"
    tuiles = [
        ("Client", client_nom, False),
        ("Courtier", rapport.courtier, False),
        ("Fabricant", rapport.fabricant, False),
        ("Modèle", rapport.modele, False),
        ("Type d'agent", rapport.get_type_agent_display() if rapport.type_agent else "", False),
        ("Alimentation des appareils", rapport.alimentation, False),
        ("Dispositif de coupure", rapport.get_dispositif_coupure_display() if rapport.dispositif_coupure else "", False),
        ("Raccordements auxiliaires", rapport.raccordement, False),
        ("Nombre de buses", "" if rapport.nombre_buses is None else str(rapport.nombre_buses), False),
        ("Liens fusibles (qté × °F)", liens, False),
        ("Buses / liens fusibles", rapport.buses_liens_fusibles, True),
        ("Date d'installation", _d(rapport.date_installation), False),
        ("Dernier essai hydrostatique", str(rapport.date_dernier_essai_hydrostatique.year) if rapport.date_dernier_essai_hydrostatique else "", False),
        ("Dernière recharge", _d(rapport.date_derniere_recharge), False),
        ("Prochaine inspection", _d(rapport.prochaine_inspection), False),
    ]
    tuiles_html = "".join(
        f"<div class='info-tile'{' style=\"grid-column:span 2;\"' if large else ''}>"
        f"<div class='l'>{escape(label)}</div><div class='v'>{escape(valeur or '—')}</div></div>"
        for label, valeur, large in tuiles
    )
    return f"{_STYLE_INFO_GRILLE}<div class='info-grid'>{tuiles_html}</div>"


def _libelle_appareil(a):
    """Texte sous l'appareil : la désignation saisie pour un « Autre » (O),
    sinon le code."""
    if a.get("code") == "O" and (a.get("nom") or "").strip():
        return a["nom"].strip()
    return a.get("code", "")


def _legende_appareils_html(hottes):
    appareils = [a for h in hottes for a in (h.appareils or [])]
    codes_utilises = {a.get("code") for a in appareils} - {"O"}
    labels = dict(HotteCuisine.CodeAppareil.choices)
    entrees = [
        f"<span style='margin-right:9px;font-weight:700;color:#000;'><strong style='color:#000;'>{code}</strong> {labels.get(code, code)}</span>"
        for code in sorted(codes_utilises) if code
    ]
    # « Autre » : une entrée par désignation saisie (ou « Autre » sans nom).
    noms_autres = sorted({(a.get("nom") or "").strip() for a in appareils if a.get("code") == "O"})
    entrees += [
        f"<span style='margin-right:9px;font-weight:700;color:#000;'><strong style='color:#000;'>{escape(nom) if nom else 'O'}</strong> Autre</span>"
        for nom in noms_autres
    ]
    return "".join(entrees)


class RapportCuisineViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "list":
            return RapportCuisineListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return RapportCuisineCreateSerializer
        return RapportCuisineDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs = RapportCuisine.objects.select_related(
            "batiment", "batiment__client", "cree_par", "citoyen"
        ).prefetch_related("techniciens", "hottes")

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
            return [permissions.IsAuthenticated(), EstSuperviseurOuTechnicien()]
        if self.action in ["destroy", "update", "partial_update", "reassigner", "rouvrir"]:
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

        return Response(RapportCuisineDetailSerializer(rapport).data)

    @action(detail=True, methods=["post"])
    def rouvrir(self, request, pk=None):
        rapport = self.get_object()
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut rouvrir un rapport."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut != RapportCuisine.Statut.FERME:
            return Response({"error": "Ce rapport est déjà ouvert."}, status=status.HTTP_400_BAD_REQUEST)

        rapport.rouvrir(request.user)
        return Response(RapportCuisineDetailSerializer(rapport).data)

    def perform_create(self, serializer):
        rapport = serializer.save(cree_par=self.request.user)
        if self.request.user.est_technicien() and not rapport.techniciens.filter(pk=self.request.user.pk).exists():
            rapport.techniciens.add(self.request.user)
        rapport.historiser(self.request.user, "Rapport créé")

        # Même visite qu'un rapport extincteur encore ouvert sur ce bâtiment :
        # rattachement automatique (comme l'éclairage d'urgence), pour que le
        # système cuisine figure sur le certificat unifié — sa conformité y
        # suit la question « Le système est conforme… » (est_conforme).
        if rapport.rapport_extincteur_id is None:
            rapport_extincteur = (
                RapportExtincteur.objects.filter(
                    batiment=rapport.batiment,
                    statut=RapportExtincteur.Statut.OUVERT,
                    rapport_cuisine_lie__isnull=True,
                )
                .order_by("-date_creation")
                .first()
            )
            if rapport_extincteur is not None:
                rapport.rapport_extincteur = rapport_extincteur
                rapport.save(update_fields=["rapport_extincteur"])
                rapport.historiser(
                    self.request.user, "Rattaché au rapport extincteur (certificat unifié)"
                )

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.statut == RapportCuisine.Statut.FERME and not self.request.user.est_superviseur():
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
        if rapport.statut == RapportCuisine.Statut.FERME:
            return Response({"error": "Ce rapport est déjà fermé."}, status=status.HTTP_400_BAD_REQUEST)

        rapport.fermer(request.user)
        return Response(RapportCuisineDetailSerializer(rapport).data)

    @action(detail=True, methods=["post"], url_path="envoyer-certificat")
    def envoyer_certificat(self, request, pk=None):
        rapport = self.get_object()
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut envoyer le certificat."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut != RapportCuisine.Statut.FERME:
            return Response(
                {"error": "Le rapport doit être fermé avant d'envoyer le certificat."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not hasattr(rapport, "certificat"):
            if rapport.rapport_extincteur_id:
                return Response(
                    {"error": "Ce rapport cuisine est lié à un rapport extincteur — son certificat fait partie du certificat unifié de ce dernier."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
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
            from .emailing import envoyer_email_certificat_cuisine_disponible

            envoyer_email_certificat_cuisine_disponible(rapport)

        return Response({"message": "Certificat envoyé au citoyen."})

    @action(detail=True, methods=["get", "post"])
    def hottes(self, request, pk=None):
        rapport = self.get_object()

        if request.method == "GET":
            return Response(HotteCuisineSerializer(rapport.hottes.all(), many=True).data)

        if rapport.statut == RapportCuisine.Statut.FERME and not request.user.est_superviseur():
            return Response(
                {"error": "Ce rapport est fermé, impossible d'ajouter une hotte."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = HotteCuisineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ordre = serializer.validated_data.get("ordre") or (rapport.hottes.count() + 1)
        serializer.save(rapport=rapport, ordre=ordre)
        rapport.historiser(request.user, "Hotte ajoutée")
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def historique(self, request, pk=None):
        rapport = self.get_object()
        return Response(HistoriqueRapportCuisineSerializer(rapport.historique.all(), many=True).data)

    @action(detail=True, methods=["get"], url_path="certificat-pdf")
    def certificat_pdf(self, request, pk=None):
        rapport = self.get_object()
        if rapport.statut != RapportCuisine.Statut.FERME:
            return Response({"error": "Le rapport doit être fermé."}, status=status.HTTP_400_BAD_REQUEST)
        if not hasattr(rapport, "certificat"):
            if rapport.rapport_extincteur_id:
                return Response(
                    {"error": "Ce rapport cuisine est lié à un rapport extincteur — voir le certificat unifié de ce dernier."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response({"error": "Aucun certificat pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)

        # Rapport cuisine indépendant : même certificat que les autres
        # (gabarit unifié), seule la ligne cuisine est applicable — extincteurs
        # et éclairage d'urgence en S.O. (bâtiment non lié à ces rapports).
        equipement_rows = (
            _ligne_equipement_certificat("Système automatique de cuisine", True, [], conforme_override=rapport.est_conforme)
            + _ligne_equipement_certificat("Extincteur", False, [])
            + _ligne_equipement_certificat("Éclairage d'urgence", False, [])
        )
        return HttpResponse(
            _html_certificat_unifie(
                cert=rapport.certificat, bat=rapport.batiment, date_insp=_date_inspection_fr(rapport),
                techniciens=list(rapport.techniciens.all()), equipement_rows=equipement_rows,
                est_conforme=rapport.est_conforme, sous_titre="Système d'extinction de cuisine",
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
        tech_noms = ", ".join((t.get_full_name() or t.username) for t in techniciens) or "—"
        hottes = list(rapport.hottes.all())

        def _case(actif):
            if actif:
                return (
                    "<span style='display:inline-flex;align-items:center;justify-content:center;"
                    "width:16px;height:16px;border-radius:4px;background:#16a34a;color:#fff;"
                    "font-size:11px;font-weight:900;line-height:1;flex-shrink:0;'>&#10003;</span>"
                )
            return (
                "<span style='display:inline-block;width:16px;height:16px;border-radius:4px;flex-shrink:0;"
                "border:1.5px solid #d1d5db;background:#fafafa;'></span>"
            )

        infos_html = _grille_infos_cuisine(rapport, bat.client.nom)

        hottes_html = "".join(_rendu_hotte_html(h) for h in hottes) or "<p class='muted'>Aucune hotte enregistrée</p>"
        legende_html = _legende_appareils_html(hottes)

        verif_rows = "".join(
            f"<div style='display:flex;align-items:center;gap:6px;padding:3px 8px;'>"
            f"{_case(getattr(rapport, champ) is not False)}<span>{label}</span></div>"
            for champ, label in CHECKLIST_CUISINE
        )

        logo_content = logo_wordmark_data_uri(46)

        html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport cuisine — {bat.adresse_complete}</title>
<style>
  @page {{ margin: 8mm 12mm; }}
  *{{ box-sizing:border-box; margin:0; padding:0; }}
  body{{ font-family:Arial,Helvetica,sans-serif; font-size:9pt; color:#111; background:#fff; }}
  .header{{ display:flex; align-items:center; justify-content:space-between; background:#0a0b0d; padding:9px 16px; border-radius:6px; margin-bottom:9px; }}
  .brand{{ display:flex; align-items:center; gap:10px; }}
  .logo-box{{ height:36px; max-width:170px; display:flex; align-items:center; flex-shrink:0; }} .logo-box img{{ max-height:100%; max-width:100%; }}
  .brand-text h1{{ font-size:11.5pt; font-weight:900; color:#ffffff; text-transform:uppercase; letter-spacing:1px; }}
  .brand-text p{{ font-size:7.5pt; color:rgba(255,255,255,0.7); margin-top:1px; }}
  .title-banner{{ background:#0a0b0d; color:#fff; text-align:center; padding:6px 0; border-radius:4px; margin-bottom:9px; }}
  .title-banner h2{{ font-size:11pt; font-weight:700; letter-spacing:2px; text-transform:uppercase; }}
  .sec-title{{ font-size:7.5pt; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#0a0b0d; border-bottom:1.5px solid #0a0b0d; padding-bottom:3px; margin-bottom:5px; margin-top:9px; }}
  table{{ width:100%; border-collapse:collapse; font-size:8.5pt; }}
  td{{ padding:4px 8px; border-bottom:1px solid #fef2f2; color:#111; }}
  .muted{{ color:#9ca3af; font-style:italic; }}
  .hood-grid{{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-bottom:6px; }}
  .check-grid{{ background:#f8fafc; border-radius:8px; padding:6px 4px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:2px 12px; font-size:8pt; }}
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
      <h1>Extincteurs Nationex <span style="font-weight:400;">Inc.</span></h1>
      <p>Rapport de vérification — Système d'extinction de cuisine</p>
    </div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:8pt;font-weight:700;text-transform:uppercase;color:{'#4ade80' if rapport.statut == 'ferme' else '#f87171'};">{rapport.get_statut_display()}</div>
    <div style="font-size:7.5pt;color:rgba(255,255,255,0.7);margin-top:4px;">Date d'inspection : <strong style="color:#fff;">{date_insp}</strong></div>
    <div style="font-size:7.5pt;color:rgba(255,255,255,0.7);margin-top:1px;">Technicien(s) : <strong style="color:#fff;">{tech_noms}</strong></div>
  </div>
</div>
<div class="title-banner"><h2>Rapport de vérification — Système d'extinction de cuisine</h2></div>
<div class="info-card" style="text-align:center;margin-bottom:9px;border:1px solid #e5e7eb;border-radius:6px;padding:6px 12px;">
  <div style="font-size:14pt;font-weight:700;">{adresse}</div>
</div>
<div class="sec-title">Informations du système</div>
{infos_html}
<div class="sec-title">Schéma d'installation</div>
<div class="hood-grid">{hottes_html}</div>
<div style="font-size:7.5pt;color:#000;margin:-2px 0 9px;">{legende_html}</div>
<div class="sec-title" style="display:flex;align-items:center;justify-content:space-between;">
  <span>Liste des vérifications</span>
  <span style="color:#16a34a;">{rapport.nb_verifications_conformes} / {len(CHECKLIST_CUISINE)} conformes</span>
</div>
<div class="check-grid">{verif_rows}</div>
<div class="sec-title">Commentaires</div>
<p style="font-size:9pt;color:#334155;line-height:1.5;margin-bottom:9px;border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px;background:#f9fafb;">{rapport.commentaires or '—'}</p>
{pied_de_page_nationex()}
</div>
</body>
</html>"""
        return HttpResponse(html, content_type="text/html; charset=utf-8")


class HotteCuisineViewSet(viewsets.ModelViewSet):
    """Accès direct à une hotte — pour la renommer, ajuster le nombre de
    buses, mettre à jour le schéma (appareils/dividers) ou la supprimer."""

    serializer_class = HotteCuisineSerializer
    permission_classes = [permissions.IsAuthenticated, EstSuperviseurOuTechnicien]

    def get_queryset(self):
        user = self.request.user
        qs = HotteCuisine.objects.select_related("rapport")
        if user.est_technicien():
            qs = qs.filter(rapport__techniciens=user)
        return qs.distinct()

    def perform_update(self, serializer):
        item = self.get_object()
        if item.rapport.statut == RapportCuisine.Statut.FERME and not self.request.user.est_superviseur():
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


def _certificats_cuisine():
    """Certificat propre au système d'extinction de cuisine — indépendant du
    certificat unifié extincteurs + éclairage même quand le rapport est lié
    à la même visite (sa conformité alimente aussi la ligne « Système
    automatique de cuisine » de ce certificat unifié, voir _est_conforme_unifie)."""
    certs = CertificatCuisine.objects.select_related(
        "rapport", "rapport__batiment", "rapport__batiment__client", "emis_par"
    )
    resultats = []
    for c in certs:
        r = c.rapport
        bat = r.batiment
        resultats.append({
            "cle": f"cuisine-{c.id}",
            "type": "cuisine",
            "type_display": "Système de cuisine",
            "numero": c.numero,
            "date_emission": c.date_emission,
            "certificat_envoye": c.certificat_envoye,
            "conforme": r.est_conforme,
            "adresse": bat.adresse_complete,
            "client_nom": bat.client.nom,
            "client_id": bat.client_id,
            "rapport_id": r.id,
            "statut_rapport": r.statut,
            "url_rapport": f"/superviseur/rapports-cuisine/{r.id}",
            "url_certificat_pdf": f"/api/rapports-cuisine/{r.id}/certificat-pdf/",
        })
    return resultats


def _lister_certificats(request):
    """Agrège les certificats de tous les modules, filtrés par les
    paramètres de requête communs (recherche, type, statut, conformité)."""
    resultats = []
    type_filtre = request.query_params.get("type")
    if type_filtre in (None, "", "extincteur"):
        resultats += _certificats_extincteur()
    if type_filtre in (None, "", "cuisine"):
        resultats += _certificats_cuisine()

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
