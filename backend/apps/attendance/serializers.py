"""
Attendance serializers.
"""
from rest_framework import serializers
from apps.users.serializers import UserMinimalSerializer
from .models import AttendanceRecord, AttendanceOverride, ValidationRule


class AttendanceRecordSerializer(serializers.ModelSerializer):
    """Serializer for AttendanceRecord."""
    user = UserMinimalSerializer(read_only=True)
    total_hours = serializers.ReadOnlyField()
    is_complete = serializers.ReadOnlyField()
    
    class Meta:
        model = AttendanceRecord
        fields = [
            'id', 'user', 'check_in_time', 'check_out_time',
            'status', 'face_match_score', 'image_quality_score',
            'vehicle_detected', 'people_count', 'validation_details',
            'total_hours', 'is_complete', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class CheckInSerializer(serializers.Serializer):
    """Serializer for check-in request."""
    image = serializers.ImageField()
    device_id = serializers.CharField(required=False)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    metadata = serializers.JSONField(required=False, default=dict)


class CheckInResponseSerializer(serializers.Serializer):
    """Serializer for check-in response."""
    attendance_id = serializers.UUIDField()
    status = serializers.CharField()
    employee = UserMinimalSerializer()
    check_in_time = serializers.DateTimeField()
    validation = serializers.DictField()


class CheckOutSerializer(serializers.Serializer):
    """Serializer for check-out request."""
    image = serializers.ImageField(required=False)
    attendance_id = serializers.UUIDField(required=False)


class OverrideSerializer(serializers.Serializer):
    """Serializer for attendance override."""
    status = serializers.ChoiceField(choices=['approved', 'rejected'])
    reason = serializers.CharField()


class AttendanceOverrideSerializer(serializers.ModelSerializer):
    """Serializer for AttendanceOverride."""
    performed_by = UserMinimalSerializer(read_only=True)
    
    class Meta:
        model = AttendanceOverride
        fields = [
            'id', 'attendance', 'performed_by',
            'previous_status', 'new_status', 'reason', 'created_at'
        ]


class ValidationRuleSerializer(serializers.ModelSerializer):
    """Serializer for ValidationRule."""
    class Meta:
        model = ValidationRule
        fields = [
            'id', 'name', 'code', 'description',
            'is_enabled', 'is_required', 'threshold',
            'config', 'applies_to_all', 'departments'
        ]


class AttendanceHistorySerializer(serializers.ModelSerializer):
    """Serializer for attendance history listing."""
    user = UserMinimalSerializer(read_only=True)
    total_hours = serializers.ReadOnlyField()
    
    class Meta:
        model = AttendanceRecord
        fields = [
            'id', 'user', 'check_in_time', 'check_out_time',
            'status', 'face_match_score', 'total_hours'
        ]
