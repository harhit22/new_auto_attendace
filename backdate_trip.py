
import os
import sys
from datetime import timedelta
from django.utils import timezone
import datetime

# Setup Django environment
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
sys.path.append(backend_path)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings.development')
import django
django.setup()

from core.models import Trip, SaaSEmployee

def backdate_trip(employee_id):
    print(f"=== BACKDATING ACTIVE TRIP FOR {employee_id} ===")
    
    # Find active trip
    trip = Trip.objects.filter(
        driver__employee_id=employee_id
    ).exclude(status='completed').order_by('-created_at').first()
    
    if not trip:
        print(f"❌ No active trip found for {employee_id}.")
        return

    print(f"Found Trip {trip.id}")
    print(f"Current Date: {trip.date}")
    
    # Move to yesterday
    yesterday = timezone.now() - timedelta(days=1)
    trip.date = yesterday.date()
    trip.created_at = yesterday
    trip.checkin_time = yesterday
    trip.save()
    
    print(f"✅ Trip moved to: {trip.date}")
    print("Now try logging in. The system should IGNORE this trip and let you select a new Route.")

if __name__ == "__main__":
    backdate_trip('001')
