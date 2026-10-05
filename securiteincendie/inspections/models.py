from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Client(models.Model):
    """L'entreprise avec qui ExtincteurGPinc travaille.
    Regroupe tous les bâtiments et rapports d'une même entreprise cliente."""

    class ModeLivraison(models.TextChoices):
        PLATEFORME = "plateforme", "Espace client (invitation)"
        DIRECT = "direct", "Envoi direct par courriel (PDF joint)"

    nom = models.CharField(max_length=150, unique=True)
    contact_nom = models.CharField(max_length=150, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_telephone = models.CharField(max_length=20, blank=True)
    contact_cellulaire = models.CharField(max_length=20, blank=True)
    # Adresse de facturation (« Facturer à » sur le rapport).
    adresse = models.CharField(max_length=300, blank=True)
    ville = models.CharField(max_length=100, blank=True)
    code_postal = models.CharField(max_length=10, blank=True)
    mode_livraison = models.CharField(
        max_length=20,
        choices=ModeLivraison.choices,
        default=ModeLivraison.PLATEFORME,
        help_text=(
            "« Direct » : pas de compte à créer — les rapports et certificats PDF sont "
            "envoyés directement à contact_email. Recommandé pour les clients avec peu "
            "de bâtiments."
        ),
    )
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class Batiment(models.Model):
    """Une adresse inspectée, rattachée à un client (l'entreprise) et,
    optionnellement, à un citoyen propriétaire."""

    client = models.ForeignKey(
        Client, on_delete=models.PROTECT, related_name="batiments"
    )

    # Nom du lieu des travaux, quand l'adresse seule ne suffit pas —
    # ex. « Zone 100 » d'une usine où chaque zone a son propre rapport.
    nom = models.CharField(max_length=150, blank=True)
    numero_civique = models.CharField(max_length=10)
    rue = models.CharField(max_length=200)
    ville = models.CharField(max_length=100)
    province = models.CharField(max_length=50, blank=True, default="Québec")
    code_postal = models.CharField(max_length=10, blank=True)

    direction = models.CharField(
        max_length=100, blank=True, help_text="Secteur / direction responsable"
    )
    type_application = models.CharField(
        max_length=20,
        choices=[
            ("residentiel", "Résidentiel"),
            ("commercial", "Commercial"),
            ("industriel", "Industriel"),
        ],
        default="residentiel",
    )

    proprietaire = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="batiments",
        limit_choices_to={"role": "citoyen"},
        help_text="Le citoyen qui consultera ce rapport/certificat, s'il y en a un.",
    )

    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["rue", "numero_civique"]

    @property
    def adresse_complete(self):
        return f"{self.numero_civique} {self.rue}, {self.ville}"

    def __str__(self):
        return f"{self.adresse_complete} ({self.client.nom})"


class RapportExtincteur(models.Model):
    """
    Rapport de vérification des extincteurs portatifs, effectué par le
    technicien lors d'une visite.
    """

    class Statut(models.TextChoices):
        OUVERT = "ouvert", "Ouvert"
        FERME = "ferme", "Fermé"

    class Frequence(models.TextChoices):
        MENSUELLE = "mensuelle", "Mensuelle"
        ANNUELLE = "annuelle", "Annuelle"

    batiment = models.ForeignKey(
        Batiment, on_delete=models.CASCADE, related_name="rapports_extincteurs"
    )
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="rapports_extincteurs_crees",
        limit_choices_to={"role__in": ["superviseur", "technicien"]},
    )
    techniciens = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="rapports_extincteurs_assignes",
        limit_choices_to={"role": "technicien"},
        blank=True,
    )
    citoyen = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="rapports_extincteurs_citoyen",
        limit_choices_to={"role": "citoyen"},
        help_text="Le citoyen qui pourra consulter ce rapport et son certificat.",
    )
    numero_job = models.CharField(max_length=50, blank=True, help_text="Champ « JOB » du formulaire papier.")
    frequence = models.CharField(max_length=10, choices=Frequence.choices, default=Frequence.ANNUELLE)

    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.OUVERT)

    date_inspection = models.DateField(null=True, blank=True)
    date_derniere_sauvegarde = models.DateTimeField(auto_now=True)
    date_fermeture = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_creation"]

    def historiser(self, utilisateur, description):
        HistoriqueRapportExtincteur.objects.create(
            rapport=self, utilisateur=utilisateur, description=description
        )

    def fermer(self, utilisateur):
        from django.utils import timezone

        self.statut = self.Statut.FERME
        self.date_fermeture = timezone.now()
        self.save()
        self.historiser(utilisateur, "Rapport fermé")

        if not hasattr(self, "certificat"):
            CertificatExtincteur.objects.create(rapport=self, emis_par=utilisateur)

        # Un seul certificat couvre extincteurs + éclairage d'urgence —
        # les rapports d'une même visite se ferment donc ensemble.
        eclairage = getattr(self, "rapport_eclairage_lie", None)
        if eclairage is not None and eclairage.statut != eclairage.Statut.FERME:
            eclairage.fermer(utilisateur)

    def rouvrir(self, utilisateur):
        self.statut = self.Statut.OUVERT
        self.date_fermeture = None
        self.save()
        self.historiser(utilisateur, "Rapport rouvert")

        # Le rapport va potentiellement être modifié (réparation, mise à jour) —
        # le certificat déjà envoyé ne reflète plus l'état courant, donc on le
        # marque comme non envoyé pour permettre de le renvoyer après refermeture.
        if hasattr(self, "certificat") and self.certificat.certificat_envoye:
            self.certificat.certificat_envoye = False
            self.certificat.save()
            self.historiser(utilisateur, "Certificat marqué comme non envoyé (rapport rouvert)")

        eclairage = getattr(self, "rapport_eclairage_lie", None)
        if eclairage is not None and eclairage.statut == eclairage.Statut.FERME:
            eclairage.rouvrir(utilisateur)

    def __str__(self):
        return f"Rapport extincteurs {self.batiment.adresse_complete} — {self.get_statut_display()}"


