"""
Admin configuration for Attendance app.
"""
from django.contrib import admin
from .models import ValidationRule


@admin.register(ValidationRule)
class ValidationRuleAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'is_enabled', 'is_required', 'threshold', 'applies_to_all']
    list_filter = ['is_enabled', 'is_required', 'applies_to_all']
    search_fields = ['name', 'code']
    ordering = ['name']
