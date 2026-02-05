"""Fix database verification_method default value"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # MySQL syntax to alter column default
    try:
        cursor.execute("ALTER TABLE saas_attendance MODIFY COLUMN verification_method VARCHAR(50) DEFAULT '';")
        print("✅ Fixed verification_method column default value!")
    except Exception as e:
        print(f"Error: {e}")
