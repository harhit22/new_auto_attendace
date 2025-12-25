"""
Serializers for User and Department.
"""
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, Department, DeviceLog


class DepartmentSerializer(serializers.ModelSerializer):
    """Serializer for Department model."""
    employee_count = serializers.ReadOnlyField()
    full_path = serializers.ReadOnlyField()
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    
    class Meta:
        model = Department
        fields = [
            'id', 'name', 'code', 'parent', 'parent_name',
            'is_active', 'description', 'employee_count', 'full_path',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class DepartmentMinimalSerializer(serializers.ModelSerializer):
    """Minimal serializer for nested Department representation."""
    class Meta:
        model = Department
        fields = ['id', 'name', 'code']


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    department = DepartmentMinimalSerializer(read_only=True)
    department_id = serializers.UUIDField(write_only=True, required=False)
    is_enrolled = serializers.ReadOnlyField()
    face_count = serializers.ReadOnlyField()
    
    class Meta:
        model = User
        fields = [
            'id', 'employee_id', 'email', 'name', 'phone',
            'department', 'department_id', 'role', 'is_active',
            'is_enrolled', 'enrolled_at', 'face_count', 'avatar',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'is_enrolled', 'enrolled_at', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        department_id = validated_data.pop('department_id', None)
        if department_id:
            validated_data['department_id'] = department_id
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        department_id = validated_data.pop('department_id', None)
        if department_id:
            validated_data['department_id'] = department_id
        return super().update(instance, validated_data)


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new user."""
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = [
            'employee_id', 'email', 'name', 'phone',
            'department', 'role', 'password', 'password_confirm'
        ]
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match.'})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserMinimalSerializer(serializers.ModelSerializer):
    """Minimal user serializer for nested representations."""
    class Meta:
        model = User
        fields = ['id', 'employee_id', 'name', 'email']


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile (self-view/edit)."""
    department = DepartmentMinimalSerializer(read_only=True)
    is_enrolled = serializers.ReadOnlyField()
    face_count = serializers.ReadOnlyField()
    
    class Meta:
        model = User
        fields = [
            'id', 'employee_id', 'email', 'name', 'phone',
            'department', 'role', 'is_active', 'is_enrolled',
            'enrolled_at', 'face_count', 'avatar', 'last_login'
        ]
        read_only_fields = [
            'id', 'employee_id', 'email', 'role', 'is_active',
            'is_enrolled', 'enrolled_at', 'last_login'
        ]


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for password change."""
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': 'Passwords do not match.'})
        return attrs
    
    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value


class DeviceLogSerializer(serializers.ModelSerializer):
    """Serializer for device logs."""
    class Meta:
        model = DeviceLog
        fields = [
            'id', 'device_id', 'device_model', 'os_version',
            'app_version', 'event_type', 'event_data',
            'ip_address', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
