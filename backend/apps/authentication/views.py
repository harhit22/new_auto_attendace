"""
Authentication views.
"""
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.conf import settings
from drf_spectacular.utils import extend_schema

from apps.users.models import DeviceLog
from .serializers import (
    CustomTokenObtainPairSerializer,
    LoginSerializer,
    LogoutSerializer,
    TokenResponseSerializer,
)


class LoginView(TokenObtainPairView):
    """
    Login endpoint - obtain JWT tokens.
    
    Returns access and refresh tokens along with user info.
    """
    permission_classes = [AllowAny]
    serializer_class = CustomTokenObtainPairSerializer
    
    @extend_schema(
        request=LoginSerializer,
        responses={200: TokenResponseSerializer}
    )
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            # Log the login event
            user = self.get_serializer().user
            device_id = request.data.get('device_id', 'unknown')
            
            DeviceLog.objects.create(
                user=user,
                device_id=device_id,
                device_model=request.data.get('device_model', ''),
                app_version=request.data.get('app_version', ''),
                event_type='login',
                ip_address=self._get_client_ip(request),
                event_data={'source': 'api'}
            )
            
            # Update last login info
            user.last_login_ip = self._get_client_ip(request)
            user.last_login_device = device_id
            user.save(update_fields=['last_login_ip', 'last_login_device'])
            
            # Format response
            data = response.data
            return Response({
                'access_token': data['access'],
                'refresh_token': data['refresh'],
                'token_type': 'bearer',
                'expires_in': int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
                'user': data['user']
            })
        
        return response
    
    def _get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class RefreshTokenView(TokenRefreshView):
    """
    Refresh access token using refresh token.
    """
    permission_classes = [AllowAny]
    
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            data = response.data
            return Response({
                'access_token': data['access'],
                'expires_in': int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
            })
        
        return response


class LogoutView(APIView):
    """
    Logout endpoint - blacklist refresh token.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(request=LogoutSerializer)
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh_token')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            
            # Log the logout event
            DeviceLog.objects.create(
                user=request.user,
                device_id=request.data.get('device_id', 'unknown'),
                event_type='logout',
                ip_address=self._get_client_ip(request),
            )
            
            return Response({'message': 'Successfully logged out.'})
        
        except TokenError:
            return Response(
                {'error': 'Invalid token.'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def _get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class VerifyTokenView(APIView):
    """
    Verify if the current token is valid.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        return Response({
            'valid': True,
            'user_id': str(request.user.id),
            'role': request.user.role,
        })
