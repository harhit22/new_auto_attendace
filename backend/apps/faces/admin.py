"""
Admin configuration for Faces app.
"""
from django.contrib import admin
from .models import FaceImage, FaceEmbedding, EnrollmentSession


@admin.register(FaceImage)
class FaceImageAdmin(admin.ModelAdmin):
    list_display = ['user', 'purpose', 'is_valid', 'face_detected', 'face_count', 'quality_score', 'captured_at']
    list_filter = ['purpose', 'is_valid', 'face_detected']
    search_fields = ['user__name', 'user__email']
    ordering = ['-created_at']
    readonly_fields = ['file_hash', 'created_at', 'updated_at']


@admin.register(FaceEmbedding)
class FaceEmbeddingAdmin(admin.ModelAdmin):
    list_display = ['user', 'model_version', 'embedding_size', 'confidence_score', 'is_primary', 'is_active', 'created_at']
    list_filter = ['is_primary', 'is_active', 'embedding_size']
    search_fields = ['user__name', 'user__email']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(EnrollmentSession)
class EnrollmentSessionAdmin(admin.ModelAdmin):
    list_display = ['user', 'status', 'images_captured', 'images_accepted', 'images_rejected', 'created_at', 'completed_at']
    list_filter = ['status', 'created_at']
    search_fields = ['user__name']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at', 'completed_at']
