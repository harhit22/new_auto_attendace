"""
MiniFAS Anti-Spoofing Service
Lightweight face anti-spoofing using MiniFASNetV2-SE ONNX model.
Trained on 300k samples, validated on CelebA Spoof (70k+) with ~98% accuracy.

Source: https://github.com/suriAI/face-antispoof-onnx
"""
import os
import logging
import numpy as np
import cv2
from pathlib import Path

logger = logging.getLogger(__name__)

# Model settings
MODEL_IMG_SIZE = 128  # Model input size
BBOX_EXPANSION_FACTOR = 1.5  # Expand face bbox by 1.5x for better context
# Threshold: logit_diff >= threshold means REAL
# Clear screens: diff < -4, borderline: -2 to 0, clear real: diff > 0
# Using -2.0 to allow borderline real faces with poor lighting
SPOOF_THRESHOLD = -2.0

# Lazy load ONNX session
_ort_session = None
_input_name = None


def _get_model_path():
    """Get the path to the MiniFAS ONNX model."""
    base_dir = Path(__file__).parent
    return base_dir / "models" / "minifas_antispoof.onnx"


def get_antispoof_session():
    """Lazy load the ONNX inference session."""
    global _ort_session, _input_name
    
    if _ort_session is None:
        try:
            import onnxruntime as ort
            model_path = _get_model_path()
            
            if not model_path.exists():
                logger.error(f"MiniFAS model not found at {model_path}")
                return None, None
            
            # Use CPU provider for compatibility
            _ort_session = ort.InferenceSession(
                str(model_path),
                providers=['CPUExecutionProvider']
            )
            _input_name = _ort_session.get_inputs()[0].name
            logger.info(f"✅ MiniFAS anti-spoofing model loaded: {model_path}")
        except Exception as e:
            logger.error(f"Failed to load MiniFAS model: {e}")
            return None, None
    
    return _ort_session, _input_name


def _preprocess_face(face_crop: np.ndarray) -> np.ndarray:
    """
    Preprocess face crop for model input.
    Resize with letterboxing, normalize to [0,1], convert to CHW.
    """
    new_size = MODEL_IMG_SIZE
    old_size = face_crop.shape[:2]
    
    ratio = float(new_size) / max(old_size)
    scaled_shape = tuple([int(x * ratio) for x in old_size])
    
    # Use appropriate interpolation
    interpolation = cv2.INTER_LANCZOS4 if ratio > 1.0 else cv2.INTER_AREA
    img = cv2.resize(face_crop, (scaled_shape[1], scaled_shape[0]), interpolation=interpolation)
    
    # Letterbox padding
    delta_w = new_size - scaled_shape[1]
    delta_h = new_size - scaled_shape[0]
    top, bottom = delta_h // 2, delta_h - (delta_h // 2)
    left, right = delta_w // 2, delta_w - (delta_w // 2)
    
    img = cv2.copyMakeBorder(img, top, bottom, left, right, cv2.BORDER_REFLECT_101)
    
    # Normalize and convert to CHW format
    img = img.transpose(2, 0, 1).astype(np.float32) / 255.0
    
    return img