class ModeEnvoi(models.TextChoices):
    """Comment un certificat a été remis — espace citoyen (compte) ou envoi
    direct par courriel (PDF joint, sans compte). Voir Client.mode_livraison."""

    DIRECT = "direct", "Courriel direct"
    CITOYEN = "citoyen", "Espace citoyen"


class CertificatExtincteur(models.Model):
    """Généré automatiquement quand un rapport extincteurs est fermé."""

    rapport = models.OneToOneField(
        RapportExtincteur, on_delete=models.CASCADE, related_name="certificat"
    )
    numero = models.CharField(max_length=30, unique=True, blank=True)
    date_emission = models.DateTimeField(auto_now_add=True)
    certificat_envoye = models.BooleanField(
        default=False,
        help_text="True quand le superviseur envoie explicitement le certificat au citoyen.",
    )
    mode_envoi = models.CharField(max_length=20, choices=ModeEnvoi.choices, blank=True)
    date_envoi = models.DateTimeField(null=True, blank=True)
    envoye_a = models.CharField(max_length=254, blank=True, help_text="Courriel (envoi direct) ou nom d'utilisateur du citoyen.")
    emis_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="certificats_extincteurs_emis",
    )

    class Meta:
        ordering = ["-date_emission"]

    def save(self, *args, **kwargs):
        if not self.numero:
            from django.utils import timezone

            annee = timezone.now().year
            compte = CertificatExtincteur.objects.filter(date_emission__year=annee).count() + 1
            self.numero = f"CERT-EXT-{annee}-{compte:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.numero} — {self.rapport}"


class HistoriqueRapportExtincteur(models.Model):
    """Une ligne d'audit pour un rapport extincteurs."""

    rapport = models.ForeignKey(RapportExtincteur, on_delete=models.CASCADE, related_name="historique")
    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    description = models.CharField(max_length=300)
    date_heure = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_heure"]

    def __str__(self):
        return f"{self.date_heure:%Y-%m-%d %H:%M} — {self.description}"


# Légende des non-conformités — mêmes codes que le formulaire papier des
# clients industriels : (code, libellé français, libellé anglais).
LEGENDE_NON_CONFORMITES = [
    ("TH", "Test hydrostatique", "Hydrostatic test"),
    ("6Y", "Entretien préventif 6 ans", "6 year preventive maintenance"),
    ("RL", "Déplacer", "Relocate"),
    ("RC", "Recharger", "To recharge"),
    ("SUPM", "Support manquant", "Missing support"),
    ("SUPR", "Réparer support", "Repair support"),
    ("LOCK", "Serrure pour cabinet", "Cabinet lock"),
    ("MIS", "Manquant", "Missing"),
    ("PIC", "Installer un pictogramme", "Install sign"),
    ("RP", "Remplacer", "To replace"),
    ("REC", "Recommandé", "Recommendation"),
    ("GAU", "Réparer manomètre", "Repair gauge"),
]
CODES_NON_CONFORMITES = [code for code, _fr, _en in LEGENDE_NON_CONFORMITES]


