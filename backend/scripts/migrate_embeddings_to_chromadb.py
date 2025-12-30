"""
Migration script to copy existing embeddings from MySQL to ChromaDB.
Run once after setting up ChromaDB integration.

Usage: 
  cd backend
  .\venv\Scripts\activate
  python scripts/migrate_embeddings_to_chromadb.py
"""
import os
import sys

# Add backend directory to Python path BEFORE importing Django
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, BACKEND_DIR)

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings.development')
django.setup()

from core.models import Organization, SaaSEmployee
from services.vector_db import vector_db


def migrate_embeddings():
    """Migrate all existing embeddings from MySQL to ChromaDB."""
    
    print("=" * 60)
    print("MIGRATING EMBEDDINGS FROM MYSQL TO CHROMADB")
    print("=" * 60)
    
    organizations = Organization.objects.filter(is_active=True)
    
    total_migrated = 0
    total_light = 0
    total_heavy = 0
    
    for org in organizations:
        print(f"\n📁 Processing organization: {org.name} ({org.org_code})")
        
        employees = SaaSEmployee.objects.filter(
            organization=org, 
            status='active',
            face_enrolled=True
        )
        
        org_migrated = 0
        
        for emp in employees:
            # Migrate light embeddings (128-dim)
            light_embeddings = emp.light_embeddings or []
            
            # FALLBACK: Check captured_embeddings_light if light_embeddings is empty
            if not light_embeddings and emp.captured_embeddings_light:
                print(f"  ⚠ Found {len(emp.captured_embeddings_light)} captured light embeddings (not trained). Auto-training...")
                light_embeddings = emp.captured_embeddings_light
                
                # Fix the database record while we are at it
                emp.light_embeddings = light_embeddings
                emp.light_trained = True
                emp.light_trained_at = django.utils.timezone.now()
                # Set as active if needed
                if not emp.face_enrolled:
                    emp.face_embeddings = light_embeddings
                    emp.training_mode = 'light'
                    emp.face_enrolled = True
                    emp.image_status = 'trained'
                emp.save()
                print(f"  ✓ Fixed database record for {emp.full_name}")

            if len(light_embeddings) >= 3:
                success = vector_db.add_embeddings(
                    org_code=org.org_code,
                    model_type='light',
                    employee_id=emp.employee_id,
                    embeddings=light_embeddings,
                    employee_name=emp.full_name
                )
                if success:
                    total_light += 1
                    print(f"  ✓ ChromaDB Light: {emp.full_name} ({len(light_embeddings)} embeddings)")
            
            # Migrate heavy embeddings (512-dim)
            heavy_embeddings = emp.heavy_embeddings or []
            if len(heavy_embeddings) >= 3:
                success = vector_db.add_embeddings(
                    org_code=org.org_code,
                    model_type='heavy',
                    employee_id=emp.employee_id,
                    embeddings=heavy_embeddings,
                    employee_name=emp.full_name
                )
                if success:
                    total_heavy += 1
                    print(f"  ✓ Heavy: {emp.full_name} ({len(heavy_embeddings)} embeddings)")
            
            # Also try face_embeddings field (active model)
            if not light_embeddings and not heavy_embeddings:
                active_embeddings = emp.face_embeddings or []
                if len(active_embeddings) >= 3:
                    # Determine if light (128-d) or heavy (512-d)
                    dim = len(active_embeddings[0]) if active_embeddings else 0
                    model_type = 'light' if dim <= 200 else 'heavy'
                    
                    success = vector_db.add_embeddings(
                        org_code=org.org_code,
                        model_type=model_type,
                        employee_id=emp.employee_id,
                        embeddings=active_embeddings,
                        employee_name=emp.full_name
                    )
                    if success:
                        if model_type == 'light':
                            total_light += 1
                        else:
                            total_heavy += 1
                        print(f"  ✓ {model_type.title()}: {emp.full_name} ({len(active_embeddings)} embeddings, {dim}-dim)")
            
            org_migrated += 1
        
        total_migrated += org_migrated
        
        # Print organization stats
        stats = vector_db.get_collection_stats(org.org_code, 'heavy')
        print(f"  📊 {org.org_code}: {stats}")
    
    print("\n" + "=" * 60)
    print("MIGRATION COMPLETE")
    print("=" * 60)
    print(f"Total employees migrated: {total_migrated}")
    print(f"Light model collections: {total_light}")
    print(f"Heavy model collections: {total_heavy}")
    print(f"\nChromaDB storage location: backend/chroma_db/")


if __name__ == '__main__':
    migrate_embeddings()
