"""
Attendance record models.
"""
import uuid
from django.db import models
from core.models import TimeStampedModel


class AttendanceRecord(TimeStampedModel):
    """
    Stores attendance check-in/check-out records.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('manual_override', 'Manual Override'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    face_image = models.ForeignKey(
        'faces.FaceImage',
        on_delete=models.SET_NULL,
        null=True,
        related_name='attendance_records'
    )
    
    # Timestamps
    check_in_time = models.DateTimeField(db_index=True)
    check_out_time = models.DateTimeField(null=True, blank=True)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Face validation
    face_match_score = models.FloatField(null=True, blank=True)
    image_quality_score = models.FloatField(null=True, blank=True)
    
    # Contextual validation
    vehicle_detected = models.BooleanField(null=True, blank=True)
    people_count = models.PositiveIntegerField(null=True, blank=True)
    
    # Validation details
    validation_details = models.JSONField(default=dict, blank=True)
    
    # Device/location info
    device_id = models.CharField(max_length=100, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    # Manual override
    approved_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_attendances'
    )
    override_reason = models.TextField(blank=True)
    
    class Meta:
        db_table = 'attendance_records'
        ordering = ['-check_in_time']
        indexes = [
            models.Index(fields=['user', '-check_in_time']),
            models.Index(fields=['status']),
            models.Index(fields=['check_in_time']),
        ]
    
    def __str__(self):
        return f"{self.user.name} - {self.check_in_time.date()}"
    
    @property
    def total_hours(self):
        """Calculate total work hours."""
        if self.check_out_time and self.check_in_time:
            delta = self.check_out_time - self.check_in_time
            return round(delta.total_seconds() / 3600, 2)
        return None
    
    @property
    def is_complete(self):
        """Check if both check-in and check-out are recorded."""
        return self.check_out_time is not None


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
    departments = models.ManyToManyField(
        'users.Department',
        blank=True,
        related_name='validation_rules'
    )
    
    class Meta:
        db_table = 'validation_rules'
        ordering = ['name']
    
    def __str__(self):
        return self.name


class AttendanceOverride(TimeStampedModel):
    """
    Log of manual attendance overrides.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attendance = models.ForeignKey(
        AttendanceRecord,
        on_delete=models.CASCADE,
        related_name='overrides'
    )
    performed_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='performed_overrides'
    )
    previous_status = models.CharField(max_length=20)
    new_status = models.CharField(max_length=20)
    reason = models.TextField()
    
    class Meta:
        db_table = 'attendance_overrides'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Override for {self.attendance}"
