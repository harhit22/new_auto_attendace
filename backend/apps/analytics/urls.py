"""Analytics app - Dashboard views and reporting."""
from datetime import timedelta
from django.urls import path
from django.db.models import Count, Avg, Q
from django.db.models.functions import TruncDate, TruncHour
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsManager
from apps.attendance.models import AttendanceRecord
from apps.users.models import User
from apps.ml_models.models import ModelVersion


class DashboardView(APIView):
    """Dashboard analytics endpoint."""
    permission_classes = [IsAuthenticated, IsManager]
    
    def get(self, request):
        start_date = request.query_params.get('start_date', (timezone.now() - timedelta(days=30)).date())
        end_date = request.query_params.get('end_date', timezone.now().date())
        department_id = request.query_params.get('department_id')
        
        # Base queryset
        attendance_qs = AttendanceRecord.objects.filter(check_in_time__date__gte=start_date, check_in_time__date__lte=end_date)
        if department_id:
            attendance_qs = attendance_qs.filter(user__department_id=department_id)
        if request.user.role == 'manager':
            attendance_qs = attendance_qs.filter(user__department=request.user.department)
        
        # Attendance summary
        total = attendance_qs.count()
        by_status = attendance_qs.values('status').annotate(count=Count('id'))
        status_counts = {item['status']: item['count'] for item in by_status}
        
        # Face match stats
        face_stats = attendance_qs.filter(face_match_score__isnull=False).aggregate(avg_score=Avg('face_match_score'))
        
        # Daily trend
        daily_trend = attendance_qs.annotate(date=TruncDate('check_in_time')).values('date').annotate(count=Count('id')).order_by('date')
        
        return Response({
            'attendance_summary': {
                'total_check_ins': total,
                'approved': status_counts.get('approved', 0),
                'rejected': status_counts.get('rejected', 0),
                'pending': status_counts.get('pending', 0),
                'approval_rate': round(status_counts.get('approved', 0) / total * 100, 1) if total > 0 else 0
            },
            'face_match_stats': {
                'average_score': round(face_stats['avg_score'] or 0, 3)
            },
            'trends': {
                'daily_attendance': list(daily_trend)
            }
        })


class ModelPerformanceView(APIView):
    """Model performance analytics."""
    permission_classes = [IsAuthenticated, IsManager]
    
    def get(self, request):
        # Get active models
        active_heavy = ModelVersion.objects.filter(model_type='heavy', is_active=True).first()
        active_lightweight = ModelVersion.objects.filter(model_type='lightweight', is_active=True).first()
        
        # Inference stats (would come from monitoring in production)
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
                'requests_today': AttendanceRecord.objects.filter(check_in_time__date=timezone.now().date()).count()
            }
        })


urlpatterns = [
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('model-performance/', ModelPerformanceView.as_view(), name='model-performance'),
]
