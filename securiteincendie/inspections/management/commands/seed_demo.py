"""Données de test : comptes, clients, bâtiments et rapports (extincteurs,
boyaux, éclairage d'urgence) — certains fermés avec certificat.

    python manage.py seed_demo          # crée les données si absentes
    python manage.py seed_demo --reset  # supprime puis recrée les données de démo
"""
import random
from datetime import date

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import Utilisateur
from eclairage.models import EclairageItem, RapportEclairage
from inspections.models import Batiment, BoyauItem, Client, ExtincteurItem, RapportExtincteur

MOT_DE_PASSE = "Test1234!"

COMPTES = [
    ("superviseur", Utilisateur.Role.SUPERVISEUR, "Sophie", "Gagnon"),
    ("technicien", Utilisateur.Role.TECHNICIEN, "Marc", "Tremblay"),
    ("technicien2", Utilisateur.Role.TECHNICIEN, "Julie", "Roy"),
    ("citoyen", Utilisateur.Role.CITOYEN, "Paul", "Lavoie"),
]

CLIENTS = [
    {
        "nom": "Résidences du Parc (démo)",
        "contact_nom": "Paul Lavoie",
        "contact_email": "paul.lavoie@example.com",
        "contact_telephone": "514-555-0101",
        "adresse": "1200 boul. Saint-Laurent, Montréal",
        "mode_livraison": Client.ModeLivraison.PLATEFORME,
        "batiments": [
            ("1200", "boul. Saint-Laurent", "Montréal", "H2X 2S6", "residentiel"),
            ("45", "rue des Érables", "Laval", "H7N 1A1", "residentiel"),
        ],
    },
    {
        "nom": "Entrepôts Laurentides (démo)",
        "contact_nom": "Nadia Bouchard",
        "contact_email": "nadia.bouchard@example.com",
        "contact_telephone": "450-555-0199",
        "adresse": "800 rue Industrielle, Saint-Jérôme",
        "mode_livraison": Client.ModeLivraison.DIRECT,
        "batiments": [
            ("800", "rue Industrielle", "Saint-Jérôme", "J7Y 4B3", "industriel"),
        ],
    },
    {
        "nom": "Café Central (démo)",
        "contact_nom": "Luc Martin",
        "contact_email": "luc.martin@example.com",
        "contact_telephone": "418-555-0142",
        "adresse": "300 rue Saint-Jean, Québec",
        "mode_livraison": Client.ModeLivraison.PLATEFORME,
        "batiments": [
            ("300", "rue Saint-Jean", "Québec", "G1R 1P1", "commercial"),
        ],
    },
]

EMPLACEMENTS = ["Corridor nord", "Corridor sud", "Cage d'escalier A", "Salle mécanique",
                "Cuisine", "Garage", "Hall d'entrée", "Local électrique", "Entrepôt"]
ETAGES = ["SS", "RDC", "1", "2", "3"]


