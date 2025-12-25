"""Face recognition module - embedding generation and matching."""
import logging
from typing import Optional
import numpy as np

logger = logging.getLogger(__name__)


class FaceRecognizer:
    """Face recognition using ArcFace/FaceNet."""
    
    def __init__(self, model_path: str = None):
        self.model_path = model_path
        self._model = None
    
    def _load_model(self):
        """Lazy load the recognition model."""
        if self._model is None:
            try:
                from facenet_pytorch import InceptionResnetV1
                self._model = InceptionResnetV1(pretrained='vggface2').eval()
            except ImportError:
                logger.warning("FaceNet not available, using placeholder")
    
    def get_embedding(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        """Generate 512-d embedding for aligned face image."""
        self._load_model()
        
        if self._model is None:
            # Placeholder embedding
            return np.random.randn(512).astype(np.float32)
        
        try:
            import torch
            from torchvision import transforms
            
            transform = transforms.Compose([
                transforms.ToPILImage(),
                transforms.Resize((160, 160)),
                transforms.ToTensor(),
                transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
            ])
            
            face_tensor = transform(face_image).unsqueeze(0)
            with torch.no_grad():
                embedding = self._model(face_tensor)
            return embedding.numpy().flatten()
        except Exception as e:
            logger.error(f"Embedding error: {e}")
            return None
    
    def compare(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Compare two embeddings using cosine similarity."""
        emb1_norm = emb1 / np.linalg.norm(emb1)
        emb2_norm = emb2 / np.linalg.norm(emb2)
        return float(np.dot(emb1_norm, emb2_norm))


_recognizer = None

def get_face_recognizer() -> FaceRecognizer:
    global _recognizer
    if _recognizer is None:
        _recognizer = FaceRecognizer()
    return _recognizer
