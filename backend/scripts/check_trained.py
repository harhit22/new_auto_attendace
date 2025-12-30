"""
Check trained employees in database
"""
import os
import sys
import django

# Add backend to path (parent of scripts dir)
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings.development')
django.setup()

from core.models import SaaSEmployee, Organization

print("=" * 50)
print("TRAINED EMPLOYEES CHECK")
print("=" * 50)

orgs = Organization.objects.all()
for org in orgs:
    print(f"\nOrganization: {org.org_code}")
    emps = SaaSEmployee.objects.filter(organization=org)
    print(f"Total employees: {emps.count()}")
    
    trained = emps.filter(face_enrolled=True)
    print(f"Trained employees: {trained.count()}")
    
    for e in trained[:5]:
        light = len(e.light_embeddings or [])
        heavy = len(e.heavy_embeddings or [])
        captured = len(e.captured_embeddings_light or [])
        face = len(e.face_embeddings or [])
        print(f"  {e.employee_id}: face={face}, light={light}, heavy={heavy}, captured_light={captured}, mode={e.training_mode}")
