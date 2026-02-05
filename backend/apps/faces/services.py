"""
Face processing services.
"""
import logging
import numpy as np
from typing import List, Tuple, Optional, Dict, Any
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class FaceProcessingService:
    """
    Service for face detection, quality checking, and embedding generation.
    """
    
    def __init__(self):
        self.settings = settings.ML_SETTINGS
        self.face_detector = None
        self.face_recognizer = None
        self._initialize_models()
    
    def _initialize_models(self):
        """Initialize ML models lazily."""
        pass  # Models will be loaded on first use
    
    def detect_faces(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect faces in an image.
        
        Returns list of face detections with bounding boxes and landmarks.
        """
        try:
            # Placeholder for actual face detection
            # Will use MTCNN, BlazeFace, or RetinaFace
            from ml.face_detector import get_face_detector
            
            detector = get_face_detector()
            faces = detector.detect(image)
            
            return faces
        except Exception as e:
            logger.error(f"Face detection error: {e}")
            return []
    
    def check_image_quality(self, image: np.ndarray) -> Dict[str, float]:
        """
        Check image quality metrics.
        
        Returns scores for blur, lighting, and occlusion.
        """
        try:
            from ml.quality_checker import QualityChecker
            
            checker = QualityChecker()
            return checker.analyze(image)
        except Exception as e:
            logger.error(f"Quality check error: {e}")
            return {
                'blur_score': 0.5,
                'lighting_score': 0.5,
                'occlusion_score': 0.5,
                'overall_score': 0.5
            }
    
    def generate_embedding(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        """
        Generate face embedding from aligned face image.
        
        Returns 512-dimensional embedding vector.
        """
        try:
            from ml.face_recognizer import get_face_recognizer
            
            recognizer = get_face_recognizer()
            embedding = recognizer.get_embedding(face_image)
            
            return embedding
        except Exception as e:
            logger.error(f"Embedding generation error: {e}")
            return None
    
    def compare_embeddings(
        self,
        embedding1: np.ndarray,
        embedding2: np.ndarray
    ) -> float:
        """
        Compare two face embeddings using cosine similarity.
        
        Returns similarity score (0-1).
        """
        # Normalize embeddings
        embedding1 = embedding1 / np.linalg.norm(embedding1)
        embedding2 = embedding2 / np.linalg.norm(embedding2)
        
        # Cosine similarity
        similarity = np.dot(embedding1, embedding2)
        
        return float(similarity)
    
    def find_matching_user(
        self,
        embedding: np.ndarray,
        threshold: float = None
    ) -> Tuple[Optional[str], float]:
        """
        Find matching user for a given face embedding.
        
        NOTE: This method is DEPRECATED. Use services.vector_db.find_best_match() instead
        which uses ChromaDB for efficient similarity search.
        
        Returns (user_id, confidence) tuple.
        """
        logger.warning("find_matching_user is deprecated, use vector_db.find_best_match instead")
        
        # Redirect to ChromaDB vector service
        try:
            from services.vector_db import vector_db
            # This would need org_code and model_type which we don't have here
            # Return None to indicate caller should use vector_db directly
            return None, 0.0
        except ImportError:
            return None, 0.0
    
    def process_enrollment_images(
        self,
        user_id: str,
        images: List[np.ndarray]
    ) -> Dict[str, Any]:
        """
        Process multiple images for enrollment.
        
        NOTE: This method is DEPRECATED. Actual enrollment now uses:
        - SaaSEmployee model for storing embeddings
        - ChromaDB (vector_db service) for fast similarity search
        
        Returns enrollment results with accepted/rejected counts.
        """
        logger.warning("process_enrollment_images is deprecated - use CaptureImagesView directly")
        
        results = {
            'processed': 0,
            'accepted': 0,
            'rejected': 0,
            'rejection_reasons': [],
            'embeddings_created': 0
        }
        
        quality_threshold = self.settings['IMAGE_QUALITY_THRESHOLD']
        
        for i, image in enumerate(images):
            results['processed'] += 1
            
            # Detect faces
            faces = self.detect_faces(image)
            
            if len(faces) == 0:
                results['rejected'] += 1
                results['rejection_reasons'].append({
                    'image_index': i,
                    'reason': 'no_face_detected'
                })
                continue
            
            if len(faces) > 1:
                results['rejected'] += 1
                results['rejection_reasons'].append({
                    'image_index': i,
                    'reason': 'multiple_faces_detected'
                })
                continue
            
            # Check quality
            quality = self.check_image_quality(image)
            
            if quality['overall_score'] < quality_threshold:
                results['rejected'] += 1
                reason = 'low_quality'
                if quality.get('blur_score', 1) < quality_threshold:
                    reason = 'blur_detected'
                elif quality.get('lighting_score', 1) < quality_threshold:
                    reason = 'poor_lighting'
                results['rejection_reasons'].append({
                    'image_index': i,
                    'reason': reason
                })
                continue
            
            results['accepted'] += 1
            
            # Generate embedding
            face_region = faces[0].get('aligned_face', image)
            embedding = self.generate_embedding(face_region)
            
            if embedding is not None:
                results['embeddings_created'] += 1
        
        return results


# Singleton instance
_face_service = None


def get_face_service() -> FaceProcessingService:
    """Get or create face processing service singleton."""
    global _face_service
    if _face_service is None:
        _face_service = FaceProcessingService()
    return _face_service
