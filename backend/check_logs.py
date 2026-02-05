"""Check LoginDetectionResult entries"""
import os
import sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings.development')

import django
django.setup()

from core.models import LoginDetectionResult

logs = LoginDetectionResult.objects.all().order_by('-timestamp')[:10]
print(f"Total LoginDetectionResult entries: {LoginDetectionResult.objects.count()}")
print("\nRecent entries:")
for log in logs:
    emp_id = log.employee.employee_id if log.employee else "N/A"
    img = log.frame_image.name if log.frame_image else "No image"
    print(f"  {log.timestamp} - Employee: {emp_id} - Image: {img}")
