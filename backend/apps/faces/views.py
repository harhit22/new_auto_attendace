"""
Views for Face management.

NOTE: Previous views (FaceImageViewSet, EnrollmentViewSet) have been removed
as part of the cleanup of unused models (FaceImage, FaceEmbedding).

Face enrollment is now handled by apps.attendance.views.CaptureImagesView.
"""
from rest_framework import viewsets
from rest_framework.response import Response

# Empty placeholders if needed, or just nothing.
