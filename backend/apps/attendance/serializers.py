"""
Attendance serializers.
"""
from rest_framework import serializers
from core.models import SaaSAttendance, SaaSEmployee, ValidationRule
# Note: ValidationRule import from .models was removed as we just fixed models.py to only have ValidationRule
# But core.models seems to be where we should be getting things now? 
# Wait, I kept ValidationRule in apps/attendance/models.py, so I should import it from there.

from apps.attendance.models import ValidationRule

class AttendanceRecordSerializer(serializers.ModelSerializer):
    """Serializer for SaaSAttendance (formerly AttendanceRecord)."""
    # Use check_in_time alias for backward compatibility if needed, or mapping
    # Core model uses: employee, check_in, check_out, status
    
    employee_name = serializers.CharField(source='employee.first_name', read_only=True)
    check_in_time = serializers.DateTimeField(source='check_in', read_only=True)
    check_out_time = serializers.DateTimeField(source='check_out', read_only=True)
    
    class Meta:
        model = SaaSAttendance
        fields = [
            'id', 'employee_name', 'check_in_time', 'check_out_time',
            'status', 'check_in_confidence', 
            'vehicle_detected', 'screen_data',
            'created_at'
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
    employee_name = serializers.CharField()
    check_in_time = serializers.DateTimeField()
    confidence = serializers.FloatField(required=False)


class CheckOutSerializer(serializers.Serializer):
    """Serializer for check-out request."""
    image = serializers.ImageField(required=False)
    attendance_id = serializers.UUIDField(required=False)


class OverrideSerializer(serializers.Serializer):
    """Serializer for attendance override."""
    status = serializers.ChoiceField(choices=['approved', 'rejected'])
    reason = serializers.CharField()


class ValidationRuleSerializer(serializers.ModelSerializer):
    """Serializer for ValidationRule."""
    class Meta:
        model = ValidationRule
        fields = [
            'id', 'name', 'code', 'description',
            'is_enabled', 'is_required', 'threshold',
            'config', 'applies_to_all'
        ]


class AttendanceHistorySerializer(serializers.ModelSerializer):
    """Serializer for attendance history listing."""
    employee_name = serializers.CharField(source='employee.first_name', read_only=True)
    check_in_time = serializers.DateTimeField(source='check_in', read_only=True)
    check_out_time = serializers.DateTimeField(source='check_out', read_only=True)
    
    class Meta:
        model = SaaSAttendance
        fields = [
            'id', 'employee_name', 'check_in_time', 'check_out_time',
            'status', 'check_in_confidence'
        ]
