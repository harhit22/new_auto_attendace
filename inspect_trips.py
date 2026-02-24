
import os
import django
import sys

# Setup Django environment
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
sys.path.append(backend_path)
print(f"Added to path: {backend_path}")

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings.development')
django.setup()

from core.models import Trip, SaaSEmployee, Organization
from django.db.models import Count, Q
from django.utils import timezone

def inspect_data():
    print("=== INSPECTING DATA ===")
    
    # 1. Check for Duplicate Employees
    print("\n-- Duplicate Employee IDs --")
    dupes = SaaSEmployee.objects.values('organization', 'employee_id').annotate(count=Count('id')).filter(count__gt=1)
    if not dupes:
        print("No duplicates found.")
    else:
        for d in dupes:
            print(f"Org: {d['organization']}, ID: {d['employee_id']}, Count: {d['count']}")
            
    # 2. Key Employee Inspection (if any)
    # Let's inspect the last 5 trips created
    print("\n-- Last 5 Trips --")
    trips = Trip.objects.all().order_by('-created_at')[:5]
    for t in trips:
        route_code = t.route.code if t.route else 'None'
        print(f"Trip {t.id} | Driver: {t.driver.employee_id} | Status: {t.status} | Date: {t.date} | Route: {route_code}")
        
    # 3. Check specific scenario
    # Find active trips
    print("\n-- Drivers with Multiple Active Trips --")
    active_trips = Trip.objects.exclude(status='completed')
    driver_counts = {}
    for t in active_trips:
        did = t.driver.id
        if did not in driver_counts:
            driver_counts[did] = []
        driver_counts[did].append(t)
        
    found_issue = False
    for did, t_list in driver_counts.items():
        if len(t_list) > 1:
            found_issue = True
            first = t_list[0]
            driver_name = str(first.driver.full_name).encode('utf-8', errors='ignore').decode('utf-8')
            print(f"🚨 Driver {driver_name} ({first.driver.employee_id}) has {len(t_list)} ACTIVE trips!")
            for t in t_list:
                route_code = str(t.route.code if t.route else 'None').encode('utf-8', errors='ignore').decode('utf-8')
                print(f"   - Trip {t.id} Status: {t.status} Date: {t.date} Route: {route_code}")
                
    if not found_issue:
        print("No drivers with multiple active trips found.")

if __name__ == "__main__":
    inspect_data()
