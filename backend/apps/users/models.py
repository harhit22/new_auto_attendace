"""
User and Department models.
"""
import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone
from core.models import BaseModel, SoftDeleteModel, TimeStampedModel


class Department(BaseModel):
    """
    Department model for organizing employees.
    Supports hierarchical structure with parent departments.
    """
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children'
    )
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    
    class Meta:
        db_table = 'departments'
        ordering = ['name']
        verbose_name = 'Department'
        verbose_name_plural = 'Departments'
    
    def __str__(self):
        return self.name
    
    @property
    def full_path(self):
        """Get the full department path (e.g., 'Engineering > Backend')."""
        if self.parent:
            return f"{self.parent.full_path} > {self.name}"
        return self.name
    
    @property
    def employee_count(self):
        """Get the count of active employees in this department."""
        return self.users.filter(is_active=True, deleted_at__isnull=True).count()


class UserManager(BaseUserManager):
    """
    Custom user manager for User model.
    """
    def create_user(self, email, password=None, **extra_fields):
        """Create and save a regular user."""
        if not email:
            raise ValueError('Users must have an email address')
        
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        """Create and save a superuser."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        extra_fields.setdefault('employee_id', f'ADMIN-{uuid.uuid4().hex[:8].upper()}')
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(email, password, **extra_fields)
    
    def get_queryset(self):
        """Filter out soft-deleted users by default."""
        return super().get_queryset().filter(deleted_at__isnull=True)
    
    def with_deleted(self):
        """Include soft-deleted users."""
        return super().get_queryset()


class User(AbstractBaseUser, PermissionsMixin, SoftDeleteModel):
    """
    Custom User model for employee management.
    Uses email for authentication instead of username.
    """
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('manager', 'Manager'),
        ('employee', 'Employee'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, max_length=255)
    employee_id = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True)
    
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='employee')
    
    # Status fields
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    enrolled_at = models.DateTimeField(null=True, blank=True)
    
    # Profile
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    
    # Metadata
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    last_login_device = models.CharField(max_length=255, blank=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']
    
    class Meta:
        db_table = 'users'
        ordering = ['name']
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        indexes = [
            models.Index(fields=['employee_id']),
            models.Index(fields=['email']),
            models.Index(fields=['role']),
            models.Index(fields=['department']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.employee_id})"
    
    @property
    def is_enrolled(self):
        """Check if user has completed face enrollment."""
        return self.enrolled_at is not None
    
    @property
    def face_count(self):
        """Get the count of enrolled face images."""
        return self.face_images.filter(is_valid=True, deleted_at__isnull=True).count()
    
    def enroll(self):
        """Mark user as enrolled."""
        if not self.enrolled_at:
            self.enrolled_at = timezone.now()
            self.save(update_fields=['enrolled_at', 'updated_at'])


class DeviceLog(TimeStampedModel):
    """
    Log of device activities for users.
    """
    EVENT_TYPES = [
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('sync', 'Sync'),
        ('error', 'Error'),
        ('app_open', 'App Open'),
        ('app_background', 'App Background'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='device_logs'
    )
    device_id = models.CharField(max_length=100)
    device_model = models.CharField(max_length=100, blank=True)
    os_version = models.CharField(max_length=50, blank=True)
    app_version = models.CharField(max_length=20, blank=True)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    event_data = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    class Meta:
        db_table = 'device_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['device_id']),
            models.Index(fields=['event_type']),
        ]
    
    def __str__(self):
        return f"{self.user.name} - {self.event_type} - {self.created_at}"


class AuditLog(models.Model):
    """
    Audit trail for tracking changes to resources.
    """
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_logs'
    )
    action = models.CharField(max_length=50)
    resource_type = models.CharField(max_length=50)
    resource_id = models.UUIDField(null=True, blank=True)
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['resource_type', 'resource_id']),
            models.Index(fields=['action']),
        ]
    
    def __str__(self):
        return f"{self.action} on {self.resource_type} by {self.user}"
