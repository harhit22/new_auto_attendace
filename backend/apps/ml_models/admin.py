"""
Admin configuration for ML Models app.
"""
from django.contrib import admin
from .models import ModelVersion, TrainingJob, TrainingLog


@admin.register(ModelVersion)
class ModelVersionAdmin(admin.ModelAdmin):
    list_display = ['version_tag', 'model_type', 'accuracy', 'is_active', 'is_deprecated', 'trained_at', 'deployed_at']
    list_filter = ['model_type', 'is_active', 'is_deprecated']
    search_fields = ['version_tag']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(TrainingJob)
class TrainingJobAdmin(admin.ModelAdmin):
    list_display = ['model_version', 'status', 'trigger_type', 'epochs', 'final_accuracy', 'started_at', 'completed_at']
    list_filter = ['status', 'trigger_type']
    search_fields = ['model_version__version_tag']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(TrainingLog)
class TrainingLogAdmin(admin.ModelAdmin):
    list_display = ['training_job', 'epoch', 'loss', 'accuracy', 'val_loss', 'val_accuracy', 'created_at']
    list_filter = ['training_job']
    ordering = ['-created_at']
    readonly_fields = ['created_at']
