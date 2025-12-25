"""
Core base models for the attendance system.
Provides common functionality: timestamps, soft delete, UUID primary keys.
"""
import uuid
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    """
    Abstract model providing created_at and updated_at timestamps.
    """
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteModel(models.Model):
    """
    Abstract model providing soft delete functionality.
    """
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        abstract = True

    def soft_delete(self):
        """Mark as deleted without actually deleting."""
        self.deleted_at = timezone.now()
        self.save(update_fields=['deleted_at', 'updated_at'])

    def restore(self):
        """Restore a soft-deleted record."""
        self.deleted_at = None
        self.save(update_fields=['deleted_at', 'updated_at'])

    @property
    def is_deleted(self):
        """Check if the record is soft-deleted."""
        return self.deleted_at is not None


class BaseModel(TimeStampedModel, SoftDeleteModel):
    """
    Base model combining timestamps and soft delete.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


# =============================================================================
# SaaS Multi-Tenant Models (Organization, Employee, etc.)
# =============================================================================

class Organization(models.Model):
    """
    A company/business that subscribes to the service.
    Multi-tenant: All data is scoped to an organization.
    """
    PLAN_CHOICES = [
        ('free', 'Free - 5 employees'),
        ('pro', 'Pro - 50 employees'),
        ('business', 'Business - Unlimited'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Simple login credentials (user-facing)
    org_code = models.CharField(max_length=20, unique=True, help_text="Simple code like ACME or OFFICE1")
    password = models.CharField(max_length=50, help_text="Simple password for kiosk access")
    
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, help_text="URL-friendly name")
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    logo = models.ImageField(upload_to='org_logos/', null=True, blank=True)
    
    # Subscription
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default='free')
    max_employees = models.IntegerField(default=5)
    is_active = models.BooleanField(default=True)
    
    # Settings
    check_in_start = models.TimeField(default='08:00')
    check_in_end = models.TimeField(default='10:00')
    work_hours = models.IntegerField(default=8, help_text="Expected work hours per day")
    recognition_mode = models.CharField(
        max_length=20, 
        default='light',
        choices=[('light', 'Light (Quick)'), ('heavy', 'Heavy (DeepFace)')],
        help_text="Which model to use for kiosk face recognition"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'organizations'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.org_code})"
    
    @property
    def employee_count(self):
        return self.saas_employees.count()
    
    @property
    def can_add_employee(self):
        return self.employee_count < self.max_employees


class SaaSEmployee(models.Model):
    """
    An employee enrolled in the SaaS attendance system.
    Images are captured first, then admin trains the model.
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('terminated', 'Terminated'),
    ]
    
    IMAGE_STATUS_CHOICES = [
        ('pending', 'Pending Capture'),
        ('captured', 'Images Captured'),
        ('approved', 'Approved'),
        ('trained', 'Model Trained'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, 
        on_delete=models.CASCADE, 
        related_name='saas_employees'
    )
    
    # Basic Info
    employee_id = models.CharField(max_length=50, help_text="Company employee ID")
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    department = models.CharField(max_length=100, blank=True)
    designation = models.CharField(max_length=100, blank=True)
    
    # Employee Login Credentials
    password = models.CharField(max_length=50, blank=True, help_text="Employee's login password")
    last_login = models.DateTimeField(null=True, blank=True, help_text="Last login time")
    
    # Face Recognition - DUAL MODEL SUPPORT
    # Old field kept for backward compatibility
    face_enrolled = models.BooleanField(default=False)
    face_embeddings = models.JSONField(default=list, blank=True, help_text="Active embeddings for recognition")
    face_image = models.ImageField(upload_to='employee_faces/', null=True, blank=True)
    
    # Dataset for training (images stored, not yet trained)
    captured_embeddings = models.JSONField(default=list, blank=True, help_text="Embeddings waiting for training")
    image_count = models.IntegerField(default=0, help_text="Number of captured face images")
    image_status = models.CharField(max_length=20, choices=IMAGE_STATUS_CHOICES, default='pending')
    
    # LIGHT MODEL (face-api.js / Quick) - 128-dim embeddings
    light_embeddings = models.JSONField(default=list, blank=True, help_text="Light model embeddings (128-dim)")
    light_trained = models.BooleanField(default=False)
    light_trained_at = models.DateTimeField(null=True, blank=True)
    light_accuracy = models.FloatField(null=True, blank=True, help_text="Last test accuracy %")
    
    # HEAVY MODEL (DeepFace/ArcFace) - 512-dim embeddings
    heavy_embeddings = models.JSONField(default=list, blank=True, help_text="Heavy model embeddings (512-dim)")
    heavy_trained = models.BooleanField(default=False)
    heavy_trained_at = models.DateTimeField(null=True, blank=True)
    heavy_accuracy = models.FloatField(null=True, blank=True, help_text="Last test accuracy %")
    
    # Training info (legacy, for backward compatibility)
    last_trained_at = models.DateTimeField(null=True, blank=True)
    training_mode = models.CharField(max_length=20, blank=True, help_text="Currently active model: light or heavy")
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    join_date = models.DateField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'saas_employees'
        # Removed ordering to avoid MySQL memory issues with large JSON fields
        unique_together = ['organization', 'employee_id']
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.employee_id})"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
    
    @property
    def ready_for_training(self):
        """Returns True if employee has enough images for training (100+)"""
        return self.image_count >= 100


class SaaSAttendance(models.Model):
    """
    Daily attendance record for SaaS employees.
    One record per employee per day.
    """
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('late', 'Late'),
        ('half_day', 'Half Day'),
        ('absent', 'Absent'),
        ('leave', 'On Leave'),
        ('holiday', 'Holiday'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, 
        on_delete=models.CASCADE, 
        related_name='attendance_records'
    )
    employee = models.ForeignKey(
        SaaSEmployee, 
        on_delete=models.CASCADE, 
        related_name='attendance_records'
    )
    
    date = models.DateField(default=timezone.now, db_index=True)
    check_in = models.DateTimeField(null=True, blank=True)
    check_out = models.DateTimeField(null=True, blank=True)
    
    # Calculated fields
    work_duration = models.DurationField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='present')
    
    # Recognition confidence
    check_in_confidence = models.FloatField(null=True, blank=True)
    check_out_confidence = models.FloatField(null=True, blank=True)
    
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'saas_attendance'
        ordering = ['-date', 'employee__first_name']
        unique_together = ['organization', 'employee', 'date']
    
    def __str__(self):
        return f"{self.employee.full_name} - {self.date}"
    
    def calculate_work_duration(self):
        """Calculate and save work duration."""
        if self.check_in and self.check_out:
            self.work_duration = self.check_out - self.check_in
            self.save(update_fields=['work_duration', 'updated_at'])
