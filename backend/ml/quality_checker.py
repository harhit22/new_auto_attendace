"""Image quality checking module."""
import logging
from typing import Dict
import numpy as np

logger = logging.getLogger(__name__)


class QualityChecker:
    """Check image quality metrics for face recognition."""
    
    def analyze(self, image: np.ndarray) -> Dict[str, float]:
        """Analyze image quality, returns scores 0-1 for each metric."""
        try:
            blur_score = self._check_blur(image)
            lighting_score = self._check_lighting(image)
            occlusion_score = 0.9  # Placeholder
            
            overall = (blur_score + lighting_score + occlusion_score) / 3
            
            return {
                'blur_score': blur_score,
                'lighting_score': lighting_score,
                'occlusion_score': occlusion_score,
                'overall_score': overall
            }
        except Exception as e:
            logger.error(f"Quality check error: {e}")
            return {'blur_score': 0.5, 'lighting_score': 0.5, 'occlusion_score': 0.5, 'overall_score': 0.5}
    
    def _check_blur(self, image: np.ndarray) -> float:
        """Check for blur using Laplacian variance."""
        try:
            import cv2
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            else:
                gray = image
            variance = cv2.Laplacian(gray, cv2.CV_64F).var()
            # Normalize to 0-1 (higher variance = less blur)
            return min(1.0, variance / 500)
        except Exception:
            return 0.5
    
    def _check_lighting(self, image: np.ndarray) -> float:
        """Check lighting conditions."""
        try:
            if len(image.shape) == 3:
                gray = np.mean(image, axis=2)
            else:
                gray = image
            mean_brightness = np.mean(gray)
            # Ideal brightness around 128
            deviation = abs(mean_brightness - 128) / 128
            return max(0, 1 - deviation)
        except Exception:
            return 0.5
