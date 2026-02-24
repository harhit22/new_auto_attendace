"""
Image Quality Validation Module

Validates vehicle images for clarity and proper lighting before YOLO processing.
Prevents users from submitting blurry or poorly lit images.
"""
import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)


def check_blur(image: np.ndarray, threshold: float = 50.0) -> dict:
    """
    Detect if image is too blurry using Laplacian variance.
    
    Args:
        image: BGR image as numpy array
        threshold: Minimum variance threshold (default: 100)
    
    Returns:
        dict with 'is_blurry', 'variance', and 'message'
    """
    try:
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Calculate Laplacian variance
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        variance = laplacian.var()
        
        is_blurry = variance < threshold
        
        result = {
            'is_blurry': is_blurry,
            'variance': float(variance),
            'message': f"Image too blurry (score: {variance:.1f}). Please hold steady." if is_blurry else "Image clarity OK"
        }
        
        logger.info(f"Blur check: variance={variance:.2f}, threshold={threshold}, blurry={is_blurry}")
        return result
        
    except Exception as e:
        logger.error(f"Blur detection error: {e}")
        return {
            'is_blurry': False,
            'variance': 0,
            'message': 'Blur check skipped due to error'
        }


def check_brightness(image: np.ndarray, dark_threshold: int = 50, bright_threshold: int = 200) -> dict:
    """
    Detect if image is too dark or too bright.
    
    Args:
        image: BGR image as numpy array
        dark_threshold: Minimum mean brightness (default: 50)
        bright_threshold: Maximum mean brightness (default: 200)
    
    Returns:
        dict with 'is_dark', 'is_bright', 'mean_brightness', and 'message'
    """
    try:
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Calculate mean brightness
        mean_brightness = gray.mean()
        
        is_dark = mean_brightness < dark_threshold
        is_bright = mean_brightness > bright_threshold
        
        if is_dark:
            message = f"Image too dark (brightness: {mean_brightness:.1f}). Please improve lighting."
        elif is_bright:
            message = f"Image too bright (brightness: {mean_brightness:.1f}). Reduce lighting."
        else:
            message = "Image brightness OK"
        
        result = {
            'is_dark': is_dark,
            'is_bright': is_bright,
            'mean_brightness': float(mean_brightness),
            'message': message
        }
        
        logger.info(f"Brightness check: mean={mean_brightness:.2f}, dark_threshold={dark_threshold}, bright_threshold={bright_threshold}")
        return result
        
    except Exception as e:
        logger.error(f"Brightness detection error: {e}")
        return {
            'is_dark': False,
            'is_bright': False,
            'mean_brightness': 0,
            'message': 'Brightness check skipped due to error'
        }


def validate_image_quality(image: np.ndarray, 
                          blur_threshold: float = 50.0,
                          dark_threshold: int = 50,
                          bright_threshold: int = 200) -> dict:
    """
    Comprehensive image quality validation.
    
    Args:
        image: BGR image as numpy array
        blur_threshold: Minimum Laplacian variance
        dark_threshold: Minimum mean brightness
        bright_threshold: Maximum mean brightness
    
    Returns:
        dict with 'passed', 'errors', 'warnings', and detailed metrics
    """
    try:
        blur_result = check_blur(image, blur_threshold)
        brightness_result = check_brightness(image, dark_threshold, bright_threshold)
        
        errors = []
        warnings = []
        
        # Critical failures (block upload)
        if blur_result['is_blurry']:
            errors.append(blur_result['message'])
        
        if brightness_result['is_dark']:
            errors.append(brightness_result['message'])
        
        if brightness_result['is_bright']:
            errors.append(brightness_result['message'])
        
        passed = len(errors) == 0
        
        result = {
            'passed': passed,
            'errors': errors,
            'warnings': warnings,
            'blur': blur_result,
            'brightness': brightness_result,
            'summary': "Image quality OK" if passed else " | ".join(errors)
        }
        
        logger.info(f"Image quality validation: passed={passed}, errors={len(errors)}")
        return result
        
    except Exception as e:
        logger.error(f"Image quality validation error: {e}")
        return {
            'passed': True,  # Fail open to avoid blocking users on errors
            'errors': [],
            'warnings': [f'Quality check error: {str(e)}'],
            'summary': 'Quality check unavailable'
        }
