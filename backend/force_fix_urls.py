import os

# Define the path
path = os.path.join('apps', 'attendance', 'urls.py')

# Delete if exists
if os.path.exists(path):
    print(f"Removing {path}...")
    try:
        os.remove(path)
    except Exception as e:
        print(f"Error removing: {e}")

# content
content = """from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrgLoginView, VerifyEmployeeView, GetOrgSettingsView,
    EmployeeLoginView, EmployeeDashboardView,
    CaptureImagesView, ApproveImagesView,
    TrainModelView, TrainingStatusView,
    TestEmployeeModelView, DeleteEmployeeDataView,
    CheckInView, CheckOutView,
    AttendanceRecordViewSet, EmployeeViewSet, OrganizationViewSet,
    EnrollFaceView, EmployeeImagesView,
    UpdateOrgSettingsView, TrainSingleEmployeeView,
    GetEmployeeEmbeddingsView, AutoCheckinView,
    EmployeeFaceCheckinView
)

router = DefaultRouter()
router.register('records', AttendanceRecordViewSet, basename='attendance-records')
router.register('employees', EmployeeViewSet, basename='employees')
router.register('organizations', OrganizationViewSet, basename='organizations')

urlpatterns = [
    path('', include(router.urls)),
    path('login/', OrgLoginView.as_view(), name='org-login'),
    path('verify-employee/', VerifyEmployeeView.as_view(), name='verify-employee'),
    
    # Employee individual login
    path('employee-login/', EmployeeLoginView.as_view(), name='employee-login'),
    path('employee-dashboard/', EmployeeDashboardView.as_view(), name='employee-dashboard'),
    path('employee-face-checkin/', EmployeeFaceCheckinView.as_view(), name='employee-face-checkin'),
    
    # Employee captures images (no waiting)
    path('capture-images/', CaptureImagesView.as_view(), name='capture-images'),
    
    # Admin reviews and trains
    path('approve-images/', ApproveImagesView.as_view(), name='approve-images'),
    path('train-model/', TrainModelView.as_view(), name='train-model'),
    path('train-employee/', TrainSingleEmployeeView.as_view(), name='train-employee'),
    path('training-status/', TrainingStatusView.as_view(), name='training-status'),
    path('employee-images/', EmployeeImagesView.as_view(), name='employee-images'),
    
    # Organization settings
    path('update-settings/', UpdateOrgSettingsView.as_view(), name='update-settings'),
    path('org-settings/', GetOrgSettingsView.as_view(), name='org-settings'),
    
    # Test and delete
    path('test-model/', TestEmployeeModelView.as_view(), name='test-model'),
    path('delete-employee-data/', DeleteEmployeeDataView.as_view(), name='delete-employee-data'),
    
    # Kiosk check-in/out
    path('checkin/', CheckInView.as_view(), name='checkin'),
    path('checkout/', CheckOutView.as_view(), name='checkout'),
    
    # Real-time kiosk (multi-face)
    path('employee-embeddings/', GetEmployeeEmbeddingsView.as_view(), name='employee-embeddings'),
    path('auto-checkin/', AutoCheckinView.as_view(), name='auto-checkin'),
    
    # Legacy
    path('employees/<uuid:employee_id>/enroll-face/', EnrollFaceView.as_view(), name='enroll-face'),
]
"""

# Write with explicit utf-8 encoding
print(f"Writing {len(content)} bytes...")
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"File verified at {path}")

# VERIFY IMMEDIATELLY
with open(path, 'rb') as f:
    data = f.read()
    if b'\x00' in data:
        print("[FAIL] File ON DISK has null bytes!")
        print("First null byte at:", data.find(b'\x00'))
    else:
        print("[SUCCESS] File on disk is CLEAN.")
