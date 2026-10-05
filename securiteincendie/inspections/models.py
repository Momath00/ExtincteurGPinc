from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Client(models.Model):
    """L'entreprise avec qui Extincteurs Nationex travaille.
    Regroupe tous les bâtiments et rapports d'une même entreprise cliente."""

    class ModeLivraison(models.TextChoices):
        PLATEFORME = "plateforme", "Espace client (invitation)"
        DIRECT = "direct", "Envoi direct par courriel (PDF joint)"

    nom = models.CharField(max_length=150, unique=True)
    contact_nom = models.CharField(max_length=150, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_telephone = models.CharField(max_length=20, blank=True)
    adresse = models.CharField(max_length=300, blank=True)
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

    numero_civique = models.CharField(max_length=10)
    rue = models.CharField(max_length=200)
    ville = models.CharField(max_length=100)
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

        cuisine = getattr(self, "rapport_cuisine_lie", None)
        if cuisine is not None and cuisine.statut != cuisine.Statut.FERME:
            cuisine.fermer(utilisateur)

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

        cuisine = getattr(self, "rapport_cuisine_lie", None)
        if cuisine is not None and cuisine.statut == cuisine.Statut.FERME:
            cuisine.rouvrir(utilisateur)

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
        LB20 = "20lb", "20 lb"
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
        AUTRE = "autre", "Autre"

    class Marque(models.TextChoices):
        AMEREX = "amerex", "Amerex"
        KIDDE = "kidde", "Kidde"
        BUCKEYE = "buckeye", "Buckeye"
        ANSUL = "ansul", "Ansul"
        GENERAL = "general", "General"
        FLAG = "flag", "Flag"
        STRIKE_FIRST = "strikefirst", "Strike First"
        AUTRE = "autre", "Autre"

    rapport = models.ForeignKey(RapportExtincteur, on_delete=models.CASCADE, related_name="extincteurs")

    etage = models.CharField(max_length=100, blank=True)
    etat = models.CharField(max_length=2, choices=Etat.choices, null=True, blank=True, default=None)
    emplacement = models.CharField(max_length=200, blank=True)
    # Année seule (pas de mois/jour) — un extincteur n'a qu'une date de
    # fabrication annuelle sur son étiquette, jamais un jour précis.
    _annee_validators = [MinValueValidator(1900), MaxValueValidator(2100)]
    date_fabrication = models.PositiveIntegerField(null=True, blank=True, validators=_annee_validators)
    format = models.CharField(max_length=10, choices=Format.choices, blank=True)
    type_extincteur = models.CharField(max_length=10, choices=TypeExtincteur.choices, blank=True)
    marque = models.CharField(max_length=15, choices=Marque.choices, blank=True)
    prochaine_maintenance = models.PositiveIntegerField(null=True, blank=True, validators=_annee_validators)
    prochain_test_hydrostatique = models.PositiveIntegerField(null=True, blank=True, validators=_annee_validators)
    remarque = models.CharField(max_length=300, blank=True)

    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]

    def __str__(self):
        return f"Extincteur #{self.ordre} — {self.rapport}"


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


# ── Système d'extinction de cuisine (hotte, norme ULC ORD 1254.6 / ULC 300) ─

