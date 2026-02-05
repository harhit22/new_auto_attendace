import os
import django
import sys

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings.development')
django.setup()

from apps.users.models import User

def check_admin_user(email):
    print(f"Checking user with email: {email}")
    try:
        user = User.objects.get(email=email)
        print(f"User found: ID={user.id}, Name={user.name}")
        print(f"is_active: {user.is_active}")
        print(f"is_staff: {user.is_staff}")
        print(f"is_superuser: {user.is_superuser}")
        
        if not user.is_active:
            print("WARNING: User is inactive!")
        if not (user.is_staff or user.is_superuser):
            print("WARNING: User is NOT staff/superuser. Login will fail.")
            
        return user
    except User.DoesNotExist:
        print("ERROR: User not found!")
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Listing all Admin/Staff users:")
        admins = User.objects.filter(is_staff=True) | User.objects.filter(is_superuser=True)
        if not admins.exists():
            print("No admin users found!")
        for u in admins:
            print(f"- {u.email} (Name: {u.name}, Superuser: {u.is_superuser}, Active: {u.is_active})")
            
    elif sys.argv[1] == '--reset' and len(sys.argv) >= 4:
        email = sys.argv[2]
        new_pass = sys.argv[3]
        try:
            u = User.objects.get(email=email)
            u.set_password(new_pass)
            u.save()
            print(f"SUCCESS: Password for {email} reset to '{new_pass}'")
        except User.DoesNotExist:
            print(f"ERROR: User {email} not found")
            
    else:
        email = sys.argv[1]
        check_admin_user(email)
