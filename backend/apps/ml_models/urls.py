"""ML Models app URLs."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers
from core.permissions import IsAdmin
from .models import ModelVersion, TrainingJob


class ModelVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModelVersion
        fields = '__all__'


class TrainingJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingJob
        fields = '__all__'


class ModelVersionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ModelVersion.objects.all()
    serializer_class = ModelVersionSerializer
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get active models by type."""
        lightweight = self.queryset.filter(model_type='lightweight', is_active=True).first()
        heavy = self.queryset.filter(model_type='heavy', is_active=True).first()
        return Response({
            'lightweight': ModelVersionSerializer(lightweight).data if lightweight else None,
            'heavy': ModelVersionSerializer(heavy).data if heavy else None
        })
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def deploy(self, request, pk=None):
        model = self.get_object()
        # Deactivate other models of same type
        ModelVersion.objects.filter(model_type=model.model_type, is_active=True).update(is_active=False)
        model.is_active = True
        model.deployed_at = timezone.now()
        model.save()
        return Response({'message': f'Model {model.version_tag} deployed successfully'})
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def rollback(self, request, pk=None):
        model = self.get_object()
        previous = ModelVersion.objects.filter(
            model_type=model.model_type,
            deployed_at__lt=model.deployed_at
        ).order_by('-deployed_at').first()
        if previous:
            model.is_active = False
            model.save()
            previous.is_active = True
            previous.save()
            return Response({'message': f'Rolled back to {previous.version_tag}'})
        return Response({'error': 'No previous version found'}, status=400)


class TrainingJobViewSet(viewsets.ModelViewSet):
    queryset = TrainingJob.objects.all()
    serializer_class = TrainingJobSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    
    @action(detail=False, methods=['post'])
    def trigger(self, request):
        """Trigger model training."""
        model_type = request.data.get('model_type', 'heavy')
        config = request.data.get('config', {'epochs': 50, 'learning_rate': 0.001})
        job = TrainingJob.objects.create(trigger_type='manual', config=config, status='queued')
        # In production, trigger Celery task here
        return Response({'job_id': str(job.id), 'status': 'queued'}, status=202)


from django.utils import timezone

router = DefaultRouter()
router.register('versions', ModelVersionViewSet, basename='model-version')
router.register('training', TrainingJobViewSet, basename='training-job')

urlpatterns = [path('', include(router.urls))]