class RapportCuisine(models.Model):
    """
    Rapport de vérification du système fixe d'extinction de cuisine (hotte),
    effectué par le technicien lors d'une visite.

    Contrairement à l'éclairage d'urgence et au réseau avertisseur, ce
    système n'équipe pas tous les bâtiments (surtout les cuisines
    commerciales) — il n'est donc jamais créé automatiquement avec le
    rapport extincteur : soit le superviseur/technicien coche l'option au
    moment de créer le rapport extincteur (voir RapportExtincteurViewSet.
    perform_create), soit il crée un rapport cuisine indépendant.
    """

    class Statut(models.TextChoices):
        OUVERT = "ouvert", "Ouvert"
        FERME = "ferme", "Fermé"

    class TypeAgent(models.TextChoices):
        LIQUIDE = "liquide", "Liquide (wet chemical)"
        POUDRE = "poudre", "Poudre chimique"
        CO2 = "co2", "CO2"
        AUTRE = "autre", "Autre"

    batiment = models.ForeignKey(Batiment, on_delete=models.CASCADE, related_name="rapports_cuisine")
    rapport_extincteur = models.OneToOneField(
        RapportExtincteur,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="rapport_cuisine_lie",
    )
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="rapports_cuisine_crees",
        limit_choices_to={"role__in": ["superviseur", "technicien"]},
    )
    techniciens = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="rapports_cuisine_assignes",
        limit_choices_to={"role": "technicien"},
        blank=True,
    )
    citoyen = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="rapports_cuisine_citoyen",
        limit_choices_to={"role": "citoyen"},
        help_text="Le citoyen qui pourra consulter ce rapport et son certificat.",
    )
    numero_job = models.CharField(max_length=50, blank=True, help_text="Champ « JOB » du formulaire papier.")

    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.OUVERT)

    class DispositifCoupure(models.TextChoices):
        VALVE_GAZ = "valve_gaz", "Valve(s) à gaz"
        CONTACTEUR = "contacteur", "Contacteur"

    # ── Informations du système ──
    courtier = models.CharField(max_length=150, blank=True)
    fabricant = models.CharField(max_length=100, blank=True)
    modele = models.CharField(max_length=100, blank=True)
    numero_serie = models.CharField(max_length=100, blank=True)
    type_agent = models.CharField(max_length=10, choices=TypeAgent.choices, blank=True)
    date_installation = models.DateField(null=True, blank=True)
    alimentation = models.CharField(max_length=150, blank=True, help_text="Ex. « Gaz », « Électrique »")
    dispositif_coupure = models.CharField(max_length=15, choices=DispositifCoupure.choices, blank=True)
    nombre_buses = models.PositiveIntegerField(null=True, blank=True, help_text="Nombre total de buses du système")
    liens_fusibles_360f = models.PositiveIntegerField(null=True, blank=True, verbose_name="Liens fusibles 360°F")
    liens_fusibles_450f = models.PositiveIntegerField(null=True, blank=True, verbose_name="Liens fusibles 450°F")
    liens_fusibles_500f = models.PositiveIntegerField(null=True, blank=True, verbose_name="Liens fusibles 500°F")
    buses_liens_fusibles = models.CharField(max_length=200, blank=True, help_text="Ex. « 6 buses · 360° (remplacés) »")
    date_dernier_essai_hydrostatique = models.DateField(null=True, blank=True)
    date_derniere_recharge = models.DateField(null=True, blank=True)
    prochaine_inspection = models.DateField(null=True, blank=True)
    raccordement = models.CharField(max_length=150, blank=True, help_text="Ex. « Relié au panneau d'alarme »")

    # ── Liste des vérifications (13 items fixes, norme ULC) ──
    appareils_proteges = models.BooleanField(null=True, blank=True, default=None)
    liens_fusibles_remplaces = models.BooleanField(null=True, blank=True, default=None)
    installation_conforme_fabricant = models.BooleanField(null=True, blank=True, default=None)
    cable_tension_verifie = models.BooleanField(null=True, blank=True, default=None)
    pression_manometre_verifiee = models.BooleanField(null=True, blank=True, default=None)
    conduits_decharge_verifies = models.BooleanField(null=True, blank=True, default=None)
    cylindres_supports_inspectes = models.BooleanField(null=True, blank=True, default=None)
    extincteur_portatif_type_k = models.BooleanField(null=True, blank=True, default=None)
    station_manuelle_degagee = models.BooleanField(null=True, blank=True, default=None)
    etiquettes_verification_apposees = models.BooleanField(null=True, blank=True, default=None)
    buses_protecteurs_nettoyes = models.BooleanField(null=True, blank=True, default=None)
    systeme_condition_normale = models.BooleanField(null=True, blank=True, default=None)
    liens_fusibles_nettoyes = models.BooleanField(null=True, blank=True, default=None)

    commentaires = models.TextField(blank=True)
    conforme_recommandations = models.BooleanField(
        null=True, blank=True, default=None,
        help_text="Décision du technicien (« À cette date, le système... est conforme / nécessite des "
                   "modifications ») — quand renseignée, remplace le calcul automatique basé sur la "
                   "checklist pour déterminer la conformité affichée sur le certificat.",
    )

    date_inspection = models.DateField(null=True, blank=True)
    date_derniere_sauvegarde = models.DateTimeField(auto_now=True)
    date_fermeture = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_creation"]

    CHAMPS_VERIFICATION = [
        "appareils_proteges",
        "liens_fusibles_remplaces",
        "installation_conforme_fabricant",
        "cable_tension_verifie",
        "pression_manometre_verifiee",
        "conduits_decharge_verifies",
        "cylindres_supports_inspectes",
        "extincteur_portatif_type_k",
        "station_manuelle_degagee",
        "etiquettes_verification_apposees",
        "buses_protecteurs_nettoyes",
        "systeme_condition_normale",
        "liens_fusibles_nettoyes",
    ]

    @property
    def nb_verifications_conformes(self):
        # Une vérification jamais touchée (None) compte comme faite : dans
        # l'application, chaque case est cochée par défaut et le technicien
        # décoche ce qui n'est pas conforme (ChecklistCuisine.tsx).
        return sum(1 for champ in self.CHAMPS_VERIFICATION if getattr(self, champ) is not False)

    @property
    def est_conforme(self):
        if self.conforme_recommandations is not None:
            return self.conforme_recommandations
        return all(getattr(self, champ) is not False for champ in self.CHAMPS_VERIFICATION)

    def historiser(self, utilisateur, description):
        HistoriqueRapportCuisine.objects.create(
            rapport=self, utilisateur=utilisateur, description=description
        )

    def fermer(self, utilisateur):
        from django.utils import timezone

        self.statut = self.Statut.FERME
        self.date_fermeture = timezone.now()
        self.save()
        self.historiser(utilisateur, "Rapport fermé")

        # Un rapport cuisine lié à un rapport extincteur n'a pas son propre
        # certificat — ses données (schéma, caractéristiques, checklist)
        # sont intégrées directement dans le certificat unifié de ce
        # dernier (voir RapportExtincteurViewSet.certificat_pdf). Seul un
        # rapport cuisine indépendant reçoit son propre certificat CERT-CUI.
        if not self.rapport_extincteur_id and not hasattr(self, "certificat"):
            CertificatCuisine.objects.create(rapport=self, emis_par=utilisateur)

    def rouvrir(self, utilisateur):
        self.statut = self.Statut.OUVERT
        self.date_fermeture = None
        self.save()
        self.historiser(utilisateur, "Rapport rouvert")

        if hasattr(self, "certificat") and self.certificat.certificat_envoye:
            self.certificat.certificat_envoye = False
            self.certificat.save()
            self.historiser(utilisateur, "Certificat marqué comme non envoyé (rapport rouvert)")

    def __str__(self):
        return f"Rapport cuisine {self.batiment.adresse_complete} — {self.get_statut_display()}"


