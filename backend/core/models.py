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

    # New Flexible Configuration Fields
    attendance_mode = models.CharField(
        max_length=20,
        default='daily',
        choices=[('daily', 'Daily (First In/Last Out)'), ('continuous', 'Continuous (Log Every Scan)')],
        help_text="How attendance is calculated and stored"
    )
    compliance_enforcement = models.CharField(
        max_length=20,
        default='report',
        choices=[('block', 'Block Entry on Failure'), ('report', 'Allow & Report Failure')],
        help_text="Action to take when object detection rules (helmet/vest) fail"
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
    role = models.CharField(max_length=50, default='driver', blank=True, help_text="Employee role")
    
    # Employee Login Credentials
    password = models.CharField(max_length=50, blank=True, help_text="Employee's login password")
    last_login = models.DateTimeField(null=True, blank=True, help_text="Last login time")
    
    # Face Recognition - DUAL MODEL SUPPORT
    # Old field kept for backward compatibility
    face_enrolled = models.BooleanField(default=False)
    face_embeddings = models.JSONField(default=list, blank=True, help_text="Active embeddings for recognition")
    face_image = models.ImageField(upload_to='employee_faces/', null=True, blank=True)
    
    # Dataset for training (images stored, not yet trained)
    # captured_embeddings = 512-d from DeepFace (backend processing)
    captured_embeddings = models.JSONField(default=list, blank=True, help_text="DeepFace 512-d embeddings for heavy model")
    # captured_embeddings_light = 128-d from face-api.js (frontend capture)
    captured_embeddings_light = models.JSONField(default=list, blank=True, help_text="face-api.js 128-d embeddings for light model")
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


class Area(models.Model):
    """
    Area/Zone within a city (e.g., North Zone, South Zone).
    Organizations can have multiple areas for geographic division.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='areas'
    )
    
    # area info
    name = models.CharField(max_length=100, help_text="Area/Zone name (e.g., North Zone)")
    name_hindi = models.CharField(max_length=100, blank=True, help_text="Area name in Hindi")
    code = models.CharField(max_length=20, help_text="Short code (e.g., NZ, SZ)")
    
    # metadata
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'areas'
        ordering = ['name']
        unique_together = ['organization', 'code']
    
    def __str__(self):
        return f"{self.name} ({self.organization.org_code})"
    
    @property
    def ward_count(self):
        return self.wards.count()


class Ward(models.Model):
    """
    Ward within an Area (e.g., Ward 1, Ward 2).
    Each ward contains multiple routes for garbage collection.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    area = models.ForeignKey(
        Area,
        on_delete=models.CASCADE,
        related_name='wards'
    )
    
    # ward info
    number = models.CharField(max_length=50, help_text="Ward number/code (e.g., 1, 2, commercial02)")
    name = models.CharField(max_length=100, blank=True, help_text="Optional ward name")
    name_hindi = models.CharField(max_length=100, blank=True, help_text="Ward name in Hindi")
    
    # metadata
    description = models.TextField(blank=True)
    population = models.IntegerField(null=True, blank=True, help_text="Estimated population")
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'wards'
        ordering = ['area', 'number']
        unique_together = ['area', 'number']
    
    def __str__(self):
        display = f"Ward {self.number}"
        if self.name:
            display += f" - {self.name}"
        display += f" ({self.area.name})"
        return display
    
    @property
    def route_count(self):
        return self.routes.count()
    
    @property
    def organization(self):
        return self.area.organization


class Route(models.Model):
    """
    Garbage collection route within a ward.
    Drivers are assigned to routes for their daily duty.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ward = models.ForeignKey(
        Ward,
        on_delete=models.CASCADE,
        related_name='routes'
    )
    
    # route info
    code = models.CharField(max_length=20, help_text="Route code (e.g., R1, R2, A01)")
    name = models.CharField(max_length=100, help_text="Route name or description")
    name_hindi = models.CharField(max_length=100, blank=True, help_text="Route name in Hindi")
    
    # route details
    description = models.TextField(blank=True, help_text="Route details, landmarks, etc.")
    estimated_duration_hours = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Estimated time to complete route (hours)"
    )
    distance_km = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Route distance in kilometers"
    )
    
    # status
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'routes'
        ordering = ['ward', 'code']
        unique_together = ['ward', 'code']
    
    def __str__(self):
        return f"{self.code} - {self.name} (Ward {self.ward.number})"
    
    @property
    def full_path(self):
        """Return full hierarchy path for display."""
        return f"{self.ward.area.organization.name} > {self.ward.area.name} > Ward {self.ward.number} > {self.name}"
    
    @property
    def organization(self):
        return self.ward.area.organization


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
    verification_method = models.CharField(max_length=50, blank=True, default='', help_text='face_employee_dashboard, face_realtime, etc.')
    
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


# =============================================================================
# Custom YOLO Detection Models
# =============================================================================

def yolo_model_upload_path(instance, filename):
    """Generate unique path: yolo_models/{org_code}/{uuid}_{filename}"""
    import uuid as uuid_lib
    unique_id = str(uuid_lib.uuid4())[:8]
    org_code = instance.organization.org_code if instance.organization else 'unknown'
    return f'yolo_models/{org_code}/{unique_id}_{filename}'


class CustomYoloModel(models.Model):
    """
    Admin-uploaded YOLO model for custom object detection.
    Admin can name it anything and configure which classes are required.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='yolo_models'
    )
    name = models.CharField(max_length=200, help_text="Admin-defined name for this model")
    description = models.TextField(blank=True)
    model_file = models.FileField(upload_to=yolo_model_upload_path, help_text=".pt YOLO model file")
    classes = models.JSONField(default=list, help_text="Classes this model can detect")
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'custom_yolo_models'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.organization.org_code})"


