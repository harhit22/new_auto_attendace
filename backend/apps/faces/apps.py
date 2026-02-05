"""
Faces app configuration.
"""
from django.apps import AppConfig


class FacesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.faces'
    verbose_name = 'Face Recognition'

    def ready(self):
        import os
        import logging
        from django.conf import settings
        
        logger = logging.getLogger(__name__)
        
        # Prevent double loading in development reloader
        # In production (Gunicorn), this runs once per worker at startup (DESIRED)
        if os.environ.get('RUN_MAIN') == 'true' or not settings.DEBUG:
            logger.info("🔥 Warming up InsightFace model...")
            try:
                from .deepface_service import get_insightface_app
                # This triggers the global load
                get_insightface_app() 
                logger.info("🚀 InsightFace model warmed up and ready!")
            except Exception as e:
                logger.warning(f"⚠️ InsightFace warm-up failed: {e}")
