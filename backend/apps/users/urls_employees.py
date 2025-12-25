"""
URL configuration for Employee management (alias for users).
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet

router = DefaultRouter()
router.register('', UserViewSet, basename='employee')

urlpatterns = [
    path('', include(router.urls)),
]
