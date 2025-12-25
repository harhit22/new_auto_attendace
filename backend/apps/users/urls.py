"""
URL configuration for Users app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, DepartmentViewSet, DeviceLogViewSet

router = DefaultRouter()
router.register('departments', DepartmentViewSet, basename='department')
router.register('', UserViewSet, basename='user')
router.register('device-logs', DeviceLogViewSet, basename='device-log')

urlpatterns = [
    path('', include(router.urls)),
]
