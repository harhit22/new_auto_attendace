import os
import sys
import shutil
import django

# Setup Django environment
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "attendance_system.settings.development")
django.setup()

from services.vector_db import vector_db
from apps.users.models import Employee
from apps.faces.deepface_service import get_deepface_service

def fix_chroma():
    print("--- FIXING CHROMADB CORRUPTION ---")
    
    # 1. Try to reset via API
    try:
        print("Resetting via API...")
        vector_db.reset_all()
    except Exception as e:
        print(f"API reset warning: {e}")

    # 2. Try to physical delete (if server is stopped, this works better)
    db_path = os.path.join(os.path.dirname(__file__), '..', 'chroma_db')
    if os.path.exists(db_path):
        try:
            print(f"Deleting DB files at {db_path}...")
            shutil.rmtree(db_path)
            print("Deleted successfully.")
        except Exception as e:
            print(f"Could not delete folder (probably locked by running server): {e}")
            print("Recommendation: Stop the server and run this script again if issues persist.")

    # 3. Migrate Data
    print("\n--- MIGRATING DATA ---")
    employees = Employee.objects.all()
    print(f"Found {employees.count()} employees in SQL database.")
    
    success_count = 0
    
    for emp in employees:
        try:
            # Add Heavy
            if emp.face_embeddings:
                vector_db.add_face(
                    org_code=emp.organization.org_code,
                    model_type='heavy',
                    employee_id=str(emp.employee_id),
                    employee_name=emp.full_name,
                    embedding=emp.face_embeddings
                )
                
            # Add Light
            if emp.light_embeddings:
                 vector_db.add_face(
                    org_code=emp.organization.org_code,
                    model_type='light',
                    employee_id=str(emp.employee_id),
                    employee_name=emp.full_name,
                    embedding=emp.light_embeddings
                )
            
            success_count += 1
            if success_count % 10 == 0:
                print(f"Processed {success_count}...")
                
        except Exception as e:
            print(f"Error migrating {emp.employee_id}: {e}")

    print(f"\nDONE! Migrated {success_count} employees.")

if __name__ == '__main__':
    fix_chroma()
