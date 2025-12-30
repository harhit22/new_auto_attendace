"""
Admin configuration for Attendance app.
"""
from django.contrib import admin
from .models import AttendanceRecord, ValidationRule, AttendanceOverride


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ['user', 'check_in_time', 'check_out_time', 'status', 'face_match_score', 'total_hours']
    list_filter = ['status', 'check_in_time']
    search_fields = ['user__name', 'user__email', 'user__employee_id']
    ordering = ['-check_in_time']
    date_hierarchy = 'check_in_time'
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        (None, {'fields': ('user', 'face_image')}),
        ('Times', {'fields': ('check_in_time', 'check_out_time')}),
        ('Status', {'fields': ('status',)}),
        ('Face Validation', {'fields': ('face_match_score', 'image_quality_score')}),
        ('Context', {'fields': ('vehicle_detected', 'people_count', 'validation_details')}),
        ('Device & Location', {'fields': ('device_id', 'latitude', 'longitude', 'ip_address')}),
        ('Override', {'fields': ('approved_by', 'override_reason')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )


@admin.register(ValidationRule)
class ValidationRuleAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'is_enabled', 'is_required', 'threshold', 'applies_to_all']
    list_filter = ['is_enabled', 'is_required', 'applies_to_all']
    search_fields = ['name', 'code']
    ordering = ['name']


@admin.register(AttendanceOverride)
class AttendanceOverrideAdmin(admin.ModelAdmin):
    list_display = ['attendance', 'performed_by', 'previous_status', 'new_status', 'created_at']
    list_filter = ['previous_status', 'new_status', 'created_at']
    search_fields = ['attendance__user__name', 'performed_by__name']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']
