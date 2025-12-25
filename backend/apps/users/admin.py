"""
Admin configuration for Users app.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Department, DeviceLog, AuditLog


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'parent', 'is_active', 'employee_count', 'created_at']
    list_filter = ['is_active', 'parent']
    search_fields = ['name', 'code']
    ordering = ['name']


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'employee_id', 'name', 'department', 'role', 'is_active', 'is_enrolled']
    list_filter = ['role', 'is_active', 'department', 'enrolled_at']
    search_fields = ['email', 'name', 'employee_id']
    ordering = ['name']
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('name', 'employee_id', 'phone', 'avatar')}),
        ('Organization', {'fields': ('department', 'role')}),
        ('Status', {'fields': ('is_active', 'is_staff', 'is_superuser', 'enrolled_at')}),
        ('Permissions', {'fields': ('groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login',)}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'employee_id', 'name', 'password1', 'password2', 'role'),
        }),
    )
    
    readonly_fields = ['enrolled_at', 'last_login']


@admin.register(DeviceLog)
class DeviceLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'device_id', 'event_type', 'app_version', 'created_at']
    list_filter = ['event_type', 'created_at']
    search_fields = ['user__name', 'device_id']
    ordering = ['-created_at']
    readonly_fields = ['created_at']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'resource_type', 'resource_id', 'created_at']
    list_filter = ['action', 'resource_type', 'created_at']
    search_fields = ['user__name', 'action']
    ordering = ['-created_at']
    readonly_fields = ['user', 'action', 'resource_type', 'resource_id', 'old_values', 'new_values', 'created_at']
