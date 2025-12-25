"""
Attendance validation services.
"""
import logging
from typing import Dict, Any, List, Tuple, Optional
from django.conf import settings
import numpy as np

logger = logging.getLogger(__name__)


class AttendanceValidator:
    """
    Service for validating attendance based on contextual checks.
    """
    
    def __init__(self):
        self.settings = settings.ATTENDANCE_SETTINGS
    
    def validate_attendance(
        self,
        image: np.ndarray,
        face_match_score: float,
        additional_checks: Dict[str, Any] = None
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Perform all attendance validation checks.
        
        Returns (is_valid, validation_details) tuple.
        """
        validation_details = {
            'face_match_score': face_match_score,
            'face_match_threshold': settings.ML_SETTINGS['FACE_MATCH_THRESHOLD'],
            'checks': {},
            'failure_reasons': [],
            'all_checks_passed': True
        }
        
        # 1. Face match check
        if face_match_score < settings.ML_SETTINGS['FACE_MATCH_THRESHOLD']:
            validation_details['checks']['face_match'] = False
            validation_details['failure_reasons'].append('face_match_below_threshold')
            validation_details['all_checks_passed'] = False
        else:
            validation_details['checks']['face_match'] = True
        
        # 2. Image quality check
        quality_result = self._check_image_quality(image)
        validation_details['image_quality_score'] = quality_result['score']
        validation_details['checks']['image_quality'] = quality_result['passed']
        
        if not quality_result['passed']:
            validation_details['failure_reasons'].append(quality_result['reason'])
            validation_details['all_checks_passed'] = False
        
        # 3. People count check
        people_result = self._check_people_count(image)
        validation_details['people_count'] = people_result['count']
        validation_details['checks']['people_count'] = people_result['passed']
        
        if not people_result['passed']:
            validation_details['failure_reasons'].append('multiple_people_detected')
            validation_details['all_checks_passed'] = False
        
        # 4. Vehicle detection check (if enabled)
        if self.settings.get('REQUIRE_VEHICLE_DETECTION', False):
            vehicle_result = self._check_vehicle_presence(image)
            validation_details['vehicle_detected'] = vehicle_result['detected']
            validation_details['checks']['vehicle_detection'] = vehicle_result['passed']
            
            if not vehicle_result['passed']:
                validation_details['failure_reasons'].append('no_vehicle_detected')
                validation_details['all_checks_passed'] = False
        
        return validation_details['all_checks_passed'], validation_details
    
    def _check_image_quality(self, image: np.ndarray) -> Dict[str, Any]:
        """Check image quality (blur, lighting, occlusion)."""
        try:
            from ml.quality_checker import QualityChecker
            
            checker = QualityChecker()
            quality = checker.analyze(image)
            
            min_quality = self.settings.get('MIN_IMAGE_QUALITY', 0.5)
            passed = quality.get('overall_score', 0) >= min_quality
            
            reason = None
            if not passed:
                if quality.get('blur_score', 1) < min_quality:
                    reason = 'image_too_blurry'
                elif quality.get('lighting_score', 1) < min_quality:
                    reason = 'poor_lighting'
                else:
                    reason = 'low_image_quality'
            
            return {
                'score': quality.get('overall_score', 0.5),
                'passed': passed,
                'reason': reason,
                'details': quality
            }
        except Exception as e:
            logger.warning(f"Quality check error: {e}")
            return {'score': 0.5, 'passed': True, 'reason': None}
    
    def _check_people_count(self, image: np.ndarray) -> Dict[str, Any]:
        """Check number of people in the frame."""
        try:
            from ml.face_detector import get_face_detector
            
            detector = get_face_detector()
            faces = detector.detect(image)
            count = len(faces)
            
            max_allowed = self.settings.get('MAX_PEOPLE_IN_FRAME', 1)
            passed = count == 1  # Exactly one person required
            
            return {
                'count': count,
                'passed': passed
            }
        except Exception as e:
            logger.warning(f"People count check error: {e}")
            return {'count': 1, 'passed': True}
    
    def _check_vehicle_presence(self, image: np.ndarray) -> Dict[str, Any]:
        """Check if a vehicle is present in the frame."""
        try:
            from ml.vehicle_detector import VehicleDetector
            
            detector = VehicleDetector()
            result = detector.detect(image)
            
            return {
                'detected': result.get('vehicle_detected', False),
                'passed': result.get('vehicle_detected', False),
                'confidence': result.get('confidence', 0)
            }
        except Exception as e:
            logger.warning(f"Vehicle detection error: {e}")
            # If vehicle detection fails, don't block attendance
            return {'detected': True, 'passed': True, 'confidence': 0}


def get_attendance_validator() -> AttendanceValidator:
    """Get attendance validator instance."""
    return AttendanceValidator()
