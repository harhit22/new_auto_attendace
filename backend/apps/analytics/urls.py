"""Analytics app - Dashboard views and reporting."""
from datetime import timedelta
from django.urls import path
from django.db.models import Count, Avg, Q
from django.db.models.functions import TruncDate, TruncHour
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from core.models import SaaSAttendance
from apps.ml_models.models import ModelVersion


class DashboardView(APIView):
    """Dashboard analytics endpoint."""
    permission_classes = [AllowAny]  # TODO: Add proper org-based auth
    
    def get(self, request):
        start_date = request.query_params.get('start_date', (timezone.now() - timedelta(days=30)).date())
        end_date = request.query_params.get('end_date', timezone.now().date())
        org_code = request.query_params.get('org_code')
        
        # Base queryset using SaaSAttendance
        attendance_qs = SaaSAttendance.objects.filter(date__gte=start_date, date__lte=end_date)
        if org_code:
            attendance_qs = attendance_qs.filter(organization__org_code=org_code)
        
        # Attendance summary
        total = attendance_qs.count()
        by_status = attendance_qs.values('status').annotate(count=Count('id'))
        status_counts = {item['status']: item['count'] for item in by_status}
        
        # Confidence stats
        confidence_stats = attendance_qs.filter(check_in_confidence__isnull=False).aggregate(
            avg_score=Avg('check_in_confidence')
        )
        
        # Daily trend
        daily_trend = attendance_qs.values('date').annotate(count=Count('id')).order_by('date')
        
        return Response({
            'attendance_summary': {
                'total_check_ins': total,
                'present': status_counts.get('present', 0),
                'late': status_counts.get('late', 0),
                'absent': status_counts.get('absent', 0),
                'attendance_rate': round(status_counts.get('present', 0) / total * 100, 1) if total > 0 else 0
            },
            'face_match_stats': {
                'average_confidence': round(confidence_stats['avg_score'] or 0, 3)
            },
            'trends': {
                'daily_attendance': list(daily_trend)
            }
        })


class ModelPerformanceView(APIView):
    """Model performance analytics."""
    permission_classes = [AllowAny]  # TODO: Add proper org-based auth
    
    def get(self, request):
        # Get active models
        active_heavy = ModelVersion.objects.filter(model_type='heavy', is_active=True).first()
        active_lightweight = ModelVersion.objects.filter(model_type='lightweight', is_active=True).first()
        
        # Inference stats
        return Response({
            'heavy_model': {
                'version': active_heavy.version_tag if active_heavy else None,
                'accuracy': active_heavy.accuracy if active_heavy else None,
                'f1_score': active_heavy.f1_score if active_heavy else None
            } if active_heavy else None,
            'lightweight_model': {
                'version': active_lightweight.version_tag if active_lightweight else None,
                'accuracy': active_lightweight.accuracy if active_lightweight else None
            } if active_lightweight else None,
            'inference_stats': {
                'avg_latency_ms': 45,
                'p95_latency_ms': 120,
                'requests_today': SaaSAttendance.objects.filter(date=timezone.now().date()).count()
            }
        })


urlpatterns = [
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('model-performance/', ModelPerformanceView.as_view(), name='model-performance'),
]
