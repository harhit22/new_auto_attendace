"""
Custom exception handling.
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)


class APIException(Exception):
    """Base API exception."""
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail = 'An unexpected error occurred.'
    default_code = 'error'
    
    def __init__(self, detail=None, code=None, status_code=None):
        self.detail = detail or self.default_detail
        self.code = code or self.default_code
        if status_code:
            self.status_code = status_code


class ValidationError(APIException):
    """Validation error."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Invalid input data.'
    default_code = 'validation_error'


class NotFoundError(APIException):
    """Resource not found error."""
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = 'Resource not found.'
    default_code = 'not_found'


class AuthenticationError(APIException):
    """Authentication error."""
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = 'Authentication failed.'
    default_code = 'authentication_error'


class PermissionDeniedError(APIException):
    """Permission denied error."""
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = 'You do not have permission to perform this action.'
    default_code = 'permission_denied'


class FaceNotDetectedError(APIException):
    """Face not detected in image."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'No face detected in the image.'
    default_code = 'face_not_detected'


class FaceMatchFailedError(APIException):
    """Face matching failed."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Face does not match any enrolled employee.'
    default_code = 'face_match_failed'


class AttendanceValidationError(APIException):
    """Attendance validation failed."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Attendance validation failed.'
    default_code = 'attendance_validation_error'


class ImageQualityError(APIException):
    """Image quality too low."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Image quality is too low.'
    default_code = 'image_quality_error'


class ModelNotFoundError(APIException):
    """ML model not found."""
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail = 'ML model not found or not loaded.'
    default_code = 'model_not_found'


class TrainingError(APIException):
    """Model training error."""
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail = 'Model training failed.'
    default_code = 'training_error'


def custom_exception_handler(exc, context):
    """
    Custom exception handler for consistent error responses.
    """
    # Handle our custom exceptions
    if isinstance(exc, APIException):
        logger.warning(
            f"API Exception: {exc.code} - {exc.detail}",
            extra={'context': context}
        )
        return Response(
            {
                'success': False,
                'error': {
                    'code': exc.code,
                    'message': exc.detail,
                }
            },
            status=exc.status_code
        )
    
    # Call REST framework's default exception handler
    response = exception_handler(exc, context)
    
    if response is not None:
        # Standardize the error response format
        error_detail = response.data
        if isinstance(error_detail, dict):
            message = error_detail.get('detail', str(error_detail))
        elif isinstance(error_detail, list):
            message = error_detail[0] if error_detail else 'Unknown error'
        else:
            message = str(error_detail)
        
        response.data = {
            'success': False,
            'error': {
                'code': 'error',
                'message': message,
                'details': error_detail if isinstance(error_detail, dict) else None,
            }
        }
    
    return response
