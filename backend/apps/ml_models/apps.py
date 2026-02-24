from django.apps import AppConfig

class MlModelsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.ml_models'
    verbose_name = 'ML Models'
    def ready(self):
        import os
        import logging
        from django.conf import settings
        
        logger = logging.getLogger(__name__)
        
        # Preload models in production (or when forced)
        if os.environ.get('PRELOAD_MODELS') == '1' or (os.environ.get('RUN_MAIN') == 'true' and not settings.DEBUG):
            logger.info("🔥 Warming up ML models (PaddleOCR + YOLO)...")
            try:
                # 1. Warm up PaddleOCR
                from ml.plate_ocr import get_paddle_reader
                get_paddle_reader()
                logger.info("✅ PaddleOCR warmed up!")
                
                # 2. Warm up YOLO (Default Model)
                yolo_service = get_yolo_service()
                yolo_service.ensure_default_model()
                logger.info("✅ YOLO (Default) warmed up!")
                
                # 3. Warm up Anti-Spoofing Model (Medium)
                yolo_service.load_model('yolov8m.pt', 'spoof_check')
                logger.info("✅ YOLO (Anti-Spoof) warmed up!")
                
            except Exception as e:
                logger.warning(f"⚠️ ML Model warm-up failed: {e}")
