"""
URL configuration for Authentication app.
"""
from django.urls import path
from .views import LoginView, RefreshTokenView, LogoutView, VerifyTokenView

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', RefreshTokenView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('verify/', VerifyTokenView.as_view(), name='verify_token'),
]
