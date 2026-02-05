"""
Attendance validation models.

NOTE: The main attendance models (SaaSAttendance, Trip) are in core/models.py
This file only contains configurable validation rules.
"""
import uuid
from django.db import models


class ValidationRule(models.Model):
    """
    Configurable validation rules for attendance.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    
    # Rule configuration
    is_enabled = models.BooleanField(default=True)
    is_required = models.BooleanField(default=True)
    threshold = models.FloatField(null=True, blank=True)
    config = models.JSONField(default=dict, blank=True)
    
    # Scope
    applies_to_all = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'validation_rules'
        ordering = ['name']
    
    def __str__(self):
        return self.name