def _crop_face_with_expansion(img: np.ndarray, bbox: tuple) -> np.ndarray:
    """
    Extract expanded square face crop from bbox.
    bbox format: (x1, y1, x2, y2)
    """
    original_height, original_width = img.shape[:2]
    x1, y1, x2, y2 = bbox
    
    w = x2 - x1
    h = y2 - y1
    
    if w <= 0 or h <= 0:
        return None
    
    # Make it square and expand
    max_dim = max(w, h)
    center_x = x1 + w / 2
    center_y = y1 + h / 2
    
    crop_size = int(max_dim * BBOX_EXPANSION_FACTOR)
    x = int(center_x - crop_size / 2)
    y = int(center_y - crop_size / 2)
    
    # Compute crop region with bounds checking
    crop_x1 = max(0, x)
    crop_y1 = max(0, y)
    crop_x2 = min(original_width, x + crop_size)
    crop_y2 = min(original_height, y + crop_size)
    
    # Compute padding needed
    top_pad = max(0, -y)
    left_pad = max(0, -x)
    bottom_pad = max(0, (y + crop_size) - original_height)
    right_pad = max(0, (x + crop_size) - original_width)
    
    # Extract crop
    if crop_x2 > crop_x1 and crop_y2 > crop_y1:
        crop = img[crop_y1:crop_y2, crop_x1:crop_x2, :]
    else:
        return None
    
    # Apply reflection padding if needed
    if top_pad > 0 or bottom_pad > 0 or left_pad > 0 or right_pad > 0:
        crop = cv2.copyMakeBorder(
            crop, top_pad, bottom_pad, left_pad, right_pad,
            cv2.BORDER_REFLECT_101
        )
    
    return crop


def check_antispoof(image_path: str, face_bbox: tuple = None) -> dict:
    """
    Check if face is real or spoofed using MiniFAS model.
    
    Args:
        image_path: Path to face image
        face_bbox: Optional (x1, y1, x2, y2) face bounding box. 
                   If None, uses InsightFace for face detection.
    
    Returns:
        dict: {
            'is_live': bool,
            'confidence': float (0-100),
            'status': 'real' or 'spoof',
            'logit_diff': float,
            'reason': str or None
        }
    """
    session, input_name = get_antispoof_session()
    
    if session is None:
        logger.warning("MiniFAS model not available, falling back to allow")
        return {
            'is_live': True,
            'confidence': 50,
            'status': 'unknown',
            'reason': 'Model not loaded'
        }
    
    try:
        # Load image
        img = cv2.imread(image_path)
        if img is None:
            return {
                'is_live': False,
                'confidence': 0,
                'status': 'error',
                'reason': 'Could not load image'
            }
        
        # Detect face if bbox not provided
        if face_bbox is None:
            # Use InsightFace for face detection
            from apps.faces.deepface_service import get_insightface_app
            app = get_insightface_app()
            faces = app.get(img)
            
            if not faces:
                return {
                    'is_live': False,
                    'confidence': 0,
                    'status': 'error',
                    'reason': 'No face detected'
                }
            
            # Use largest face
            face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
            face_bbox = tuple(map(int, face.bbox))
        
        # Crop face with expansion
        face_crop = _crop_face_with_expansion(img, face_bbox)
        if face_crop is None:
            return {
                'is_live': False,
                'confidence': 0,
                'status': 'error',
                'reason': 'Invalid face crop'
            }
        
        # Preprocess for model
        preprocessed = _preprocess_face(face_crop)
        batch_input = np.expand_dims(preprocessed, axis=0)  # Add batch dimension
        
        # Run inference
        logits = session.run(None, {input_name: batch_input})[0][0]
        
        # Parse results (logits: [real_logit, spoof_logit])
        real_logit = float(logits[0])
        spoof_logit = float(logits[1])
        logit_diff = real_logit - spoof_logit
        
        is_real = logit_diff >= SPOOF_THRESHOLD
        confidence = min(100, abs(logit_diff) * 50)  # Scale to 0-100
        
        result = {
            'is_live': is_real,
            'confidence': round(confidence, 1),
            'status': 'real' if is_real else 'spoof',
            'logit_diff': round(logit_diff, 3),
            'real_logit': round(real_logit, 3),
            'spoof_logit': round(spoof_logit, 3),
            'reason': None if is_real else 'Photo/screen detected'
        }
        
        logger.info(f"🔍 AntiSpoof: {result['status']} (diff={logit_diff:.3f}, conf={confidence:.1f}%)")
        return result
        
    except Exception as e:
        logger.error(f"AntiSpoof error: {e}")
        return {
            'is_live': False,
            'confidence': 0,
            'status': 'error',
            'reason': f'AntiSpoof check failed: {str(e)}'
        }
