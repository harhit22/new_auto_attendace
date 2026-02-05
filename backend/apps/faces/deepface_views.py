"""
DeepFace API Views
High-accuracy face recognition endpoints
"""
import os
import tempfile
import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny  # For demo purposes

from .deepface_service import get_deepface_service

logger = logging.getLogger(__name__)


class DeepFaceTrainView(APIView):
    """
    Train/enroll a person using DeepFace (ArcFace model).
    POST /api/v1/faces/deepface/train/
    """
    parser_classes = [MultiPartParser]
    permission_classes = [AllowAny]  # Allow without auth for demo
    
    def post(self, request):
        person_id = request.data.get('person_id')
        person_name = request.data.get('person_name')
        images = request.FILES.getlist('images')
        
        if not person_id or not person_name:
            return Response(
                {'error': 'person_id and person_name are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(images) < 3:
            return Response(
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            service = get_deepface_service()
            
            # Save images to temp files for processing
            temp_paths = []
            for img in images:
                with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as f:
                    for chunk in img.chunks():
                        f.write(chunk)
                    temp_paths.append(f.name)
            
            # Train (now returns both all_ and active_embeddings)
            result = service.train_person(
                person_id=person_id,
                person_name=person_name,
                images=temp_paths
            )
            
            # Cleanup temp files
            for path in temp_paths:
                try:
                    os.unlink(path)
                except:
                    pass
            
            # 🔹 NEW: Save both embedding sets to database
            try:
                from core.models import SaaSEmployee
                from django.utils import timezone
                
                employee = SaaSEmployee.objects.get(employee_id=person_id)
                
                # Archive: All embeddings (200)
                employee.captured_embeddings = result['all_embeddings']
                
                # Active: Best 7 embeddings
                employee.heavy_embeddings = result['active_embeddings']
                
                # Update training status
                employee.heavy_trained = True
                employee.heavy_trained_at = timezone.now()
                employee.image_count = result['all_count']
                employee.image_status = 'trained'
                employee.face_enrolled = True
                
                employee.save()
                
                logger.info(f"Saved {result['all_count']} archive + {result['active_count']} active embeddings for {person_id}")
                
            except SaaSEmployee.DoesNotExist:
                logger.warning(f"Employee {person_id} not found in database, embeddings saved to file only")
            
            return Response({
                'success': True,
                'person_id': person_id,
                'person_name': person_name,
                'archived_embeddings': result['all_count'],
                'active_embeddings': result['active_count'],
                'model': result['model'],
                'message': f'Enrolled with {result["active_count"]} active embeddings (from {result["all_count"]} total)'
            })
            
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"DeepFace training error: {e}")
            return Response(
                {'error': f'Training failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DeepFaceRecognizeView(APIView):
    """
    Recognize a face using DeepFace (ArcFace model).
    POST /api/v1/faces/deepface/recognize/
    """
    parser_classes = [MultiPartParser]
    permission_classes = [AllowAny]
    
    def post(self, request):
        image = request.FILES.get('image')
        
        if not image:
            return Response(
                {'error': 'image is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            service = get_deepface_service()
            
            # Save to temp file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as f:
                for chunk in image.chunks():
                    f.write(chunk)
                temp_path = f.name
            
            # Recognize
            result = service.recognize(temp_path)
            
            # Cleanup
            try:
                os.unlink(temp_path)
            except:
                pass
            
            return Response(result)
            
        except Exception as e:
            logger.error(f"DeepFace recognition error: {e}")
            return Response(
                {'error': f'Recognition failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DeepFacePersonsView(APIView):
    """
    List/delete trained persons.
    GET /api/v1/faces/deepface/persons/
    DELETE /api/v1/faces/deepface/persons/<label>/
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        service = get_deepface_service()
        persons = service.get_trained_persons()
        return Response({
            'count': len(persons),
            'persons': persons,
            'model': 'ArcFace (99% accuracy)'
        })
    
    def delete(self, request, label=None):
        if not label:
            return Response(
                {'error': 'label is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = get_deepface_service()
        if service.delete_person(label):
            return Response({'message': f'Deleted {label}'})
        else:
            return Response(
                {'error': 'Person not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class DeepFaceExportView(APIView):
    """
    Export/import embeddings.
    GET /api/v1/faces/deepface/export/
    POST /api/v1/faces/deepface/import/
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        service = get_deepface_service()
        embeddings = service.export_embeddings()
        return Response({
            'version': '1.0',
            'model': 'ArcFace',
            'persons': embeddings
        })
    
    def post(self, request):
        data = request.data.get('persons', {})
        if not data:
            return Response(
                {'error': 'No persons data provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = get_deepface_service()
        count = service.import_embeddings(data)
        return Response({
            'message': f'Imported {count} persons',
            'success': True
        })
