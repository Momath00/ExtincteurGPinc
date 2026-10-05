FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Chromium headless — génère les PDF joints aux courriels d'envoi direct
# (inspections/pdf.py).
RUN playwright install --with-deps chromium

COPY . .

WORKDIR /app/securiteincendie

# Valeurs bidon utilisées uniquement pour que Django puisse charger ses settings
# au moment du build (collectstatic ne touche pas la base de données). Railway
# n'injecte pas forcément les variables de service au build — au démarrage réel
# du conteneur, les vraies variables d'environnement définies dans Railway
# prennent le dessus sur ces ENV par défaut.
ENV SECRET_KEY=build-time-placeholder \
    DATABASE_URL=postgres://user:pass@localhost:5432/build

RUN python manage.py collectstatic --noinput

CMD ["sh", "-c", "python manage.py migrate && gunicorn securiteincendie.wsgi:application --bind 0.0.0.0:${PORT:-8080}"]