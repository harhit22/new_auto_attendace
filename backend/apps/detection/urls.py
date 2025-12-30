"""
URL routing for Detection API
"""
from django.urls import path
from . import views

urlpatterns = [
    # YOLO Model Management
    path('yolo-models/upload/', views.YoloModelUploadView.as_view(), name='yolo-upload'),
    path('yolo-models/', views.YoloModelListView.as_view(), name='yolo-list'),
    path('yolo-models/<uuid:model_id>/requirements/', views.YoloRequirementsUpdateView.as_view(), name='yolo-requirements'),
    path('yolo-models/<uuid:model_id>/add-class/', views.YoloAddClassView.as_view(), name='yolo-add-class'),
    
    # Multi-Login with Detection
    path('multi-login/', views.MultiLoginWithDetectionView.as_view(), name='multi-login'),
    
    # Compliance Logs
    path('logs/', views.ComplianceLogsView.as_view(), name='compliance-logs'),
    
    # Live Preview
    path('preview/', views.LivePreviewView.as_view(), name='live-preview'),
]
