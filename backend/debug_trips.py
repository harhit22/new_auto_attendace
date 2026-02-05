import os
import django
import sys

# Fix import path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings.development')
try:
    django.setup()
except Exception as e:
    print(f"Error setting up Django: {e}")
    sys.exit(1)

from core.models import Trip, Ward, Organization

def debug_data():
    print("-" * 50)
    ward_id = "876c8d34-3408-47be-a810-c2680c40f80b"
    
    print(f"Checking data integrity for Ward: {ward_id}")
    try:
        ward = Ward.objects.get(id=ward_id)
        print(f"Ward: '{ward.name}' (Org: {ward.area.organization.name})")
        org = ward.area.organization
    except Ward.DoesNotExist:
        print("Ward NOT FOUND! Cannot proceed comfortably.")
        return

    # 1. Total Trips in DB
    total_trips = Trip.objects.count()
    print(f"\nTotal Trips in Database: {total_trips}")

    # 2. Trips for this Organization
    org_trips = Trip.objects.filter(organization=org).count()
    print(f"Trips for Organization '{org.name}': {org_trips}")

    # 3. Trips with NO Route
    orphaned_trips = Trip.objects.filter(organization=org, route__isnull=True).count()
    print(f"Trips with NO Route assigned: {orphaned_trips}")

    # 4. Trips with Route but Route has NO Ward (unlikely but possible)
    trips_with_route_no_ward = Trip.objects.filter(organization=org, route__isnull=False, route__ward__isnull=True).count()
    print(f"Trips with Route but No Ward: {trips_with_route_no_ward}")

    # 5. List ANY trips for this Org to see what they look like
    if org_trips > 0:
        print("\nSample Trips for this Org:")
        for t in Trip.objects.filter(organization=org).select_related('route', 'route__ward').order_by('-date')[:5]:
            ward_name = t.route.ward.name if t.route and t.route.ward else "None"
            route_name = t.route.name if t.route else "None"
            print(f" - Trip {t.id} | Date: {t.date} | Route: {route_name} | Ward: {ward_name}")

if __name__ == "__main__":
    debug_data()
