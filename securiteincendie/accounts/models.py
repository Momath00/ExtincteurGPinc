from django.db import models

# Create your models here.
import random
import string
from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class Utilisateur(AbstractUser):
    """
    Utilisateur unique pour toute la plateforme, distingué par son rôle.
    Il n'y a pas d'inscription publique : le Superviseur invite les
    Techniciens et les Citoyens, qui reçoivent un mot de passe temporaire.
    """

    class Role(models.TextChoices):
        SUPERVISEUR = "superviseur", "Superviseur"
        TECHNICIEN = "technicien", "Technicien"
        CITOYEN = "citoyen", "Citoyen"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CITOYEN)
    telephone = models.CharField(max_length=20, blank=True)

    # Spécifique au technicien
    permis_recq = models.CharField(
        "Numéro de permis R.E.C.Q.", max_length=50, blank=True
    )

    # Cycle de vie du compte
    est_actif = models.BooleanField(default=True)
    mdp_temporaire = models.BooleanField(
        default=False,
        help_text="Force le changement de mot de passe à la première connexion.",
    )
    invite_par = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="invitations_envoyees",
    )
    date_creation = models.DateTimeField(auto_now_add=True)

    def est_superviseur(self):
        return self.role == self.Role.SUPERVISEUR or bool(self.is_superuser)

    def est_technicien(self):
        return self.role == self.Role.TECHNICIEN

    def est_citoyen(self):
        return self.role == self.Role.CITOYEN

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


def generer_code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


class CodeVerification(models.Model):
    """Code à usage unique pour la réinitialisation de mot de passe."""

    email = models.EmailField()
    code = models.CharField(max_length=6, default=generer_code)
    utilise = models.BooleanField(default=False)
    date_creation = models.DateTimeField(auto_now_add=True)

    DUREE_VALIDITE_MINUTES = 15

    def est_valide(self):
        limite = self.date_creation + timedelta(minutes=self.DUREE_VALIDITE_MINUTES)
        return not self.utilise and timezone.now() <= limite

    def __str__(self):
        return f"{self.email} — {self.code}"