"""
Middleware for audit logging and request processing.
"""
import json
import logging
import time
import uuid
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class AuditLogMiddleware(MiddlewareMixin):
    """
    Middleware to log all API requests for audit purposes.
    """
    
    SENSITIVE_FIELDS = ['password', 'token', 'secret', 'api_key', 'authorization']
    
    def process_request(self, request):
        """Store request start time and generate request ID."""
        request.start_time = time.time()
        request.request_id = str(uuid.uuid4())
    
    def process_response(self, request, response):
        """Log request details after response."""
        # Skip logging for static files and health checks
        if self._should_skip_logging(request):
            return response
        
        try:
            duration = time.time() - getattr(request, 'start_time', time.time())
            
            log_data = {
                'request_id': getattr(request, 'request_id', 'unknown'),
                'method': request.method,
                'path': request.path,
                'status_code': response.status_code,
                'duration_ms': round(duration * 1000, 2),
                'user_id': str(request.user.id) if request.user.is_authenticated else None,
                'ip_address': self._get_client_ip(request),
                'user_agent': request.META.get('HTTP_USER_AGENT', '')[:200],
            }
            
            # Log at appropriate level based on status code
            if response.status_code >= 500:
                logger.error(f"API Request: {json.dumps(log_data)}")
            elif response.status_code >= 400:
                logger.warning(f"API Request: {json.dumps(log_data)}")
            else:
                logger.info(f"API Request: {json.dumps(log_data)}")
                
        except Exception as e:
            logger.error(f"Error in audit logging: {e}")
        
        return response
    
    def _should_skip_logging(self, request):
        """Check if request should be skipped from logging."""
        skip_paths = ['/static/', '/media/', '/health/', '/favicon.ico']
        return any(request.path.startswith(path) for path in skip_paths)
    
    def _get_client_ip(self, request):
        """Extract client IP from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')
    
    def _sanitize_data(self, data):
        """Remove sensitive fields from data."""
        if not isinstance(data, dict):
            return data
        
        sanitized = {}
        for key, value in data.items():
            if any(field in key.lower() for field in self.SENSITIVE_FIELDS):
                sanitized[key] = '***REDACTED***'
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_data(value)
            else:
                sanitized[key] = value
        return sanitized


class RequestIDMiddleware(MiddlewareMixin):
    """
    Middleware to add request ID to response headers.
    """
    
    def process_response(self, request, response):
        request_id = getattr(request, 'request_id', str(uuid.uuid4()))
        response['X-Request-ID'] = request_id
        return response
