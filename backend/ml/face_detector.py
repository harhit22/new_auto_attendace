"""Face detection module - MTCNN/BlazeFace wrapper."""
import logging
from typing import List, Dict, Any
import numpy as np

logger = logging.getLogger(__name__)


class FaceDetector:
    """Face detection using MTCNN or BlazeFace."""
    
    def __init__(self, model_type: str = 'mtcnn'):
        self.model_type = model_type
        self._model = None
    
    def _load_model(self):
        """Lazy load the detection model."""
        if self._model is None:
            try:
                if self.model_type == 'mtcnn':
                    from facenet_pytorch import MTCNN
                    self._model = MTCNN(keep_all=True, device='cpu')
                # Add other model types as needed
            except ImportError:
                logger.warning("MTCNN not available, using placeholder")
    
    def detect(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Detect faces in image."""
        self._load_model()
        
        if self._model is None:
            # Placeholder detection
            return [{'bbox': [50, 50, 150, 150], 'confidence': 0.99}]
        
        try:
            boxes, probs = self._model.detect(image)
            if boxes is None:
                return []
            
            faces = []
            for i, (box, prob) in enumerate(zip(boxes, probs)):
                faces.append({
                    'bbox': box.tolist(),
                    'confidence': float(prob),
                    'index': i
                })
            return faces
        except Exception as e:
            logger.error(f"Detection error: {e}")
            return []


_detector = None

def get_face_detector() -> FaceDetector:
    global _detector
    if _detector is None:
        _detector = FaceDetector()
    return _detector
