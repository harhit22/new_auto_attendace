"""Sync models - Offline-first synchronization."""
import uuid
from django.db import models
from core.models import TimeStampedModel


class SyncQueue(TimeStampedModel):
    """Queue for offline-first sync operations."""
    OPERATIONS = [('insert', 'Insert'), ('update', 'Update'), ('delete', 'Delete')]
    STATUS_CHOICES = [('pending', 'Pending'), ('processing', 'Processing'), ('completed', 'Completed'), ('failed', 'Failed')]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device_id = models.CharField(max_length=100, db_index=True)
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='sync_queue')
    operation = models.CharField(max_length=20, choices=OPERATIONS)
    table_name = models.CharField(max_length=50)
    record_id = models.UUIDField()
    payload = models.JSONField()
    priority = models.IntegerField(default=0)
    retry_count = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'sync_queue'
        ordering = ['-priority', 'created_at']
