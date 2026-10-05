"""
URL configuration for securiteincendie project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include


def config_publique(request):
    """Modules activés — lu par le frontend pour afficher ou masquer les menus."""
    return JsonResponse({"module_eclairage": settings.MODULE_ECLAIRAGE})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/config/', config_publique, name='config_publique'),
    path('api/', include('api.urls')),
    path('api/', include('inspections.urls')),
]

if settings.MODULE_ECLAIRAGE:
    urlpatterns.append(path('api/', include('eclairage.urls')))
