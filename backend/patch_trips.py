import os
import django
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings.development')
django.setup()

from core.models import Trip, Ward, Route

def patch_trips():
    ward_id = "876c8d34-3408-47be-a810-c2680c40f80b"
    
    # 1. Get the Ward and a valid Route
    try:
        ward = Ward.objects.get(id=ward_id)
        route = Route.objects.filter(ward=ward).first()
        
        if not route:
            print(f"CRITICAL: No routes found for Ward '{ward.name}'. Cannot patch.")
            return

        print(f"Target Ward: {ward.name}")
        print(f"Using Route: {route.name} (ID: {route.id})")
        
        # 2. Find orphaned trips (no route) for today/recent
        orphans = Trip.objects.filter(
            organization=ward.area.organization,
            route__isnull=True
        ).order_by('-date')[:10]
        
        if not orphans:
            print("No orphaned trips found to patch!")
            return

        count = 0
        for trip in orphans:
            trip.route = route
            trip.save()
            count += 1
            print(f" -> Patched Trip {trip.id} with Route '{route.name}'")

        print(f"\nSuccessfully patched {count} trips. Please refresh the dashboard.")

    except Ward.DoesNotExist:
        print("Ward not found.")

if __name__ == "__main__":
    patch_trips()
