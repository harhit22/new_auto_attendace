"""
YOLO Detection Service
Handles loading and running custom YOLO models uploaded by admins.
"""
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

# Try to import ultralytics (YOLO)
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    logger.warning("Ultralytics YOLO not installed. Run: pip install ultralytics")


class YoloDetectionService:
    """
    Service for running custom YOLO models on images.
    """
    
    def __init__(self):
        self._loaded_models: Dict[str, YOLO] = {}
    
    def load_model(self, model_path: str, model_id: str) -> bool:
        """
        Load a YOLO model from disk.
        
        Args:
            model_path: Path to the .pt model file
            model_id: Unique identifier for caching
            
        Returns:
            True if loaded successfully, False otherwise
        """
        if not YOLO_AVAILABLE:
            logger.error("YOLO not available")
            return False
            
        try:
            if model_id not in self._loaded_models:
                self._loaded_models[model_id] = YOLO(model_path)
                logger.info(f"Loaded YOLO model: {model_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            return False
    
    def get_model_classes(self, model_path: str) -> List[str]:
        """
        Extract the class names from a YOLO model.
        
        Args:
            model_path: Path to the .pt model file
            
        Returns:
            List of class names the model can detect
        """
        if not YOLO_AVAILABLE:
            return []
            
        try:
            model = YOLO(model_path)
            # Get class names from the model
            if hasattr(model, 'names'):
                return list(model.names.values())
            return []
        except Exception as e:
            logger.error(f"Failed to get model classes: {e}")
            return []
    
    def detect(
        self, 
        image_path: str, 
        model_id: str, 
        confidence_threshold: float = 0.5,
        allowed_classes: List[str] = None
    ) -> Dict[str, bool]:
        """
        Run detection on an image.
        
        Args:
            image_path: Path to the image file
            model_id: ID of the loaded model to use
            confidence_threshold: Minimum confidence for detection
            allowed_classes: Optional list of class names to detect. If None, detects all.
            
        Returns:
            Dict mapping class names to whether they were detected
            e.g. {"helmet": True, "vest": False}
        """
        if not YOLO_AVAILABLE:
            return {}
            
        if model_id not in self._loaded_models:
            logger.error(f"Model {model_id} not loaded")
            return {}
            
        try:
            model = self._loaded_models[model_id]
            
            # Get class IDs to filter if allowed_classes is provided
            class_ids = None
            if allowed_classes:
                class_ids = []
                for idx, name in model.names.items():
                    if name.lower() in [c.lower() for c in allowed_classes]:
                        class_ids.append(idx)
                logger.info(f"Filtering to classes: {allowed_classes} -> IDs: {class_ids}")
            
            # Run detection with optional class filtering
            results = model(image_path, verbose=False, classes=class_ids)
            
            # Get detected classes from results
            if allowed_classes:
                detections = {cls: False for cls in allowed_classes}
            else:
                all_classes = list(model.names.values()) if hasattr(model, 'names') else []
                detections = {cls: False for cls in all_classes}
            
            # Mark detected classes as True
            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        conf = float(box.conf[0])
                        if conf >= confidence_threshold:
                            cls_id = int(box.cls[0])
                            cls_name = model.names[cls_id]
                            detections[cls_name] = True
            
            return detections
            
        except Exception as e:
            logger.error(f"Detection failed: {e}")
            return {}
    
    def detect_with_details(
        self, 
        image_path: str, 
        model_id: str, 
        confidence_threshold: float = 0.5,
        allowed_classes: List[str] = None
    ) -> List[Dict]:
        """
        Run detection and return detailed results with bounding boxes.
        
        Args:
            allowed_classes: Optional list of class names to detect. If None, detects all.
        
        Returns:
            List of detections with class, confidence, and bounding box
        """
        if not YOLO_AVAILABLE or model_id not in self._loaded_models:
            return []
            
        try:
            model = self._loaded_models[model_id]
            
            # Get class IDs to filter if allowed_classes is provided
            class_ids = None
            if allowed_classes:
                class_ids = []
                for idx, name in model.names.items():
                    if name.lower() in [c.lower() for c in allowed_classes]:
                        class_ids.append(idx)
            
            # Run detection with optional class filtering
            results = model(image_path, verbose=False, classes=class_ids)
            
            detections = []
            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        conf = float(box.conf[0])
                        if conf >= confidence_threshold:
                            cls_id = int(box.cls[0])
                            cls_name = model.names[cls_id]
                            bbox = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
                            detections.append({
                                'class': cls_name,
                                'confidence': round(conf, 3),
                                'bbox': bbox
                            })
            
            return detections
            
        except Exception as e:
            logger.error(f"Detection failed: {e}")
            return []
    
    def unload_model(self, model_id: str) -> None:
        """Remove a model from cache."""
        if model_id in self._loaded_models:
            del self._loaded_models[model_id]
            logger.info(f"Unloaded YOLO model: {model_id}")


# Singleton instance
_yolo_service: Optional[YoloDetectionService] = None


def get_yolo_service() -> YoloDetectionService:
    """Get the singleton YOLO service instance."""
    global _yolo_service
    if _yolo_service is None:
        _yolo_service = YoloDetectionService()
    return _yolo_service
