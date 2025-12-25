"""
Authentication serializers.
"""
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from apps.users.models import User
from apps.users.serializers import DepartmentMinimalSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom token serializer that includes user info in response.
    """
    
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Add user info to response
        user = self.user
        data['user'] = {
            'id': str(user.id),
            'employee_id': user.employee_id,
            'name': user.name,
            'email': user.email,
            'role': user.role,
            'department': DepartmentMinimalSerializer(user.department).data if user.department else None,
            'is_enrolled': user.is_enrolled,
        }
        
        return data
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Add custom claims
        token['name'] = user.name
        token['role'] = user.role
        token['employee_id'] = user.employee_id
        
        return token


class LoginSerializer(serializers.Serializer):
    """
    Serializer for login request.
    """
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    device_id = serializers.CharField(required=False)
    device_model = serializers.CharField(required=False)
    app_version = serializers.CharField(required=False)


class LogoutSerializer(serializers.Serializer):
    """
    Serializer for logout request.
    """
    refresh_token = serializers.CharField()


class RefreshTokenSerializer(serializers.Serializer):
    """
    Serializer for token refresh request.
    """
    refresh = serializers.CharField()


class TokenResponseSerializer(serializers.Serializer):
    """
    Serializer for token response (for API docs).
    """
    access_token = serializers.CharField()
    refresh_token = serializers.CharField()
    token_type = serializers.CharField(default='bearer')
    expires_in = serializers.IntegerField()
    user = serializers.DictField()