class CertificatCuisine(models.Model):
    """Généré automatiquement quand un rapport cuisine est fermé."""

    rapport = models.OneToOneField(RapportCuisine, on_delete=models.CASCADE, related_name="certificat")
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
        related_name="certificats_cuisine_emis",
    )

    class Meta:
        ordering = ["-date_emission"]

    def save(self, *args, **kwargs):
        if not self.numero:
            from django.utils import timezone

            annee = timezone.now().year
            compte = CertificatCuisine.objects.filter(date_emission__year=annee).count() + 1
            self.numero = f"CERT-CUI-{annee}-{compte:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.numero} — {self.rapport}"


class HistoriqueRapportCuisine(models.Model):
    """Une ligne d'audit pour un rapport cuisine."""

    rapport = models.ForeignKey(RapportCuisine, on_delete=models.CASCADE, related_name="historique")
    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    description = models.CharField(max_length=300)
    date_heure = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_heure"]

    def __str__(self):
        return f"{self.date_heure:%Y-%m-%d %H:%M} — {self.description}"


class HotteCuisine(models.Model):
    """
    Une hotte (conduit d'extraction) protégée par le système, avec les
    appareils de cuisine qu'elle couvre. Les repères d'appareils et les
    divisions du conduit (schéma d'installation interactif) sont stockés en
    JSON — données structurées mais propres à l'éditeur visuel, pas besoin
    d'un modèle normalisé par repère.

    Format de `appareils`: [{"code": "F", "x": 120, "side": "above"}, ...]
    (code = type d'appareil, x = position horizontale sur le conduit,
    side = "above"/"below"). Format de `dividers`: [245, ...] (positions où
    le conduit est visuellement divisé en segments).
    """

    class CodeAppareil(models.TextChoices):
        FRITEUSE = "F", "Friteuse"
        FRITEUSE_PRESSION = "B", "Friteuse sous pression"
        PLAQUE_CHAUFFANTE = "P", "Plaque chauffante"
        CUISINIERE_2_FEUX = "R2", "Cuisinière 2 feux"
        CUISINIERE_4_FEUX = "R4", "Cuisinière 4 feux"
        CUISINIERE_6_FEUX = "R6", "Cuisinière 6 feux"
        GRILLE_CHARBON = "GC", "Grille charbon"
        GRILLE_GAZ = "GZ", "Grille à gaz"
        SALAMANDRE = "S", "Salamandre"
        STOCK_POT = "SP", "Stock pot"
        BASSIN_FRIRE = "BP", "Bassin à frire"
        WOK = "W", "Wok"
        SHAWARMA = "SH", "Shawarma"
        AUTRE = "O", "Autre"

    rapport = models.ForeignKey(RapportCuisine, on_delete=models.CASCADE, related_name="hottes")
    ordre = models.PositiveIntegerField(default=0)
    label = models.CharField(max_length=100, blank=True)
    nombre_buses = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Ancien champ (comptage seulement) — remplacé par `buses` (positions), gardé pour l'historique des hottes créées avant.",
    )
    buses = models.JSONField(
        default=list, blank=True,
        help_text="Positions horizontales des buses, placées manuellement — [{'x': 120, 'direction': 'gauche'|'droite'}, ...], comme `appareils`. `direction` absente = buse verticale (droit devant).",
    )
    elevations = models.JSONField(
        default=list, blank=True,
        help_text="Positions horizontales des conduits d'évacuation verticaux (raccords vers le toit), placés manuellement — [{'x': 250}, ...].",
    )
    appareils = models.JSONField(default=list, blank=True)
    dividers = models.JSONField(default=list, blank=True)
    tailles = models.JSONField(
        default=list, blank=True,
        help_text="Petits carrés « taille de hotte » (en pieds) placés à l'intérieur de la hotte — [{'x': 120, 'pieds': 6}, ...].",
    )

    class Meta:
        ordering = ["ordre", "id"]

    def save(self, *args, **kwargs):
        if not self.label:
            self.label = f"Hotte #{self.ordre or 1}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.label} — {self.rapport}"
