from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrganizationListView, AreaListView, WardListView, RouteListView,
    RootAdminLoginView,
    OrgLoginView, VerifyEmployeeView, GetOrgSettingsView,
    EmployeeLoginView, CheckEmployeeIDView, EmployeeDashboardView,
    CaptureImagesView, 
    TrainModelView, TrainingStatusView,
    TestEmployeeModelView, DeleteEmployeeDataView,
    CheckInView, CheckOutView,
    AttendanceRecordViewSet, EmployeeViewSet, OrganizationViewSet,
    EnrollFaceView, EmployeeImagesView,
    UpdateOrgSettingsView, TrainSingleEmployeeView,
    GetEmployeeEmbeddingsView, AutoCheckinView,
    EmployeeFaceCheckinView,
    DeleteEmployeeImageView, ResetEmployeeEmbeddingsView,
    DeleteAllEmployeeImagesView,
    GetChromaDBEmbeddingsView, DeleteChromaDBEmbeddingView,
    MigrateToInsightFaceView
)
from .approval_views import ApproveEmployeeView
from .trip_views import TripViewSet

router = DefaultRouter()
router.register('records', AttendanceRecordViewSet, basename='attendance-records')
router.register('employees', EmployeeViewSet, basename='employees')
router.register('organizations', OrganizationViewSet, basename='organizations')

# Trip ViewSet manual URL mapping
trip_list = TripViewSet.as_view({'get': 'list'})
trip_retrieve = TripViewSet.as_view({'get': 'retrieve'})
trip_driver_checkin = TripViewSet.as_view({'post': 'driver_checkin'})
trip_active = TripViewSet.as_view({'get': 'active_trip'})
trip_helper_checkin = TripViewSet.as_view({'post': 'helper_checkin'})
trip_skip_helper = TripViewSet.as_view({'post': 'skip_helper'})
trip_vehicle_checkin = TripViewSet.as_view({'post': 'vehicle_checkin'})
trip_driver_checkout = TripViewSet.as_view({'post': 'driver_checkout'})
trip_helper_checkout = TripViewSet.as_view({'post': 'helper_checkout'})
trip_skip_helper_checkout = TripViewSet.as_view({'post': 'skip_helper_checkout'})
trip_vehicle_checkout = TripViewSet.as_view({'post': 'vehicle_checkout'})

urlpatterns = [
    path('', include(router.urls)),
    
    # Trip workflow
    path('trips/', trip_list, name='trip-list'),
    path('trips/<uuid:pk>/', trip_retrieve, name='trip-detail'),
    path('trips/driver-checkin/', trip_driver_checkin, name='trip-driver-checkin'),
    path('trips/active-trip/', trip_active, name='trip-active'),
    path('trips/<uuid:pk>/helper-checkin/', trip_helper_checkin, name='trip-helper-checkin'),
    path('trips/<uuid:pk>/skip-helper/', trip_skip_helper, name='trip-skip-helper'),
    path('trips/<uuid:pk>/vehicle-checkin/', trip_vehicle_checkin, name='trip-vehicle-checkin'),
    path('trips/<uuid:pk>/driver-checkout/', trip_driver_checkout, name='trip-driver-checkout'),
    path('trips/<uuid:pk>/helper-checkout/', trip_helper_checkout, name='trip-helper-checkout'),
    path('trips/<uuid:pk>/skip-helper-checkout/', trip_skip_helper_checkout, name='trip-skip-helper-checkout'),
    path('trips/<uuid:pk>/vehicle-checkout/', trip_vehicle_checkout, name='trip-vehicle-checkout'),
    path('login/', OrgLoginView.as_view(), name='org-login'),
    path('verify-employee/', VerifyEmployeeView.as_view(), name='verify-employee'),
    
    # Public organization list (for employee login selection)
    path('organizations-list/', OrganizationListView.as_view(), name='organizations-list'),
    
    # Root admin login
    path('admin-login/', RootAdminLoginView.as_view(), name='root-admin-login'),
    
    # Hierarchy selection endpoints (for driver login)
    path('areas/', AreaListView.as_view(), name='area-list'),
    path('wards/', WardListView.as_view(), name='ward-list'),
    path('routes/', RouteListView.as_view(), name='route-list'),
    path('check-employee-id/', CheckEmployeeIDView.as_view(), name='check-employee-id'),
    
    # Employee individual login
    path('employee-login/', EmployeeLoginView.as_view(), name='employee-login'),
    path('employee-dashboard/', EmployeeDashboardView.as_view(), name='employee-dashboard'),
    path('employee-face-checkin/', EmployeeFaceCheckinView.as_view(), name='employee-face-checkin'),
    
    # Employee captures images (no waiting)
    path('capture-images/', CaptureImagesView.as_view(), name='capture-images'),
    
    # Admin reviews and trains
    path('approve-images/', ApproveEmployeeView.as_view(), name='approve-images'),
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
    
    # Data management (images + embeddings)
    path('delete-image/', DeleteEmployeeImageView.as_view(), name='delete-image'),
    path('delete-all-images/', DeleteAllEmployeeImagesView.as_view(), name='delete-all-images'),
    path('reset-embeddings/', ResetEmployeeEmbeddingsView.as_view(), name='reset-embeddings'),
    
    # ChromaDB management
    path('chromadb-embeddings/', GetChromaDBEmbeddingsView.as_view(), name='chromadb-embeddings'),
    path('chromadb-embedding/', DeleteChromaDBEmbeddingView.as_view(), name='chromadb-embedding'),
    
    # Migration
    path('migrate-to-insightface/', MigrateToInsightFaceView.as_view(), name='migrate-to-insightface'),
    
    # Kiosk check-in/out
    path('checkin/', CheckInView.as_view(), name='checkin'),
    path('checkout/', CheckOutView.as_view(), name='checkout'),
    
    # Real-time kiosk (multi-face)
    path('employee-embeddings/', GetEmployeeEmbeddingsView.as_view(), name='employee-embeddings'),
    path('auto-checkin/', AutoCheckinView.as_view(), name='auto-checkin'),
    
    # Legacy
    path('employees/<uuid:employee_id>/enroll-face/', EnrollFaceView.as_view(), name='enroll-face'),
]