class DetectionRequirement(models.Model):
    """
    Defines which YOLO classes are required/optional for an organization.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    yolo_model = models.ForeignKey(
        CustomYoloModel,
        on_delete=models.CASCADE,
        related_name='requirements'
    )
    class_name = models.CharField(max_length=100, help_text="Name of the class to detect")
    display_name = models.CharField(max_length=200, blank=True, help_text="Human-readable name")
    is_required = models.BooleanField(default=False, help_text="If true, login fails without this object")
    
    class Meta:
        db_table = 'detection_requirements'
        unique_together = ['yolo_model', 'class_name']
    
    def __str__(self):
        req = "Required" if self.is_required else "Optional"
        return f"{self.class_name} ({req})"


def login_frame_upload_path(instance, filename):
    """Generate org-aware path: login_frames/{org_code}/{filename}"""
    org_code = instance.organization.org_code if instance.organization else 'UNKNOWN'
    return f'login_frames/{org_code}/{filename}'


class LoginDetectionResult(models.Model):
    """
    Records what was detected during each login attempt.
    Links face recognition with object detection results.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='detection_results'
    )
    employee = models.ForeignKey(
        SaaSEmployee,
        on_delete=models.CASCADE,
        related_name='detection_results'
    )
    yolo_model = models.ForeignKey(
        CustomYoloModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='detection_results'
    )
    
    # Detection results
    timestamp = models.DateTimeField(auto_now_add=True)
    face_confidence = models.FloatField(help_text="Face recognition confidence 0-1")
    detections = models.JSONField(default=dict, help_text='{"helmet": true, "vest": false}')
    compliance_passed = models.BooleanField(default=True)
    
    # Optional: store the frame for audit (NOW ORG-AWARE)
    frame_image = models.ImageField(upload_to=login_frame_upload_path, null=True, blank=True)
    
    class Meta:
        db_table = 'login_detection_results'
        ordering = ['-timestamp']
    



# =============================================================================
# Vehicle Compliance & Trip Models
# =============================================================================

class VehicleComplianceRecord(models.Model):
    """
    Vehicle image + YOLO detection results for compliance checking.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='vehicle_compliance_records'
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    
    # Vehicle image
    vehicle_image = models.ImageField(upload_to='vehicle_compliance/')
    
    # YOLO detections
    yolo_model = models.ForeignKey(
        CustomYoloModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    detections = models.JSONField(default=dict, help_text='{"hooter": true, "number_plate": true}')
    
    # Compliance result
    compliance_passed = models.BooleanField(default=False)
    compliance_details = models.JSONField(default=dict, help_text='Full compliance check result')
    
    class Meta:
        db_table = 'vehicle_compliance_records'
        ordering = ['-timestamp']
    
    def __str__(self):
        status = "✅" if self.compliance_passed else "❌"
        return f"Vehicle Check {status} - {self.timestamp.strftime('%Y-%m-%d %H:%M')}"


class Trip(models.Model):
    """
    A complete trip cycle: Check-in to Check-out.
    Links driver, helper (optional), and vehicle compliance.
    """
    TRIP_STATUS = [
        ('driver_checked_in', 'Driver Checked In'),
        ('helper_checked_in', 'Helper Checked In'),
        ('helper_skipped', 'Helper Skipped'),
        ('checkin_complete', 'Check-in Complete'),
        ('checkout_started', 'Checkout Started'),
        ('completed', 'Trip Completed'),
        ('incomplete', 'Incomplete'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='trips'
    )
    
    # Route assignment (NEW: city-level hierarchy)
    route = models.ForeignKey(
        Route,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='trips',
        help_text="Assigned garbage collection route"
    )
    
    date = models.DateField(auto_now_add=True)
    
    # People
    driver = models.ForeignKey(
        SaaSEmployee,
        on_delete=models.CASCADE,
        related_name='trips_as_driver'
    )
    helper = models.ForeignKey(
        SaaSEmployee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='trips_as_helper'
    )
    helper_skipped = models.BooleanField(default=False)
    
    # Check-in data
    checkin_time = models.DateTimeField(null=True, blank=True)
    checkin_driver_detection = models.ForeignKey(
        LoginDetectionResult,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='trip_checkin_driver'
    )
    checkin_helper_detection = models.ForeignKey(
        LoginDetectionResult,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='trip_checkin_helper'
    )
    checkin_vehicle = models.ForeignKey(
        VehicleComplianceRecord,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='trip_checkin'
    )
    checkin_compliance_passed = models.BooleanField(default=False)
    
    # Check-out data
    checkout_time = models.DateTimeField(null=True, blank=True)
    checkout_driver_detection = models.ForeignKey(
        LoginDetectionResult,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='trip_checkout_driver'
    )
    checkout_helper_detection = models.ForeignKey(
        LoginDetectionResult,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='trip_checkout_helper'
    )
    checkout_vehicle = models.ForeignKey(
        VehicleComplianceRecord,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='trip_checkout'
    )
    checkout_compliance_passed = models.BooleanField(default=False)
    
    # Overall status
    status = models.CharField(max_length=30, choices=TRIP_STATUS, default='driver_checked_in')
    work_duration = models.DurationField(null=True, blank=True)
    notes = models.TextField(blank=True)
    
    # GPS Location (for verification)
    checkin_latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    checkin_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    checkout_latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    checkout_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'trips'
        ordering = ['-date', '-checkin_time']
    
    def __str__(self):
        helper_str = f" + {self.helper.full_name}" if self.helper else ""
        return f"Trip: {self.driver.full_name}{helper_str} - {self.date}"
    
    def calculate_work_duration(self):
        """Calculate work duration when checkout completes."""
        if self.checkin_time and self.checkout_time:
            self.work_duration = self.checkout_time - self.checkin_time
            self.save()
