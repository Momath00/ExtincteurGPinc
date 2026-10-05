from django.http import HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from securiteincendie.emailing import logo_data_uri, pied_de_page_entreprise

from inspections.views import EstSuperviseur, EstSuperviseurOuTechnicien, _date_inspection_fr

from .models import EclairageItem, RapportEclairage
from .serializers import (
    EclairageItemSerializer,
    HistoriqueRapportEclairageSerializer,
    RapportEclairageCreateSerializer,
    RapportEclairageDetailSerializer,
    RapportEclairageListSerializer,
)


# ── Rapport éclairage d'urgence ───────────────────────────────────────────
class RapportEclairageViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "list":
            return RapportEclairageListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return RapportEclairageCreateSerializer
        return RapportEclairageDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs = RapportEclairage.objects.select_related(
            "batiment", "batiment__client", "cree_par"
        ).prefetch_related("techniciens")

        if user.est_technicien():
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
        if self.action in ["create", "destroy", "update", "partial_update", "reassigner", "rouvrir"]:
            return [permissions.IsAuthenticated(), EstSuperviseur()]
        return super().get_permissions()

    @action(detail=True, methods=["patch"])
    def reassigner(self, request, pk=None):
        """Superviseur seulement — change le bâtiment et/ou les techniciens assignés après création."""
        rapport = self.get_object()
        changements = []

        if "batiment" in request.data:
            from inspections.models import Batiment

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

        if changements:
            rapport.save()
            for c in changements:
                rapport.historiser(request.user, c)

        return Response(RapportEclairageDetailSerializer(rapport).data)

    @action(detail=True, methods=["post"])
    def rouvrir(self, request, pk=None):
        rapport = self.get_object()
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut rouvrir un rapport."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut != RapportEclairage.Statut.FERME:
            return Response({"error": "Ce rapport est déjà ouvert."}, status=status.HTTP_400_BAD_REQUEST)

        rapport.rouvrir(request.user)
        return Response(RapportEclairageDetailSerializer(rapport).data)

    def perform_create(self, serializer):
        rapport = serializer.save(cree_par=self.request.user)
        rapport.historiser(self.request.user, "Rapport créé")

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.statut == RapportEclairage.Statut.FERME and not self.request.user.est_superviseur():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Ce rapport est fermé et ne peut plus être modifié.")
        rapport = serializer.save()
        rapport.historiser(self.request.user, "Rapport modifié")

    @action(detail=True, methods=["post"])
    def fermer(self, request, pk=None):
        rapport = self.get_object()
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut fermer un rapport."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut == RapportEclairage.Statut.FERME:
            return Response({"error": "Ce rapport est déjà fermé."}, status=status.HTTP_400_BAD_REQUEST)

        rapport.fermer(request.user)
        return Response(RapportEclairageDetailSerializer(rapport).data)

    @action(detail=True, methods=["get", "post"])
    def lumieres(self, request, pk=None):
        rapport = self.get_object()

        if request.method == "GET":
            return Response(EclairageItemSerializer(rapport.lumieres.all(), many=True).data)

        if rapport.statut == RapportEclairage.Statut.FERME and not request.user.est_superviseur():
            return Response(
                {"error": "Ce rapport est fermé, impossible d'ajouter une unité."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = EclairageItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ordre = serializer.validated_data.get("ordre") or (rapport.lumieres.count() + 1)
        serializer.save(rapport=rapport, ordre=ordre)
        rapport.historiser(request.user, "Unité d'éclairage ajoutée")
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def historique(self, request, pk=None):
        rapport = self.get_object()
        return Response(HistoriqueRapportEclairageSerializer(rapport.historique.all(), many=True).data)

    @action(detail=True, methods=["get"], url_path="telecharger")
    def telecharger(self, request, pk=None):
        rapport = self.get_object()
        bat = rapport.batiment
        adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
        date_insp = _date_inspection_fr(rapport)
        techniciens = list(rapport.techniciens.all())
        tech_noms = ", ".join(t.get_full_name() or t.username for t in techniciens) or "—"

        items = list(rapport.lumieres.all())
        item_rows = ""
        for it in items:
            is_defect = it.etat == EclairageItem.Etat.DEFECTUEUX
            is_ni = not is_defect and it.etat == "NI"
            bg = ' style="background:#fef2f2;"' if is_defect else ' style="background:#fef3c7;"' if is_ni else ""
            etat_style = ' style="color:#cc0000;"' if is_defect else ' style="color:#b45309;"' if is_ni else ""
            item_rows += (
                f"<tr{bg}>"
                f"<td class='center'>{it.ordre}</td>"
                f"<td>{it.emplacement or '—'}</td>"
                f"<td>{it.etage or '—'}</td>"
                f"<td>{it.modele or '—'}</td>"
                f"<td>{it.voltage or '—'}</td>"
                f"<td class='center bold'{etat_style}>{it.etat or '—'}</td>"
                f"<td>{it.remarque or ''}</td>"
                f"</tr>"
            )
        if not item_rows:
            item_rows = "<tr><td colspan='7' class='muted center'>Aucune unité enregistrée</td></tr>"

        logo_content = logo_data_uri(46)

        html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport de vérification éclairage d'urgence — {adresse}</title>
<style>
  @page {{ margin: 14mm 12mm; }}
  *{{ box-sizing:border-box; margin:0; padding:0; }}
  body{{ font-family:Arial,Helvetica,sans-serif; font-size:9pt; color:#000; background:#fff; }}
  .header{{ display:flex; align-items:center; justify-content:space-between; background:#0f172a; padding:12px 18px; border-radius:6px; margin-bottom:14px; }}
  .brand{{ display:flex; align-items:center; gap:12px; }}
  .logo-circle{{ width:46px; height:46px; border-radius:50%; background:#ffffff; box-shadow:0 0 0 2px rgba(255,255,255,0.25); display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }}
  .brand-text h1{{ font-size:12pt; font-weight:900; color:#ffffff; text-transform:uppercase; }}
  .brand-text p{{ font-size:7.5pt; color:rgba(255,255,255,0.7); margin-top:1px; }}
  .info-card{{ border:1px solid #ccc; border-radius:4px; padding:8px 12px; }}
  .card-title{{ font-size:7pt; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#555; margin-bottom:4px; }}
  .card-main{{ font-size:10pt; font-weight:700; color:#000; }}
  .title-banner{{ background:#0f172a; color:#fff; text-align:center; padding:8px 0; border-radius:4px; margin-bottom:12px; }}
  .title-banner h2{{ font-size:11pt; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; }}
  .sec-title{{ font-size:8.5pt; font-weight:700; text-transform:uppercase; color:#000; border-bottom:2px solid #000; padding-bottom:3px; margin-bottom:6px; margin-top:14px; }}
  table{{ width:100%; border-collapse:collapse; font-size:8pt; }}
  th{{ background:#fef2f2; color:#000; font-weight:700; padding:4px 6px; text-align:left; font-size:7.5pt; border:1px solid #ccc; }}
  td{{ padding:4px 6px; border:1px solid #ddd; color:#000; }}
  .center{{ text-align:center; }} .bold{{ font-weight:700; }} .muted{{ color:#777; font-style:italic; }}
  .footer{{ margin-top:20px; padding-top:8px; border-top:1px solid #ccc; display:flex; justify-content:space-between; font-size:7pt; color:#555; }}
  @media print{{ body{{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }} .no-print{{ display:none!important; }} }}
</style>
</head>
<body>
<div class="no-print" style="text-align:right;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
  <button onclick="window.print()" style="background:#0f172a;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:700;cursor:pointer;font-size:10pt;">Imprimer / Enregistrer PDF</button>
</div>
<div style="padding:16px 20px;">
<div class="header">
  <div class="brand">
    <div class="logo-circle">{logo_content}</div>
    <div class="brand-text">
      <h1>Extincteur<span style="color:#e11324;">GP</span><span style="font-weight:400;">inc</span></h1>
      <p>Rapport de vérification — Éclairage d'urgence</p>
    </div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:8pt;font-weight:700;text-transform:uppercase;color:{'#4ade80' if rapport.statut == 'ferme' else '#f87171'};">{rapport.get_statut_display()}</div>
    <div style="font-size:7.5pt;color:rgba(255,255,255,0.7);margin-top:4px;">Date d'inspection : <strong style="color:#fff;">{date_insp}</strong></div>
    <div style="font-size:7.5pt;color:rgba(255,255,255,0.7);margin-top:1px;">Technicien(s) : <strong style="color:#fff;">{tech_noms}</strong></div>
  </div>
</div>
<div class="title-banner"><h2>Rapport d'inspection lumières d'urgence</h2></div>
<div style="text-align:left;margin-bottom:8px;">
  <div class="card-title">Client</div>
  <div class="card-main" style="font-size:11pt;">{bat.client.nom}</div>
</div>
<div class="info-card" style="text-align:center;margin-bottom:18px;">
  <div class="card-title">Adresse</div>
  <div class="card-main" style="font-size:14pt;">{adresse}</div>
</div>
<div class="sec-title">Détail des unités d'éclairage d'urgence</div>
<table>
  <thead><tr>
    <th>No</th><th>Emplacement</th><th>Étage</th><th>Modèle</th><th>Voltage</th>
    <th title="D=Défectueux, C=Conforme, NI=Non inspecté">État</th><th>Remarque</th>
  </tr></thead>
  <tbody>{item_rows}</tbody>
</table>
{pied_de_page_entreprise()}
</div>
</body>
</html>"""
        return HttpResponse(html, content_type="text/html; charset=utf-8")


class EclairageItemViewSet(viewsets.ModelViewSet):
    """Accès direct à une ligne d'éclairage — pour la corriger ou la supprimer."""

    serializer_class = EclairageItemSerializer
    permission_classes = [permissions.IsAuthenticated, EstSuperviseurOuTechnicien]

    def get_queryset(self):
        user = self.request.user
        qs = EclairageItem.objects.select_related("rapport")
        if user.est_technicien():
            qs = qs.filter(rapport__techniciens=user)
        return qs.distinct()

    def perform_update(self, serializer):
        item = self.get_object()
        if item.rapport.statut == RapportEclairage.Statut.FERME and not self.request.user.est_superviseur():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Le rapport associé est fermé.")
        serializer.save()
