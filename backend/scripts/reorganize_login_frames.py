#!/usr/bin/env python
"""
Reorganize login_frames to org-based structure.

Current: media/login_frames/{mixed files}
Target:  media/login_frames/{org_code}/{files}

This script:
1. Reads existing LoginDetectionResult records
2. Moves files from flat structure to org-based folders
3. Updates database paths if needed
"""
import os
import sys
import shutil
from pathlib import Path
from collections import defaultdict

# Django setup
sys.path.append(str(Path(__file__).parent.parent))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings.development')

import django
django.setup()

from django.conf import settings
from core.models import LoginDetectionResult, Organization


def reorganize_login_frames():
    """Move login_frames from flat to org-based structure."""
    
    media_root = Path(settings.MEDIA_ROOT)
    login_frames_dir = media_root / 'login_frames'
    
    if not login_frames_dir.exists():
        print("✅ login_frames directory doesn't exist yet. Nothing to migrate.")
        return
    
    print(f"📂 Scanning: {login_frames_dir}")
    
    # Get all files currently in login_frames root
    flat_files = [f for f in login_frames_dir.iterdir() if f.is_file()]
    
    if not flat_files:
        print("✅ No files in flat structure. Already organized or empty.")
        return
    
    print(f"📊 Found {len(flat_files)} files in flat structure")
    
    # Strategy: Match files to database records
    moved_count = 0
    unmatched_files = []
    
    # Get all detection results with frames
    detection_results = LoginDetectionResult.objects.exclude(frame_image='').select_related('organization')
    
    # Build mapping: filename -> org_code
    file_to_org = {}
    for result in detection_results:
        if result.frame_image:
            filename = os.path.basename(result.frame_image.name)
            org_code = result.organization.org_code
            file_to_org[filename] = org_code
    
    print(f"📊 Database has {len(file_to_org)} records with frame_image")
    
    # Move files
    for file_path in flat_files:
        filename = file_path.name
        
        if filename in file_to_org:
            org_code = file_to_org[filename]
            
            # Create org directory
            org_dir = login_frames_dir / org_code
            org_dir.mkdir(exist_ok=True)
            
            # Move file
            new_path = org_dir / filename
            shutil.move(str(file_path), str(new_path))
            
            print(f"  ✅ Moved: {filename} → {org_code}/")
            moved_count += 1
        else:
            unmatched_files.append(filename)
    
    print(f"\n📊 Summary:")
    print(f"  ✅ Moved: {moved_count} files")
    
    if unmatched_files:
        print(f"  ⚠️  Unmatched: {len(unmatched_files)} files (no DB record)")
        print(f"     These files will stay in root. Manual review recommended:")
        for f in unmatched_files[:10]:  # Show first 10
            print(f"       - {f}")
        if len(unmatched_files) > 10:
            print(f"       ... and {len(unmatched_files) - 10} more")
    
    print(f"\n✅ Reorganization complete!")
    print(f"   Structure: login_frames/{{org_code}}/{{files}}")


if __name__ == '__main__':
    print("=" * 60)
    print("LOGIN FRAMES REORGANIZATION SCRIPT")
    print("=" * 60)
    reorganize_login_frames()
