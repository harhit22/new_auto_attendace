"""
URL Configuration for faces app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
# No viewsets to register currently as models were deleted

urlpatterns = [
    path('', include(router.urls)),
]
