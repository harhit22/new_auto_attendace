"""
Reset all employee face data and models.
Run this to start fresh.
"""
import os
import sys

# Add backend directory to Python path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, BACKEND_DIR)

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings.development')
django.setup()

from core.models import Organization, SaaSEmployee, SaaSAttendance, LoginDetectionResult


def reset_all_data():
    """Reset all face enrollment and training data."""
    
    print("=" * 60)
    print("RESETTING ALL EMPLOYEE FACE DATA")
    print("=" * 60)
    
    # Reset all employees
    employees = SaaSEmployee.objects.all()
    count = employees.count()
    
    employees.update(
        face_enrolled=False,
        face_embeddings=[],
        captured_embeddings=[],
        captured_embeddings_light=[],
        light_embeddings=[],
        light_trained=False,
        light_trained_at=None,
        light_accuracy=None,
        heavy_embeddings=[],
        heavy_trained=False,
        heavy_trained_at=None,
        heavy_accuracy=None,
        image_count=0,
        image_status='pending',
        training_mode='',
        last_trained_at=None
    )
    
    print(f"✓ Reset {count} employees")
    
    # Delete attendance records
    att_count = SaaSAttendance.objects.count()
    SaaSAttendance.objects.all().delete()
    print(f"✓ Deleted {att_count} attendance records")
    
    # Delete detection logs
    det_count = LoginDetectionResult.objects.count()
    LoginDetectionResult.objects.all().delete()
    print(f"✓ Deleted {det_count} detection results")
    
    print("\n" + "=" * 60)
    print("RESET COMPLETE - FRESH START!")
    print("=" * 60)


if __name__ == '__main__':
    reset_all_data()