class Command(BaseCommand):
    help = "Crée des données de test (comptes, clients, bâtiments, rapports)."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Supprime les données de démo avant de les recréer.")

    @transaction.atomic
    def handle(self, *args, reset=False, **options):
        rng = random.Random(42)
        noms_clients = [c["nom"] for c in CLIENTS]

        if reset:
            RapportExtincteur.objects.filter(batiment__client__nom__in=noms_clients).delete()
            RapportEclairage.objects.filter(batiment__client__nom__in=noms_clients).delete()
            Batiment.objects.filter(client__nom__in=noms_clients).delete()
            Client.objects.filter(nom__in=noms_clients).delete()
        elif Client.objects.filter(nom__in=noms_clients).exists():
            self.stdout.write(self.style.WARNING("Données de démo déjà présentes — utilisez --reset pour les recréer."))
            return

        users = {}
        for username, role, prenom, nom in COMPTES:
            u, _ = Utilisateur.objects.get_or_create(username=username, defaults={"role": role})
            u.role = role
            u.first_name, u.last_name = prenom, nom
            u.email = f"{username}@example.com"
            u.is_staff = u.is_superuser = role == Utilisateur.Role.SUPERVISEUR
            u.mdp_temporaire = False
            u.set_password(MOT_DE_PASSE)
            u.save()
            users[username] = u
        sup, techs, citoyen = users["superviseur"], [users["technicien"], users["technicien2"]], users["citoyen"]

        n_rapports = 0
        for ci, data in enumerate(CLIENTS):
            client = Client.objects.create(**{k: v for k, v in data.items() if k != "batiments"})
            for bi, (num, rue, ville, cp, type_app) in enumerate(data["batiments"]):
                bat = Batiment.objects.create(
                    client=client, numero_civique=num, rue=rue, ville=ville, code_postal=cp,
                    type_application=type_app, proprietaire=citoyen if ci == 0 else None,
                )
                # Un rapport fermé (certificat émis) et un rapport en cours par bâtiment.
                for fermer in (True, False):
                    self._creer_rapport(rng, bat, sup, techs[(ci + bi) % 2], citoyen if ci == 0 else None, fermer)
                    n_rapports += 1

        self.stdout.write(self.style.SUCCESS(
            f"OK : {len(COMPTES)} comptes, {len(CLIENTS)} clients, {n_rapports} rapports. "
            f"Mot de passe de tous les comptes : {MOT_DE_PASSE}"
        ))

    def _creer_rapport(self, rng, bat, sup, tech, citoyen, fermer):
        annee = date.today().year
        rapport = RapportExtincteur.objects.create(
            batiment=bat, cree_par=sup, citoyen=citoyen,
            numero_job=f"JOB-{rng.randint(1000, 9999)}", date_inspection=date.today(),
        )
        rapport.techniciens.set([tech])
        rapport.historiser(sup, "Rapport créé (données de démo)")

        for i in range(1, rng.randint(5, 9) + 1):
            fab = rng.randint(annee - 11, annee - 1)
            etat = rng.choices(["C", "D", "NI"], weights=[8, 1, 1])[0] if fermer or i <= 3 else None
            ExtincteurItem.objects.create(
                rapport=rapport, ordre=i,
                etage=rng.choice(ETAGES), emplacement=rng.choice(EMPLACEMENTS),
                numero_serie=f"{rng.choice(['AM', 'KD', 'BK'])}{rng.randint(100000, 999999)}",
                type_extincteur=rng.choice(["ABC", "ABC", "CO2", "K"]),
                format=rng.choice(["5lb", "10lb", "20lb"]),
                marque=rng.choice(["amerex", "kidde", "buckeye"]),
                date_fabrication=fab, prochaine_maintenance=annee + 1,
                prochain_test_hydrostatique=fab + 12 if fab + 12 > annee else annee,
                etat=etat, remarque="Goupille manquante" if etat == "D" else "",
            )
        for i in range(1, rng.randint(1, 3) + 1):
            BoyauItem.objects.create(
                rapport=rapport, ordre=i, etage=rng.choice(ETAGES), emplacement=rng.choice(EMPLACEMENTS),
                longueur=rng.choice(["50pi", "75pi", "100pi"]), date_fabrication=rng.randint(annee - 8, annee - 1),
                prochain_test_hydrostatique=annee + 2, etat="C" if fermer else None,
            )

        # Comme RapportExtincteurViewSet.perform_create : rapport éclairage lié.
        if not settings.MODULE_ECLAIRAGE:
            if fermer:
                rapport.fermer(tech)
            return
        eclairage = RapportEclairage.objects.create(
            batiment=bat, cree_par=sup, numero_job=rapport.numero_job,
            date_inspection=rapport.date_inspection, rapport_extincteur=rapport,
        )
        eclairage.techniciens.set([tech])
        for i in range(1, rng.randint(2, 5) + 1):
            EclairageItem.objects.create(
                rapport=eclairage, ordre=i, etage=rng.choice(ETAGES), emplacement=rng.choice(EMPLACEMENTS),
                modele=rng.choice(["Lumacell RG", "Stanpro EM", "Beghelli BS"]), voltage=rng.choice(["6V", "12V"]),
                etat=rng.choices(["C", "D"], weights=[9, 1])[0] if fermer else None,
            )

        if fermer:
            rapport.fermer(tech)
