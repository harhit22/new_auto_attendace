#!/usr/bin/env python
"""
Fix database paths after login_frames reorganization.

Updates LoginDetectionResult.frame_image paths from:
  'login_frames/filename.jpg'
to:
  'login_frames/{org_code}/filename.jpg'
"""
import os
import sys
from pathlib import Path

# Django setup
sys.path.append(str(Path(__file__).parent.parent))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings.development')

import django
django.setup()

from core.models import LoginDetectionResult


def fix_database_paths():
    """Update frame_image paths to include org_code."""
    
    # Get all detection results that have frame_image
    results = LoginDetectionResult.objects.exclude(frame_image='').select_related('organization')
    
    if not results.exists():
        print("✅ No records to update.")
        return
    
    print(f"📊 Found {results.count()} records with frame_image")
    
    updated_count = 0
    already_correct = 0
    
    for result in results:
        old_path = result.frame_image.name
        org_code = result.organization.org_code
        
        # Check if already in org-based format
        if f'login_frames/{org_code}/' in old_path:
            already_correct += 1
            continue
        
        # Extract filename
        filename = os.path.basename(old_path)
        
        # Build new path
        new_path = f'login_frames/{org_code}/{filename}'
        
        # Update
        result.frame_image.name = new_path
        result.save(update_fields=['frame_image'])
        
        print(f"  ✅ Updated: {filename} → {org_code}/")
        updated_count += 1
    
    print(f"\n📊 Summary:")
    print(f"  ✅ Updated: {updated_count} records")
    print(f"  ℹ️  Already correct: {already_correct} records")
    print(f"\n✅ Database paths fixed!")


if __name__ == '__main__':
    print("=" * 60)
    print("FIX DATABASE PATHS FOR LOGIN_FRAMES")
    print("=" * 60)
    fix_database_paths()
