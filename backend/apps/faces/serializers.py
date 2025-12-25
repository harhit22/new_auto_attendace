"""
Serializers for Face management.
"""
from rest_framework import serializers
from apps.users.serializers import UserMinimalSerializer
from .models import FaceImage, FaceEmbedding, EnrollmentSession


class FaceImageSerializer(serializers.ModelSerializer):
    """Serializer for FaceImage model."""
    user = UserMinimalSerializer(read_only=True)
    
    class Meta:
        model = FaceImage
        fields = [
            'id', 'user', 'image', 'purpose', 'quality_score',
            'is_valid', 'face_detected', 'face_count',
            'blur_score', 'lighting_score', 'occlusion_score',
            'captured_at', 'created_at'
        ]
        read_only_fields = [
            'id', 'file_hash', 'quality_score', 'face_detected',
            'face_count', 'blur_score', 'lighting_score', 'occlusion_score',
            'created_at'
        ]


class FaceImageUploadSerializer(serializers.Serializer):
    """Serializer for uploading face images."""
    images = serializers.ListField(
        child=serializers.ImageField(),
        min_length=1,
        max_length=10
    )
    purpose = serializers.ChoiceField(
        choices=['enrollment', 'attendance', 'training'],
        default='enrollment'
    )
    metadata = serializers.JSONField(required=False, default=dict)


class EnrollmentSessionSerializer(serializers.ModelSerializer):
    """Serializer for EnrollmentSession."""
    user = UserMinimalSerializer(read_only=True)
    
    class Meta:
        model = EnrollmentSession
        fields = [
            'id', 'user', 'status', 'images_captured',
            'images_accepted', 'images_rejected', 'rejection_reasons',
            'completed_at', 'error_message', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']


class EnrollmentResultSerializer(serializers.Serializer):
    """Serializer for enrollment result response."""
    employee_id = serializers.UUIDField()
    images_processed = serializers.IntegerField()
    images_accepted = serializers.IntegerField()
    images_rejected = serializers.IntegerField()
    rejection_reasons = serializers.ListField()
    enrollment_status = serializers.CharField()
    enrolled_at = serializers.DateTimeField(allow_null=True)


class FaceEmbeddingSerializer(serializers.ModelSerializer):
    """Serializer for FaceEmbedding."""
    class Meta:
        model = FaceEmbedding
        fields = [
            'id', 'face_image', 'model_version', 'embedding_size',
            'confidence_score', 'is_primary', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
