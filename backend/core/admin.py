"""
Admin configuration for Core SaaS models.
"""
from django.contrib import admin
from .models import (
    Organization, SaaSEmployee,
    CustomYoloModel, DetectionRequirement, LoginDetectionResult,
    VehicleComplianceRecord, Trip, Area, Ward, Route
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
    list_display = ['employee_id', 'full_name', 'organization', 'department', 'role', 'status', 'face_enrolled', 'image_count', 'image_status']
    list_filter = ['organization', 'role', 'status', 'face_enrolled', 'image_status', 'light_trained', 'heavy_trained']
    search_fields = ['first_name', 'last_name', 'employee_id', 'email']
    ordering = ['organization', 'first_name']
    readonly_fields = ['created_at', 'updated_at', 'last_trained_at', 'light_trained_at', 'heavy_trained_at']
    
    fieldsets = (
        ('Organization', {'fields': ('organization', 'employee_id')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'email', 'phone', 'department', 'designation', 'role')}),
        ('Employee Login', {'fields': ('password', 'last_login')}),
        ('Face Recognition', {'fields': ('face_enrolled', 'face_image', 'image_count', 'image_status')}),
        ('Light Model (128-d)', {'fields': ('light_trained', 'light_trained_at', 'light_accuracy')}),
        ('Heavy Model (512-d)', {'fields': ('heavy_trained', 'heavy_trained_at', 'heavy_accuracy')}),
        ('Status', {'fields': ('status', 'join_date')}),
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
    list_display = ('id', 'timestamp', 'compliance_passed')
    list_filter = []  # REMOVED: Filters are slow without indexes
    ordering = []     # CRITICAL: Disables the slow default sort (ORDER BY timestamp DESC)
    
    # Optimize foreign key lookups
    list_select_related = ['organization', 'employee', 'yolo_model']
    search_fields = ['employee__first_name', 'employee__last_name', 'organization__org_code']
    readonly_fields = ['timestamp']
    autocomplete_fields = ['organization', 'employee', 'yolo_model']
    list_per_page = 20         # Reduce rows per page
    show_full_result_count = False  # Critical: Avoids expensive COUNT(*) on large tables
    



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


# ============================================
# TRIP & VEHICLE COMPLIANCE
# ============================================

@admin.register(VehicleComplianceRecord)
class VehicleComplianceRecordAdmin(admin.ModelAdmin):
    list_display = ['id', 'organization', 'timestamp', 'compliance_passed']
    list_filter = ['organization', 'compliance_passed']
    readonly_fields = ['timestamp']
    ordering = ['-timestamp']
    list_per_page = 25


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ['id', 'date', 'driver', 'helper', 'route', 'status', 'checkin_time', 'checkout_time']
    list_filter = ['organization', 'status', 'date']
    search_fields = ['driver__employee_id', 'driver__first_name', 'helper__employee_id']
    ordering = ['-date', '-checkin_time']
    readonly_fields = ['created_at', 'updated_at', 'work_duration', 'date']
    date_hierarchy = 'date'
    list_per_page = 25
    
    # Use raw_id for ALL foreign keys to prevent slow dropdown loading
    raw_id_fields = [
        'driver', 'helper', 'organization', 'route',
        'checkin_driver_detection', 'checkin_helper_detection', 'checkin_vehicle',
        'checkout_driver_detection', 'checkout_helper_detection', 'checkout_vehicle'
    ]


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'organization', 'ward_count', 'is_active']
    list_filter = ['organization', 'is_active']
    search_fields = ['name', 'code', 'name_hindi']
    ordering = ['organization', 'name']
    readonly_fields = ['created_at', 'updated_at']
    
    def ward_count(self, obj):
        return obj.ward_count
    ward_count.short_description = 'Wards'


@admin.register(Ward)
class WardAdmin(admin.ModelAdmin):
    list_display = ['number', 'name', 'area', 'route_count', 'population', 'is_active']
    list_filter = ['area__organization', 'area', 'is_active']
    search_fields = ['number', 'name', 'name_hindi']
    ordering = ['area', 'number']
    readonly_fields = ['created_at', 'updated_at']
    
    def route_count(self, obj):
        return obj.route_count
    route_count.short_description = 'Routes'


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'ward', 'distance_km', 'estimated_duration_hours', 'is_active']
    list_filter = ['ward__area__organization', 'ward__area', 'ward', 'is_active']
    search_fields = ['code', 'name', 'name_hindi']
    ordering = ['ward', 'code']
    readonly_fields = ['created_at', 'updated_at']
