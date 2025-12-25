"""
URL configuration for Faces app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FaceImageViewSet, EnrollmentViewSet
from .deepface_views import (
    DeepFaceTrainView, DeepFaceRecognizeView,
    DeepFacePersonsView, DeepFaceExportView
)
from .dataset_views import (
    DatasetSaveView, DatasetListView, DatasetDetailView,
    DatasetTrainView, DatasetImagesView
)

router = DefaultRouter()
router.register('images', FaceImageViewSet, basename='face-image')
router.register('enroll', EnrollmentViewSet, basename='enrollment')

urlpatterns = [
    path('', include(router.urls)),
    # DeepFace Pro endpoints (99% accuracy)
    path('deepface/train/', DeepFaceTrainView.as_view(), name='deepface-train'),
    path('deepface/recognize/', DeepFaceRecognizeView.as_view(), name='deepface-recognize'),
    path('deepface/persons/', DeepFacePersonsView.as_view(), name='deepface-persons'),
    path('deepface/persons/<str:label>/', DeepFacePersonsView.as_view(), name='deepface-person-delete'),
    path('deepface/export/', DeepFaceExportView.as_view(), name='deepface-export'),
    path('deepface/import/', DeepFaceExportView.as_view(), name='deepface-import'),
    # Dataset management (save now, train later)
    path('dataset/', DatasetListView.as_view(), name='dataset-list'),
    path('dataset/save/', DatasetSaveView.as_view(), name='dataset-save'),
    path('dataset/<str:label>/', DatasetDetailView.as_view(), name='dataset-detail'),
    path('dataset/<str:label>/train/', DatasetTrainView.as_view(), name='dataset-train'),
    path('dataset/<str:label>/images/', DatasetImagesView.as_view(), name='dataset-images'),
]