class ExtincteurItem(models.Model):
    """Une ligne du tableau de vérification des extincteurs portatifs."""

    class Etat(models.TextChoices):
        DEFECTUEUX = "D", "Défectueux"
        CONFORME = "C", "Conforme"
        NON_INSPECTE = "NI", "Non inspecté"

    class Format(models.TextChoices):
        LB2_5 = "2.5lb", "2.5 lb"
        LB5 = "5lb", "5 lb"
        LB10 = "10lb", "10 lb"
        LB13_25 = "13.25lb", "13.25 lb"
        LB15 = "15lb", "15 lb"
        LB20 = "20lb", "20 lb"
        LB30 = "30lb", "30 lb"
        LB50 = "50lb", "50 lb"
        LB125 = "125lb", "125 lb"
        KG2_5 = "2.5kg", "2.5 kg"
        KG5 = "5kg", "5 kg"
        KG10 = "10kg", "10 kg"
        L6 = "6L", "6 L"
        AUTRE = "autre", "Autre"

    class TypeExtincteur(models.TextChoices):
        POUDRE_ABC = "ABC", "Poudre ABC"
        POUDRE_BC = "BC", "Poudre BC"
        CO2 = "CO2", "CO2"
        EAU = "EAU", "Eau"
        MOUSSE = "AFFF", "Mousse (AFFF)"
        K = "K", "Produits chimiques humides (K)"
        HALOTRON = "halotron", "Halotron"
        FE36 = "fe36", "FE36"
        PK = "PK", "Purple K (PK)"
        D = "D", "Classe D (métaux)"
        AUTRE = "autre", "Autre"

    class Marque(models.TextChoices):
        AMEREX = "amerex", "Amerex"
        KIDDE = "kidde", "Kidde"
        BUCKEYE = "buckeye", "Buckeye"
        ANSUL = "ansul", "Ansul"
        GENERAL = "general", "General"
        FLAG = "flag", "Flag"
        STRIKE_FIRST = "strikefirst", "Strike First"
        BADGER = "badger", "Badger"
        PYRENE = "pyrene", "Pyrene"
        SENTRY = "sentry", "Sentry"
        PYROCHEM = "pyrochem", "Pyro Chem"
        AUTRE = "autre", "Autre"

    rapport = models.ForeignKey(RapportExtincteur, on_delete=models.CASCADE, related_name="extincteurs")
    section = models.ForeignKey(
        "SectionExtincteurs", null=True, blank=True, on_delete=models.SET_NULL, related_name="extincteurs"
    )

    # Numéro d'inventaire du client (étiquette sur l'extincteur).
    numero = models.CharField(max_length=30, blank=True)
    etage = models.CharField(max_length=100, blank=True)
    numero_serie = models.CharField(max_length=100, blank=True)
    etat = models.CharField(max_length=2, choices=Etat.choices, null=True, blank=True, default=None)
    emplacement = models.CharField(max_length=200, blank=True)
    # Code d'identification du client, ex. « ADU/EXT/F100A ».
    code_equipement = models.CharField(max_length=50, blank=True)
    # Codes de LEGENDE_NON_CONFORMITES, ex. ["TH", "SUPM"].
    non_conformites = models.JSONField(default=list, blank=True)
    # Modèle tel qu'écrit par le client, ex. « ABC 20 Cartouche » — type et
    # format en sont déduits, mais on garde le libellé d'origine.
    modele = models.CharField(max_length=60, blank=True)
    # Année seule (pas de mois/jour) — un extincteur n'a qu'une date de
    # fabrication annuelle sur son étiquette, jamais un jour précis.
    _annee_validators = [MinValueValidator(1900), MaxValueValidator(2100)]
    date_fabrication = models.PositiveIntegerField(null=True, blank=True, validators=_annee_validators)
    format = models.CharField(max_length=10, choices=Format.choices, blank=True)
    type_extincteur = models.CharField(max_length=10, choices=TypeExtincteur.choices, blank=True)
    marque = models.CharField(max_length=15, choices=Marque.choices, blank=True)
    prochaine_maintenance = models.PositiveIntegerField(null=True, blank=True, validators=_annee_validators)
    dernier_test_hydrostatique = models.PositiveIntegerField(null=True, blank=True, validators=_annee_validators)
    prochain_test_hydrostatique = models.PositiveIntegerField(null=True, blank=True, validators=_annee_validators)
    remarque = models.CharField(max_length=300, blank=True)

    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]

    def __str__(self):
        return f"Extincteur #{self.ordre} — {self.rapport}"


class SectionExtincteurs(models.Model):
    """Regroupement d'extincteurs dans un rapport — ex. « Magasin »,
    « Cafétéria » dans la Zone 100 d'une usine. `note` garde les consignes
    d'accès (permis, personne à aviser…)."""

    rapport = models.ForeignKey(RapportExtincteur, on_delete=models.CASCADE, related_name="sections")
    nom = models.CharField(max_length=200)
    note = models.TextField(blank=True)
    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]

    def __str__(self):
        return f"{self.nom} — {self.rapport}"


class BoyauItem(models.Model):
    """Une ligne du tableau de vérification des boyaux d'incendie —
    même légende/état que les extincteurs, mais une longueur au lieu
    d'un format/type/marque, et pas de maintenance périodique séparée
    (seul le test hydrostatique s'applique)."""

    class Longueur(models.TextChoices):
        PI50 = "50pi", "50 pi"
        PI75 = "75pi", "75 pi"
        PI100 = "100pi", "100 pi"
        AUTRE = "autre", "Autre"

    rapport = models.ForeignKey(RapportExtincteur, on_delete=models.CASCADE, related_name="boyaux")

    etage = models.CharField(max_length=100, blank=True)
    etat = models.CharField(max_length=2, choices=ExtincteurItem.Etat.choices, null=True, blank=True, default=None)
    emplacement = models.CharField(max_length=200, blank=True)
    longueur = models.CharField(max_length=10, choices=Longueur.choices, blank=True)
    date_fabrication = models.PositiveIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1900), MaxValueValidator(2100)]
    )
    prochain_test_hydrostatique = models.PositiveIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1900), MaxValueValidator(2100)]
    )
    remarque = models.CharField(max_length=300, blank=True)

    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]

    def __str__(self):
        return f"Boyau #{self.ordre} — {self.rapport}"
