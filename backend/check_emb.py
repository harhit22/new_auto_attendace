import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings')
django.setup()

from core.models import SaaSEmployee

e = SaaSEmployee.objects.filter(face_enrolled=True).first()
if e:
    print(f"Name: {e.full_name}")
    print(f"employee_id: {e.employee_id}")
    embs = e.light_embeddings or e.captured_embeddings or []
    print(f"Embeddings count: {len(embs)}")
    if embs:
        print(f"First embedding length: {len(embs[0])}")
else:
    print("No trained employee found")
