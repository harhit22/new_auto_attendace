"""ML model versioning and training models."""
import uuid
from django.db import models
from core.models import TimeStampedModel


class ModelVersion(TimeStampedModel):
    """Tracks ML model versions."""
    MODEL_TYPES = [
        ('lightweight', 'Lightweight (On-Device)'),
        ('heavy', 'Heavy (Server-Side)'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version_tag = models.CharField(max_length=50, unique=True)
    model_type = models.CharField(max_length=20, choices=MODEL_TYPES)
    file_path = models.CharField(max_length=500)
    
    # Metrics
    accuracy = models.FloatField(null=True, blank=True)
    precision_score = models.FloatField(null=True, blank=True)
    recall = models.FloatField(null=True, blank=True)
    f1_score = models.FloatField(null=True, blank=True)
    training_samples = models.PositiveIntegerField(null=True, blank=True)
    
    # Status
    is_active = models.BooleanField(default=False)
    is_deprecated = models.BooleanField(default=False)
    trained_at = models.DateTimeField(null=True, blank=True)
    deployed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'model_versions'
        indexes = [
            models.Index(fields=['model_type', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.model_type} - {self.version_tag}"


class TrainingJob(TimeStampedModel):
    """Tracks model training jobs."""
    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    TRIGGER_TYPES = [('automatic', 'Automatic'), ('manual', 'Manual')]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    model_version = models.ForeignKey(ModelVersion, on_delete=models.SET_NULL, null=True, related_name='training_jobs')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued')
    trigger_type = models.CharField(max_length=20, choices=TRIGGER_TYPES)
    config = models.JSONField(default=dict)
    epochs = models.PositiveIntegerField(null=True, blank=True)
    final_loss = models.FloatField(null=True, blank=True)
    final_accuracy = models.FloatField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'training_jobs'


class TrainingLog(models.Model):
    """Logs training metrics per epoch."""
    id = models.BigAutoField(primary_key=True)
    training_job = models.ForeignKey(TrainingJob, on_delete=models.CASCADE, related_name='logs')
    epoch = models.PositiveIntegerField()
    loss = models.FloatField(null=True)
    accuracy = models.FloatField(null=True)
    val_loss = models.FloatField(null=True)
    val_accuracy = models.FloatField(null=True)
    metrics = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'training_logs'
