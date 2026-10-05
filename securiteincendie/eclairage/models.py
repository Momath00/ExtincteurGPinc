from django.conf import settings
from django.db import models

from inspections.models import Batiment


class RapportEclairage(models.Model):
    """
    Rapport de vérification des unités d'éclairage d'urgence, effectué par le
    technicien lors d'une visite.
    """

    class Statut(models.TextChoices):
        OUVERT = "ouvert", "Ouvert"
        FERME = "ferme", "Fermé"

    batiment = models.ForeignKey(
        Batiment, on_delete=models.CASCADE, related_name="rapports_eclairage"
    )
    # Une inspection couvre généralement les extincteurs ET l'éclairage
    # d'urgence en même temps — ce rapport est alors créé automatiquement à
    # la création du rapport extincteur correspondant (voir
    # RapportExtincteurViewSet.perform_create), pour qu'un seul certificat
    # unifié puisse être délivré à la fin. Reste nullable pour les rapports
    # d'éclairage créés seuls, sans extincteur associé.
    rapport_extincteur = models.OneToOneField(
        "inspections.RapportExtincteur",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="rapport_eclairage_lie",
    )
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="rapports_eclairage_crees",
        limit_choices_to={"role__in": ["superviseur", "technicien"]},
    )
    techniciens = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="rapports_eclairage_assignes",
        limit_choices_to={"role": "technicien"},
        blank=True,
    )
    numero_job = models.CharField(max_length=50, blank=True, help_text="Champ « JOB » du formulaire papier.")

    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.OUVERT)

    date_inspection = models.DateField(null=True, blank=True)
    date_derniere_sauvegarde = models.DateTimeField(auto_now=True)
    date_fermeture = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_creation"]

    def historiser(self, utilisateur, description):
        HistoriqueRapportEclairage.objects.create(
            rapport=self, utilisateur=utilisateur, description=description
        )

    def fermer(self, utilisateur):
        from django.utils import timezone

        self.statut = self.Statut.FERME
        self.date_fermeture = timezone.now()
        self.save()
        self.historiser(utilisateur, "Rapport fermé")

    def rouvrir(self, utilisateur):
        self.statut = self.Statut.OUVERT
        self.date_fermeture = None
        self.save()
        self.historiser(utilisateur, "Rapport rouvert")

    def __str__(self):
        return f"Rapport éclairage {self.batiment.adresse_complete} — {self.get_statut_display()}"


class HistoriqueRapportEclairage(models.Model):
    """Une ligne d'audit pour un rapport éclairage d'urgence."""

    rapport = models.ForeignKey(RapportEclairage, on_delete=models.CASCADE, related_name="historique")
    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    description = models.CharField(max_length=300)
    date_heure = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_heure"]

    def __str__(self):
        return f"{self.date_heure:%Y-%m-%d %H:%M} — {self.description}"


class EclairageItem(models.Model):
    """Une ligne du tableau de vérification des unités d'éclairage d'urgence."""

    class Etat(models.TextChoices):
        DEFECTUEUX = "D", "Défectueux"
        CONFORME = "C", "Conforme"
        NON_INSPECTE = "NI", "Non inspecté"

    rapport = models.ForeignKey(RapportEclairage, on_delete=models.CASCADE, related_name="lumieres")

    emplacement = models.CharField(max_length=200, blank=True, help_text="Emplacement")
    etage = models.CharField(max_length=100, blank=True)
    modele = models.CharField(max_length=100, blank=True)
    voltage = models.CharField(max_length=50, blank=True)
    etat = models.CharField(max_length=2, choices=Etat.choices, null=True, blank=True, default=None)
    remarque = models.CharField(max_length=300, blank=True)

    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]

    def __str__(self):
        return f"Éclairage #{self.ordre} — {self.rapport}"
