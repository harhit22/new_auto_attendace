"""Sync app URLs."""
import uuid
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework import viewsets, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import SyncQueue


class SyncQueueSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncQueue
        fields = '__all__'


class SyncPushSerializer(serializers.Serializer):
    device_id = serializers.CharField()
    last_sync_at = serializers.DateTimeField(required=False)
    operations = serializers.ListField(child=serializers.DictField())


class SyncViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def push(self, request):
        """Push local changes to server."""
        serializer = SyncPushSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        results = {'processed': 0, 'succeeded': 0, 'failed': 0, 'results': []}
        for op in serializer.validated_data.get('operations', []):
            results['processed'] += 1
            try:
                SyncQueue.objects.create(
                    device_id=serializer.validated_data['device_id'],
                    user=request.user,
                    operation=op.get('operation', 'insert'),
                    table_name=op.get('table', 'unknown'),
                    record_id=op.get('local_id', uuid.uuid4()),
                    payload=op.get('data', {}),
                    status='completed'
                )
                results['succeeded'] += 1
                results['results'].append({'local_id': op.get('local_id'), 'status': 'success'})
            except Exception as e:
                results['failed'] += 1
                results['results'].append({'local_id': op.get('local_id'), 'status': 'failed', 'error': str(e)})
        
        return Response(results)
    
    @action(detail=False, methods=['get'])
    def pull(self, request):
        """Pull server changes to device."""
        last_sync = request.query_params.get('last_sync_at')
        tables = request.query_params.getlist('tables[]', ['users', 'departments'])
        
        changes = {}
        for table in tables:
            changes[table] = []
        
        return Response({
            'sync_timestamp': timezone.now(),
            'changes': changes
        })


router = DefaultRouter()
router.register('', SyncViewSet, basename='sync')
urlpatterns = [path('', include(router.urls))]
