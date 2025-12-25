"""
Views for Face management and enrollment.
"""
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser
from django.utils import timezone
from django.conf import settings

from core.permissions import IsAdmin, IsManager, RoleBasedPermission
from core.exceptions import FaceNotDetectedError, ImageQualityError
from apps.users.models import User
from .models import FaceImage, FaceEmbedding, EnrollmentSession
from .serializers import (
    FaceImageSerializer, FaceImageUploadSerializer,
    EnrollmentSessionSerializer, EnrollmentResultSerializer
)
from .services import get_face_service

logger = logging.getLogger(__name__)


class FaceImageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing face images.
    """
    queryset = FaceImage.objects.filter(deleted_at__isnull=True)
    serializer_class = FaceImageSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    parser_classes = [MultiPartParser]
    
    role_permissions = {
        'list': ['admin', 'manager'],
        'retrieve': ['admin', 'manager'],
        'create': ['admin', 'manager'],
        'destroy': ['admin'],
    }
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by user
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Only managers can see their department's images
        if self.request.user.role == 'manager':
            queryset = queryset.filter(user__department=self.request.user.department)
        
        return queryset


class EnrollmentViewSet(viewsets.ViewSet):
    """
    ViewSet for face enrollment.
    """
    permission_classes = [IsAuthenticated, IsManager]
    parser_classes = [MultiPartParser]
    
    @action(detail=False, methods=['post'], url_path='(?P<user_id>[^/.]+)')
    def enroll(self, request, user_id=None):
        """
        Enroll a user by processing their face images.
        
        Expects multipart form data with:
        - images[]: Array of face images (5-10 recommended)
        - metadata: Optional JSON metadata
        """
        try:
            user = User.objects.get(id=user_id, deleted_at__isnull=True)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check permission for manager
        if (request.user.role == 'manager' and 
            user.department_id != request.user.department_id):
            return Response(
                {'error': 'Cannot enroll users from other departments.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Validate input
        serializer = FaceImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        images = serializer.validated_data['images']
        metadata = serializer.validated_data.get('metadata', {})
        
        # Check minimum image count
        min_images = settings.ML_SETTINGS['MIN_FACES_ENROLLMENT']
        if len(images) < min_images:
            return Response(
                {'error': f'Minimum {min_images} images required for enrollment.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create enrollment session
        session = EnrollmentSession.objects.create(
            user=user,
            status='processing',
            device_id=request.data.get('device_id', ''),
            device_model=request.data.get('device_model', '')
        )
        
        try:
            # Process images
            face_service = get_face_service()
            results = {
                'processed': 0,
                'accepted': 0,
                'rejected': 0,
                'rejection_reasons': []
            }
            
            for i, image_file in enumerate(images):
                results['processed'] += 1
                
                # Save face image
                face_image = FaceImage.objects.create(
                    user=user,
                    image=image_file,
                    purpose='enrollment',
                    captured_at=timezone.now(),
                    metadata=metadata
                )
                
                # Process would happen here via Celery task in production
                # For now, mark as accepted
                face_image.is_valid = True
                face_image.face_detected = True
                face_image.face_count = 1
                face_image.quality_score = 0.9  # Placeholder
                face_image.save()
                
                results['accepted'] += 1
            
            # Update session
            session.images_captured = results['processed']
            session.images_accepted = results['accepted']
            session.images_rejected = results['rejected']
            session.rejection_reasons = results['rejection_reasons']
            session.status = 'completed'
            session.completed_at = timezone.now()
            session.save()
            
            # Mark user as enrolled if enough images accepted
            if results['accepted'] >= min_images:
                user.enroll()
            
            return Response({
                'employee_id': str(user.id),
                'images_processed': results['processed'],
                'images_accepted': results['accepted'],
                'images_rejected': results['rejected'],
                'rejection_reasons': results['rejection_reasons'],
                'enrollment_status': 'completed' if user.is_enrolled else 'incomplete',
                'enrolled_at': user.enrolled_at
            })
            
        except Exception as e:
            logger.error(f"Enrollment error: {e}")
            session.status = 'failed'
            session.error_message = str(e)
            session.save()
            
            return Response(
                {'error': 'Enrollment failed. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='sessions')
    def list_sessions(self, request):
        """List enrollment sessions."""
        sessions = EnrollmentSession.objects.all().order_by('-created_at')[:50]
        serializer = EnrollmentSessionSerializer(sessions, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], url_path='(?P<user_id>[^/.]+)/add-faces')
    def add_faces(self, request, user_id=None):
        """Add additional face images to an enrolled user."""
        try:
            user = User.objects.get(id=user_id, deleted_at__isnull=True)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = FaceImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        images = serializer.validated_data['images']
        added_count = 0
        
        for image_file in images:
            FaceImage.objects.create(
                user=user,
                image=image_file,
                purpose='enrollment',
                captured_at=timezone.now(),
                is_valid=True,
                face_detected=True,
                face_count=1,
                quality_score=0.9
            )
            added_count += 1
        
        return Response({
            'added_count': added_count,
            'total_faces': user.face_count,
            'quality_scores': [0.9] * added_count  # Placeholder
        })
    
    @action(detail=False, methods=['delete'], url_path='(?P<user_id>[^/.]+)/faces/(?P<face_id>[^/.]+)')
    def delete_face(self, request, user_id=None, face_id=None):
        """Delete a specific face image."""
        try:
            face_image = FaceImage.objects.get(
                id=face_id,
                user_id=user_id,
                deleted_at__isnull=True
            )
            face_image.delete()  # Soft delete
            
            user = User.objects.get(id=user_id)
            return Response({
                'message': 'Face image deleted successfully',
                'remaining_faces': user.face_count
            })
        except FaceImage.DoesNotExist:
            return Response(
                {'error': 'Face image not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
