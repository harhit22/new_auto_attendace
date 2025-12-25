"""
Dataset Management API Views
Save images now, train later with Lite or Deep model
"""
import os
import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny

from .dataset_service import get_dataset_service

logger = logging.getLogger(__name__)


class DatasetSaveView(APIView):
    """
    Save face images as a dataset for later training.
    POST /api/v1/faces/dataset/save/
    """
    parser_classes = [MultiPartParser]
    permission_classes = [AllowAny]
    
    def post(self, request):
        person_id = request.data.get('person_id')
        person_name = request.data.get('person_name')
        images = request.FILES.getlist('images')
        
        if not person_id or not person_name:
            return Response(
                {'error': 'person_id and person_name are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(images) < 1:
            return Response(
                {'error': 'At least 1 image is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            service = get_dataset_service()
            result = service.save_dataset(person_id, person_name, images)
            return Response(result)
        except Exception as e:
            logger.error(f"Dataset save error: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DatasetListView(APIView):
    """
    List all saved datasets.
    GET /api/v1/faces/dataset/
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        service = get_dataset_service()
        datasets = service.list_datasets()
        return Response({
            'count': len(datasets),
            'datasets': datasets
        })


class DatasetDetailView(APIView):
    """
    Get/delete a specific dataset.
    GET /api/v1/faces/dataset/<label>/
    DELETE /api/v1/faces/dataset/<label>/
    """
    permission_classes = [AllowAny]
    
    def get(self, request, label):
        service = get_dataset_service()
        datasets = service.list_datasets()
        dataset = next((d for d in datasets if d['label'] == label), None)
        
        if not dataset:
            return Response(
                {'error': 'Dataset not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Add preview images
        previews = service.get_dataset_preview(label)
        dataset['previews'] = previews
        
        return Response(dataset)
    
    def delete(self, request, label):
        service = get_dataset_service()
        if service.delete_dataset(label):
            return Response({'message': f'Deleted {label}'})
        return Response(
            {'error': 'Dataset not found'},
            status=status.HTTP_404_NOT_FOUND
        )


class DatasetTrainView(APIView):
    """
    Train a dataset with Lite or Deep model.
    POST /api/v1/faces/dataset/<label>/train/
    """
    permission_classes = [AllowAny]
    
    def post(self, request, label):
        model_type = request.data.get('model', 'deep')  # 'lite' or 'deep'
        
        service = get_dataset_service()
        
        try:
            if model_type == 'lite':
                result = service.train_with_lite(label)
            else:
                result = service.train_with_deep(label)
            
            return Response(result)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Training error: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DatasetImagesView(APIView):
    """
    Get all images from a dataset as base64 for browser training.
    GET /api/v1/faces/dataset/<label>/images/
    """
    permission_classes = [AllowAny]
    
    def get(self, request, label):
        import base64
        
        service = get_dataset_service()
        image_paths = service.get_dataset_images(label)
        
        if not image_paths:
            return Response(
                {'error': 'No images found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        images = []
        for path in image_paths:
            with open(path, 'rb') as f:
                b64 = base64.b64encode(f.read()).decode()
                images.append({
                    'filename': path.name,
                    'data': f"data:image/jpeg;base64,{b64}"
                })
        
        return Response({
            'label': label,
            'count': len(images),
            'images': images
        })
