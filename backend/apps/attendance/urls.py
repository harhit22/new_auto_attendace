"""
URL configuration for Attendance app - SaaS
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrgLoginView, VerifyEmployeeView,
    EmployeeLoginView, EmployeeDashboardView,
    CaptureImagesView, ApproveImagesView,
    TrainModelView, TrainingStatusView,
    TestEmployeeModelView, DeleteEmployeeDataView,
    CheckInView, CheckOutView,
    AttendanceRecordViewSet, EmployeeViewSet, OrganizationViewSet,
    EnrollFaceView, EmployeeImagesView,
    UpdateOrgSettingsView, TrainSingleEmployeeView
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
    
    # Test and delete
    path('test-model/', TestEmployeeModelView.as_view(), name='test-model'),
    path('delete-employee-data/', DeleteEmployeeDataView.as_view(), name='delete-employee-data'),
    
    # Kiosk check-in/out
    path('checkin/', CheckInView.as_view(), name='checkin'),
    path('checkout/', CheckOutView.as_view(), name='checkout'),
    
    # Legacy
    path('employees/<uuid:employee_id>/enroll-face/', EnrollFaceView.as_view(), name='enroll-face'),
]

