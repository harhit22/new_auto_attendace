"""
DeepFace Recognition Service
High-accuracy face recognition using DeepFace/ArcFace (99% accuracy)
"""
import os
import json
import logging
from pathlib import Path
from django.conf import settings
import numpy as np

logger = logging.getLogger(__name__)

# Lazy import DeepFace to avoid loading TensorFlow on every request
_deepface = None

def get_deepface():
    global _deepface
    if _deepface is None:
        from deepface import DeepFace
        _deepface = DeepFace
    return _deepface


class DeepFaceService:
    """
    High-accuracy face recognition service using DeepFace.
    Uses ArcFace model for best accuracy (99.83% on LFW).
    """
    
    MODEL_NAME = "ArcFace"  # Best accuracy: 99.83% on LFW
    DETECTOR_BACKEND = "opencv"  # Fast detection (use 'retinaface' for better accuracy but slower)
    DISTANCE_METRIC = "cosine"
    THRESHOLD = 0.40  # Lower = stricter matching
    
    def __init__(self):
        self.embeddings_dir = Path(settings.BASE_DIR) / 'face_embeddings'
        self.embeddings_dir.mkdir(exist_ok=True)
        self.embeddings_file = self.embeddings_dir / 'embeddings.json'
        self.images_dir = self.embeddings_dir / 'images'
        self.images_dir.mkdir(exist_ok=True)
        self._embeddings_cache = None
    
    def _load_embeddings(self):
        """Load embeddings from JSON file."""
        if self._embeddings_cache is not None:
            return self._embeddings_cache
            
        if self.embeddings_file.exists():
            try:
                with open(self.embeddings_file, 'r') as f:
                    self._embeddings_cache = json.load(f)
            except Exception as e:
                logger.error(f"Error loading embeddings: {e}")
                self._embeddings_cache = {}
        else:
            self._embeddings_cache = {}
        return self._embeddings_cache
    
    def _save_embeddings(self, embeddings):
        """Save embeddings to JSON file."""
        self._embeddings_cache = embeddings
        with open(self.embeddings_file, 'w') as f:
            json.dump(embeddings, f, indent=2)
    
    def get_embedding(self, image_path):
        """
        Generate face embedding using ArcFace.
        Returns 512-dimensional embedding vector.
        """
        DeepFace = get_deepface()
        try:
            embedding = DeepFace.represent(
                img_path=image_path,
                model_name=self.MODEL_NAME,
                detector_backend=self.DETECTOR_BACKEND,
                enforce_detection=True
            )
            if embedding and len(embedding) > 0:
                return embedding[0]['embedding']
            return None
        except Exception as e:
            # Try with skip detection if face detection fails
            logger.warning(f"Face detection failed, trying without detection: {e}")
            try:
                embedding = DeepFace.represent(
                    img_path=image_path,
                    model_name=self.MODEL_NAME,
                    detector_backend="skip",
                    enforce_detection=False
                )
                if embedding and len(embedding) > 0:
                    return embedding[0]['embedding']
            except Exception as e2:
                logger.error(f"Error getting embedding: {e2}")
            return None
    
    def train_person(self, person_id, person_name, images, on_progress=None):
        """
        Train/enroll a person with multiple face images.
        
        Args:
            person_id: Unique identifier
            person_name: Display name
            images: List of image file paths or file objects
            on_progress: Callback function for progress updates
        
        Returns:
            dict with training results
        """
        label = f"{person_id}_{person_name.replace(' ', '_')}"
        embeddings = []
        processed = 0
        total = len(images)
        
        # Create person's image directory
        person_dir = self.images_dir / label
        person_dir.mkdir(exist_ok=True)
        
        for i, image in enumerate(images):
            try:
                # Save image to disk
                if hasattr(image, 'read'):
                    # File object
                    image_path = person_dir / f"face_{i}.jpg"
                    with open(image_path, 'wb') as f:
                        f.write(image.read())
                else:
                    # Already a path
                    image_path = image
                
                # Get embedding
                embedding = self.get_embedding(str(image_path))
                if embedding:
                    embeddings.append(embedding)
                
                processed += 1
                if on_progress:
                    on_progress({
                        'current': processed,
                        'total': total,
                        'embeddings_found': len(embeddings),
                        'message': f'Processing image {processed}/{total}...'
                    })
                    
            except Exception as e:
                logger.error(f"Error processing image {i}: {e}")
                continue
        
        if len(embeddings) == 0:
            raise ValueError("No face embeddings could be extracted from the images")
        
        # Save embeddings
        all_embeddings = self._load_embeddings()
        all_embeddings[label] = {
            'person_id': person_id,
            'person_name': person_name,
            'embeddings': embeddings,
            'count': len(embeddings),
            'model': self.MODEL_NAME,
            'trained_at': str(np.datetime64('now'))
        }
        self._save_embeddings(all_embeddings)
        
        return {
            'label': label,
            'person_id': person_id,
            'person_name': person_name,
            'embeddings_count': len(embeddings),
            'model': self.MODEL_NAME,
            'success': True
        }
    
    def recognize(self, image_path):
        """
        Recognize a face from an image.
        
        Args:
            image_path: Path to image file
            
        Returns:
            dict with recognition results
        """
        all_embeddings = self._load_embeddings()
        
        if not all_embeddings:
            return {
                'matched': False,
                'message': 'No trained faces yet'
            }
        
        try:
            # Get embedding for query image
            query_embedding = self.get_embedding(str(image_path))
            if query_embedding is None:
                return {
                    'matched': False,
                    'message': 'No face detected in image'
                }
            
            query_embedding = np.array(query_embedding)
            
            # Find best match
            best_match = None
            best_distance = float('inf')
            
            for label, data in all_embeddings.items():
                for stored_embedding in data['embeddings']:
                    stored_embedding = np.array(stored_embedding)
                    
                    # Cosine distance
                    distance = 1 - np.dot(query_embedding, stored_embedding) / (
                        np.linalg.norm(query_embedding) * np.linalg.norm(stored_embedding)
                    )
                    
                    if distance < best_distance:
                        best_distance = distance
                        best_match = {
                            'label': label,
                            'person_id': data['person_id'],
                            'person_name': data['person_name'],
                            'distance': float(distance)
                        }
            
            if best_match and best_distance < self.THRESHOLD:
                confidence = max(0, min(100, int((1 - best_distance / self.THRESHOLD) * 100)))
                return {
                    'matched': True,
                    'label': best_match['label'],
                    'person_id': best_match['person_id'],
                    'person_name': best_match['person_name'],
                    'distance': best_match['distance'],
                    'confidence': confidence,
                    'model': self.MODEL_NAME
                }
            else:
                return {
                    'matched': False,
                    'message': 'Face not recognized',
                    'distance': float(best_distance) if best_match else None
                }
                
        except Exception as e:
            logger.error(f"Recognition error: {e}")
            return {
                'matched': False,
                'message': str(e)
            }
    
    def get_trained_persons(self):
        """Get list of all trained persons."""
        all_embeddings = self._load_embeddings()
        return [
            {
                'label': label,
                'person_id': data['person_id'],
                'person_name': data['person_name'],
                'embeddings_count': data['count'],
                'model': data.get('model', 'unknown'),
                'trained_at': data.get('trained_at')
            }
            for label, data in all_embeddings.items()
        ]
    
    def delete_person(self, label):
        """Delete a trained person."""
        all_embeddings = self._load_embeddings()
        if label in all_embeddings:
            del all_embeddings[label]
            self._save_embeddings(all_embeddings)
            
            # Delete images
            person_dir = self.images_dir / label
            if person_dir.exists():
                import shutil
                shutil.rmtree(person_dir)
            
            return True
        return False
    
    def export_embeddings(self):
        """Export all embeddings as JSON."""
        return self._load_embeddings()
    
    def import_embeddings(self, data):
        """Import embeddings from JSON."""
        current = self._load_embeddings()
        current.update(data)
        self._save_embeddings(current)
        return len(data)


# Singleton instance
_service = None

def get_deepface_service():
    global _service
    if _service is None:
        _service = DeepFaceService()
    return _service
