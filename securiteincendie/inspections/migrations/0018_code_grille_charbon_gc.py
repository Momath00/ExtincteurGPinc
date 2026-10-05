from django.db import migrations


def _renommer(apps, ancien, nouveau):
    HotteCuisine = apps.get_model("inspections", "HotteCuisine")
    for hotte in HotteCuisine.objects.all():
        appareils = hotte.appareils or []
        if any(a.get("code") == ancien for a in appareils):
            hotte.appareils = [{**a, "code": nouveau} if a.get("code") == ancien else a for a in appareils]
            hotte.save(update_fields=["appareils"])


def grille_charbon_gc(apps, schema_editor):
    # Grille charbon : code « C » → « GC » (à côté de la nouvelle grille à
    # gaz « GZ »), dans les appareils déjà placés sur les schémas.
    _renommer(apps, "C", "GC")


def retour_c(apps, schema_editor):
    _renommer(apps, "GC", "C")


class Migration(migrations.Migration):

    dependencies = [
        ("inspections", "0017_remove_dispositif_rapport_remove_dispositif_section_and_more"),
    ]

    operations = [
        migrations.RunPython(grille_charbon_gc, retour_c),
    ]
