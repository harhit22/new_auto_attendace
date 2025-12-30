"""
Admin configuration for Core SaaS models.
"""
from django.contrib import admin
from .models import (
    Organization, SaaSEmployee, SaaSAttendance,
    CustomYoloModel, DetectionRequirement, LoginDetectionResult
)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ['name', 'org_code', 'plan', 'max_employees', 'employee_count', 'recognition_mode', 'is_active', 'created_at']
    list_filter = ['plan', 'is_active', 'recognition_mode']
    search_fields = ['name', 'org_code', 'email']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Login Credentials', {'fields': ('org_code', 'password')}),
        ('Organization Info', {'fields': ('name', 'slug', 'email', 'phone', 'address', 'logo')}),
        ('Subscription', {'fields': ('plan', 'max_employees', 'is_active')}),
        ('Work Settings', {'fields': ('check_in_start', 'check_in_end', 'work_hours', 'recognition_mode')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )


@admin.register(SaaSEmployee)
class SaaSEmployeeAdmin(admin.ModelAdmin):
    list_display = ['employee_id', 'full_name', 'organization', 'department', 'status', 'face_enrolled', 'image_count', 'image_status']
    list_filter = ['organization', 'status', 'face_enrolled', 'image_status', 'light_trained', 'heavy_trained']
    search_fields = ['first_name', 'last_name', 'employee_id', 'email']
    ordering = ['organization', 'first_name']
    readonly_fields = ['created_at', 'updated_at', 'last_trained_at', 'light_trained_at', 'heavy_trained_at']
    
    fieldsets = (
        ('Organization', {'fields': ('organization', 'employee_id')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'email', 'phone', 'department', 'designation')}),
        ('Employee Login', {'fields': ('password', 'last_login')}),
        ('Face Recognition', {'fields': ('face_enrolled', 'face_image', 'image_count', 'image_status')}),
        ('Light Model (128-d)', {'fields': ('light_trained', 'light_trained_at', 'light_accuracy')}),
        ('Heavy Model (512-d)', {'fields': ('heavy_trained', 'heavy_trained_at', 'heavy_accuracy')}),
        ('Status', {'fields': ('status', 'join_date')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )


@admin.register(SaaSAttendance)
class SaaSAttendanceAdmin(admin.ModelAdmin):
    list_display = ['employee', 'organization', 'date', 'check_in', 'check_out', 'status', 'work_duration']
    list_filter = ['organization', 'status', 'date']
    search_fields = ['employee__first_name', 'employee__last_name', 'employee__employee_id']
    ordering = ['-date', 'employee__first_name']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'date'
    
    fieldsets = (
        (None, {'fields': ('organization', 'employee', 'date')}),
        ('Times', {'fields': ('check_in', 'check_out', 'work_duration')}),
        ('Status', {'fields': ('status', 'notes')}),
        ('Confidence Scores', {'fields': ('check_in_confidence', 'check_out_confidence')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )


# ============================================
# YOLO DETECTION MODELS
# ============================================

@admin.register(CustomYoloModel)
class CustomYoloModelAdmin(admin.ModelAdmin):
    list_display = ['name', 'organization', 'is_active', 'created_at']
    list_filter = ['organization', 'is_active']
    search_fields = ['name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(DetectionRequirement)
class DetectionRequirementAdmin(admin.ModelAdmin):
    list_display = ['class_name', 'display_name', 'yolo_model', 'is_required']
    list_filter = ['yolo_model', 'is_required']
    search_fields = ['class_name', 'display_name']


@admin.register(LoginDetectionResult)
class LoginDetectionResultAdmin(admin.ModelAdmin):
    list_display = ['employee', 'organization', 'timestamp', 'compliance_passed', 'face_confidence']
    list_display = ['employee', 'organization', 'timestamp', 'compliance_passed', 'face_confidence']
    list_filter = ['compliance_passed']
    # Optimize foreign key lookups
    list_select_related = ['organization', 'employee', 'yolo_model']
    search_fields = ['employee__first_name', 'employee__last_name']
    readonly_fields = ['timestamp']
    autocomplete_fields = ['organization', 'employee', 'yolo_model']
    list_per_page = 50  # Limit rows per page for speed


# ============================================
# UNREGISTER THIRD-PARTY MODELS FROM ADMIN
# ============================================

# Unregister Celery models
try:
    from django_celery_results.models import TaskResult, GroupResult
    admin.site.unregister(TaskResult)
    admin.site.unregister(GroupResult)
except Exception:
    pass

# Unregister Celery Beat/Periodic Task models  
try:
    from django_celery_beat.models import (
        PeriodicTask, IntervalSchedule, CrontabSchedule,
        SolarSchedule, ClockedSchedule
    )
    admin.site.unregister(PeriodicTask)
    admin.site.unregister(IntervalSchedule)
    admin.site.unregister(CrontabSchedule)
    admin.site.unregister(SolarSchedule)
    admin.site.unregister(ClockedSchedule)
except Exception:
    pass

# Unregister Token Blacklist models
try:
    from rest_framework_simplejwt.token_blacklist.models import (
        BlacklistedToken, OutstandingToken
    )
    admin.site.unregister(BlacklistedToken)
    admin.site.unregister(OutstandingToken)
except Exception:
    pass

# Unregister Django Auth Group (keep User)
try:
    from django.contrib.auth.models import Group
    admin.site.unregister(Group)
except Exception:
    pass

