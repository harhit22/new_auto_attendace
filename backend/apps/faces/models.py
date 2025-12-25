"""
Face Image and Embedding models.
"""
import uuid
import hashlib
from django.db import models
from django.conf import settings
from core.models import BaseModel, TimeStampedModel


def face_image_upload_path(instance, filename):
    """Generate upload path for face images."""
    ext = filename.split('.')[-1]
    return f"faces/{instance.user_id}/{uuid.uuid4().hex}.{ext}"


class FaceImage(BaseModel):
    """
    Stores face images for enrollment and attendance.
    """
    PURPOSE_CHOICES = [
        ('enrollment', 'Enrollment'),
        ('attendance', 'Attendance'),
        ('training', 'Training'),
    ]
    
    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='face_images'
    )
    image = models.ImageField(upload_to=face_image_upload_path)
    file_hash = models.CharField(max_length=64, unique=True, db_index=True)
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES, default='enrollment')
    quality_score = models.FloatField(null=True, blank=True)
    is_valid = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    captured_at = models.DateTimeField()
    
    # Image analysis results
    face_detected = models.BooleanField(default=False)
    face_count = models.PositiveIntegerField(default=0)
    face_bbox = models.JSONField(null=True, blank=True)  # Bounding box coordinates
    face_landmarks = models.JSONField(null=True, blank=True)  # Facial landmarks
    
    # Quality metrics
    blur_score = models.FloatField(null=True, blank=True)
    lighting_score = models.FloatField(null=True, blank=True)
    occlusion_score = models.FloatField(null=True, blank=True)
    
    class Meta:
        db_table = 'face_images'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'purpose']),
            models.Index(fields=['is_valid']),
            models.Index(fields=['quality_score']),
        ]
    
    def __str__(self):
        return f"Face image for {self.user.name} ({self.purpose})"
    
    def save(self, *args, **kwargs):
        # Generate file hash if not set
        if not self.file_hash and self.image:
            self.file_hash = self._calculate_hash()
        super().save(*args, **kwargs)
    
    def _calculate_hash(self):
        """Calculate SHA-256 hash of the image file."""
        hasher = hashlib.sha256()
        for chunk in self.image.chunks():
            hasher.update(chunk)
        return hasher.hexdigest()


class FaceEmbedding(TimeStampedModel):
    """
    Stores face embeddings (feature vectors) for recognition.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='face_embeddings'
    )
    face_image = models.ForeignKey(
        FaceImage,
        on_delete=models.CASCADE,
        related_name='embeddings'
    )
    model_version = models.ForeignKey(
        'ml_models.ModelVersion',
        on_delete=models.SET_NULL,
        null=True,
        related_name='embeddings'
    )
    
    # Embedding data
    embedding_vector = models.BinaryField()  # Serialized numpy array
    embedding_size = models.PositiveIntegerField(default=512)
    confidence_score = models.FloatField(null=True, blank=True)
    
    # Status
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'face_embeddings'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_primary']),
            models.Index(fields=['model_version']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"Embedding for {self.user.name}"
    
    def set_embedding(self, embedding_array):
        """Store numpy array as binary."""
        import numpy as np
        self.embedding_vector = embedding_array.astype(np.float32).tobytes()
        self.embedding_size = len(embedding_array)
    
    def get_embedding(self):
        """Retrieve embedding as numpy array."""
        import numpy as np
        return np.frombuffer(self.embedding_vector, dtype=np.float32)


class EnrollmentSession(TimeStampedModel):
    """
    Tracks face enrollment sessions.
    """
    STATUS_CHOICES = [
        ('started', 'Started'),
        ('capturing', 'Capturing'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='enrollment_sessions'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='started')
    
    # Stats
    images_captured = models.PositiveIntegerField(default=0)
    images_accepted = models.PositiveIntegerField(default=0)
    images_rejected = models.PositiveIntegerField(default=0)
    
    # Rejection details
    rejection_reasons = models.JSONField(default=list, blank=True)
    
    # Completion
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    
    # Device info
    device_id = models.CharField(max_length=100, blank=True)
    device_model = models.CharField(max_length=100, blank=True)
    
    class Meta:
        db_table = 'enrollment_sessions'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Enrollment session for {self.user.name} - {self.status}"
