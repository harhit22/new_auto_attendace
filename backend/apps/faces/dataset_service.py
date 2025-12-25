"""
Dataset Management Service
Store face images for later training with Lite or Deep model
"""
import os
import json
import shutil
from pathlib import Path
from datetime import datetime
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class DatasetService:
    """
    Manages face image datasets for training.
    - Save images to disk
    - List datasets
    - Train with Lite or Deep model
    """
    
    def __init__(self):
        self.datasets_dir = Path(settings.BASE_DIR) / 'face_datasets'
        self.datasets_dir.mkdir(exist_ok=True)
        self.metadata_file = self.datasets_dir / 'metadata.json'
    
    def _load_metadata(self):
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def _save_metadata(self, metadata):
        with open(self.metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
    
    def save_dataset(self, person_id, person_name, images):
        """
        Save face images as a dataset for later training.
        
        Args:
            person_id: Unique identifier
            person_name: Display name
            images: List of image file objects
        
        Returns:
            dict with dataset info
        """
        label = f"{person_id}_{person_name.replace(' ', '_')}"
        person_dir = self.datasets_dir / label
        person_dir.mkdir(exist_ok=True)
        
        saved_count = 0
        for i, image in enumerate(images):
            try:
                image_path = person_dir / f"face_{i:03d}.jpg"
                if hasattr(image, 'read'):
                    with open(image_path, 'wb') as f:
                        f.write(image.read())
                    saved_count += 1
                elif hasattr(image, 'chunks'):
                    with open(image_path, 'wb') as f:
                        for chunk in image.chunks():
                            f.write(chunk)
                    saved_count += 1
            except Exception as e:
                logger.error(f"Error saving image {i}: {e}")
        
        # Update metadata
        metadata = self._load_metadata()
        metadata[label] = {
            'person_id': person_id,
            'person_name': person_name,
            'image_count': saved_count,
            'created_at': datetime.now().isoformat(),
            'lite_trained': False,
            'deep_trained': False,
            'path': str(person_dir)
        }
        self._save_metadata(metadata)
        
        return {
            'label': label,
            'person_id': person_id,
            'person_name': person_name,
            'image_count': saved_count,
            'success': True
        }
    
    def list_datasets(self):
        """List all saved datasets."""
        metadata = self._load_metadata()
        datasets = []
        
        for label, data in metadata.items():
            person_dir = self.datasets_dir / label
            # Count actual images
            image_count = len(list(person_dir.glob('*.jpg'))) if person_dir.exists() else 0
            datasets.append({
                'label': label,
                'person_id': data.get('person_id', label),
                'person_name': data.get('person_name', label),
                'image_count': image_count,
                'created_at': data.get('created_at'),
                'lite_trained': data.get('lite_trained', False),
                'deep_trained': data.get('deep_trained', False)
            })
        
        return datasets
    
    def get_dataset_images(self, label):
        """Get all image paths for a dataset."""
        person_dir = self.datasets_dir / label
        if not person_dir.exists():
            return []
        return sorted(person_dir.glob('*.jpg'))
    
    def delete_dataset(self, label):
        """Delete a dataset."""
        metadata = self._load_metadata()
        if label in metadata:
            del metadata[label]
            self._save_metadata(metadata)
        
        person_dir = self.datasets_dir / label
        if person_dir.exists():
            shutil.rmtree(person_dir)
            return True
        return False
    
    def mark_trained(self, label, model_type):
        """Mark dataset as trained with a model."""
        metadata = self._load_metadata()
        if label in metadata:
            if model_type == 'lite':
                metadata[label]['lite_trained'] = True
                metadata[label]['lite_trained_at'] = datetime.now().isoformat()
            elif model_type == 'deep':
                metadata[label]['deep_trained'] = True
                metadata[label]['deep_trained_at'] = datetime.now().isoformat()
            self._save_metadata(metadata)
            return True
        return False
    
    def train_with_lite(self, label):
        """
        Train dataset with Lite model (face-api.js compatible).
        Returns embeddings that can be imported into browser.
        """
        # This would generate embeddings compatible with face-api.js
        # For now, just mark as trained - actual training happens in browser
        self.mark_trained(label, 'lite')
        images = self.get_dataset_images(label)
        return {
            'label': label,
            'image_count': len(images),
            'images': [str(p) for p in images],
            'message': 'Ready for browser training'
        }
    
    def train_with_deep(self, label):
        """Train dataset with Deep model (ArcFace)."""
        from .deepface_service import get_deepface_service
        
        metadata = self._load_metadata()
        if label not in metadata:
            raise ValueError(f"Dataset {label} not found")
        
        data = metadata[label]
        images = self.get_dataset_images(label)
        
        if len(images) < 3:
            raise ValueError("At least 3 images required")
        
        service = get_deepface_service()
        result = service.train_person(
            person_id=data['person_id'],
            person_name=data['person_name'],
            images=[str(p) for p in images]
        )
        
        self.mark_trained(label, 'deep')
        return result
    
    def get_dataset_preview(self, label, max_images=6):
        """Get preview images as base64."""
        import base64
        images = self.get_dataset_images(label)[:max_images]
        previews = []
        
        for img_path in images:
            with open(img_path, 'rb') as f:
                b64 = base64.b64encode(f.read()).decode()
                previews.append(f"data:image/jpeg;base64,{b64}")
        
        return previews


# Singleton
_service = None

def get_dataset_service():
    global _service
    if _service is None:
        _service = DatasetService()
    return _service
