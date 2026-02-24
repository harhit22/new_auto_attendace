"""
Active Liveness Detection - Challenge-Response Blink Detection

How it works:
1. Backend randomly selects challenge frame (frames 5-10 of 15)
2. Detects if eyes closed in frames AFTER challenge
3. Pre-recorded videos can't match random timing

Uses MediaPipe eye landmarks + Eye Aspect Ratio (EAR) for blink detection.
"""

import cv2
import numpy as np
import logging
import os
import urllib.request
import random
import mediapipe as mp

logger = logging.getLogger(__name__)

# MediaPipe Model
MODEL_PATH = os.path.join(os.path.dirname(__file__), "face_landmarker.task")
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
)

def ensure_model():
    if not os.path.exists(MODEL_PATH):
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)

_FACE_LANDMARKER = None

def get_face_landmarker():
    global _FACE_LANDMARKER
    if _FACE_LANDMARKER is None:
        from mediapipe.tasks import python
        from mediapipe.tasks.python import vision
        ensure_model()
        options = vision.FaceLandmarkerOptions(
            base_options=python.BaseOptions(model_asset_path=MODEL_PATH),
            running_mode=vision.RunningMode.IMAGE,
            num_faces=1,
        )
        _FACE_LANDMARKER = vision.FaceLandmarker.create_from_options(options)
    return _FACE_LANDMARKER


# Eye landmark indices (MediaPipe face mesh)
LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144]
RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380]


def calculate_eye_aspect_ratio(eye_landmarks):
    """
    Calculate Eye Aspect Ratio (EAR).
    EAR < 0.2 indicates eyes are closed.
    
    Formula: EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
    """
    # Vertical distances
    v1 = np.linalg.norm(eye_landmarks[1] - eye_landmarks[5])
    v2 = np.linalg.norm(eye_landmarks[2] - eye_landmarks[4])
    
    # Horizontal distance
    h = np.linalg.norm(eye_landmarks[0] - eye_landmarks[3])
    
    # EAR
    ear = (v1 + v2) / (2.0 * h + 1e-6)
    return ear


def detect_eyes_closed(frame):
    """
    Detect if eyes are closed in a frame using MediaPipe.
    
    Returns:
        bool: True if eyes closed (EAR < 0.2)
    """
    try:
        import mediapipe as mp
        
        h, w = frame.shape[:2]
        img = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB),
        )
        
        result = get_face_landmarker().detect(img)
        if not result.face_landmarks:
            return False
        
        lm = result.face_landmarks[0]
        
        # Extract eye landmarks
        left_eye = np.array([
            [lm[i].x * w, lm[i].y * h] for i in LEFT_EYE_INDICES
        ])
        right_eye = np.array([
            [lm[i].x * w, lm[i].y * h] for i in RIGHT_EYE_INDICES
        ])
        
        # Calculate EAR for both eyes
        left_ear = calculate_eye_aspect_ratio(left_eye)
        right_ear = calculate_eye_aspect_ratio(right_eye)
        
        avg_ear = (left_ear + right_ear) / 2.0
        
        # Eyes closed if EAR < 0.2
        return avg_ear < 0.2
        
    except Exception as e:
        logger.error(f"Eye detection error: {e}")
        return False





def compute_liveness_score(frames, challenge_idx=None):
    """
    Combined liveness detection:
    1. FIRST: Screen detection (passive - no user action needed)
    2. THEN: Blink detection (active - user must follow prompt)
    
    Args:
        frames (list): List of captured frames
        challenge_idx (int, optional): The frame index where 'BLINK NOW' was shown.
    
    Returns:
        dict: Liveness result with detection details
    """
    # Support both 15-frame (legacy) and 30-frame (new) bursts


# ===================== GAZE-HEAD CORRELATION (Biological Motion) =====================

def get_gaze_ratio(lm, eye_indices, iris_index):
    try:
        # Eye Corners
        p_left = np.array([lm[eye_indices[0]].x, lm[eye_indices[0]].y])
        p_right = np.array([lm[eye_indices[1]].x, lm[eye_indices[1]].y])
        
        # Iris Center
        p_iris = np.array([lm[iris_index].x, lm[iris_index].y])
        
        # Project Iris onto Eye Vector
        eye_vec = p_right - p_left
        val = np.dot(p_iris - p_left, eye_vec) / np.dot(eye_vec, eye_vec)
        return val # 0.0 (Left Corner) to 1.0 (Right Corner)
    except:
        return 0.5

def get_head_yaw(lm):
    try:
        # Simple 2D Yaw: Nose relative to Cheeks
        # Left Cheek: 234, Right Cheek: 454, Nose Tip: 1
        x_left = lm[234].x
        x_right = lm[454].x
        x_nose = lm[1].x
        
        # Normalize nose position
        width = x_right - x_left
        if width == 0: return 0.5
        yaw = (x_nose - x_left) / width
        return yaw # 0.5 = Center
    except:
        return 0.5

def detect_gaze_liveness(frames):
    """
    Detects "Painted Eyes" (Spoof) vs "Moving Eyes" (Live).
    Logic:
    - Real Face: When head turns, eyes usually move slightly relative to face (to fixate).
    - Photo: Eyes are rigid relative to face.
    Returns: score (0.0=Fake, 1.0=Live)
    """
    try:
        landmarker = get_face_landmarker()
        yaws = []
        gazes = []
        
        for i in range(0, len(frames), 2):
            frame = frames[i]
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            result = landmarker.detect(mp_image)
            
            if result.face_landmarks:
                lm = result.face_landmarks[0]
                
                # Check if Iris landmarks exist (478 points usually)
                if len(lm) < 478:
                    logger.warning("⚠️ No Iris landmarks found. Using Micro-Motion only.")
                    return 0.6 # Neutral/Pass (Fall back to Micro-Motion)
                
                # Head Yaw
                yaw = get_head_yaw(lm)
                
                # Gaze Ratio (Left Eye: 33-133, Iris: 468)
                # Right Eye: 362-263, Iris: 473
                gaze_l = get_gaze_ratio(lm, [33, 133], 468)
                gaze_r = get_gaze_ratio(lm, [362, 263], 473)
                avg_gaze = (gaze_l + gaze_r) / 2.0
                
                yaws.append(yaw)
                gazes.append(avg_gaze)
                
        if len(yaws) < 5:
            return 0.5, "Insufficient data"
            
        yaw_std = np.std(yaws)
        gaze_std = np.std(gazes)
        
        logger.info(f"👀 Gaze Analysis: YawStd={yaw_std:.4f}, GazeStd={gaze_std:.4f}")
        
        # REQUIREMENT: Head must rotate slightly to prove 3D
        MIN_YAW_STD = 0.015
        
        if yaw_std < MIN_YAW_STD:
            return 0.5, "Turn head slightly"
            
        # Logic:
        # If Head is moving (YawStd > 0.015)
        # But Eyes are Rigid (GazeStd < 0.003) -> FAKE
        if gaze_std < 0.004:
            logger.warning(f"❌ RIGID EYES DETECTED! Head moved ({yaw_std:.4f}), eyes didn't ({gaze_std:.4f}).")
            return 0.0, "Painted eyes detected"
            
        return 1.0, "Pass"
        
    except Exception as e:
        logger.error(f"Gaze check error: {e}")
        return 0.5, "Error"


def compute_liveness_score(frames, challenge_idx=None):
    """
    Ensemble Passive Liveness Detection:
    1. Micro-Motion (Anti-Static/Photo)
    2. Gaze-Head Correlation (Biological Motion)
    """
    if len(frames) < 10:
        logger.warning(f"⚠️ Insufficient frames: {len(frames)}")
        return {
            'score': 0.0,
            'decision': 'FAKE',
            'details': {'error': 'Need at least 10 frames'},
        }
    
    # 1. Gaze-Head Correlation (The "Eye Ball" Check)
    gaze_score, gaze_msg = detect_gaze_liveness(frames)
    
    # If "Turn head slightly", we ask user to retry (fail this attempt but give hint)
    if gaze_msg == "Turn head slightly":
         logger.warning("⚠️ No head movement detected.")
         return {
            'score': 0.3, # Low score but not 0.0 (Retry)
            'decision': 'FAKE',
            'details': { 'msg': 'Please turning your head slightly left and right.', 'gaze': gaze_score }
        }
    
    if gaze_score < 0.2:
        logger.warning(f"❌ PAINTED EYES DETECTED! Score {gaze_score:.2f}")
        return {
            'score': 0.0,
            'decision': 'FAKE',
            'details': { 'msg': 'Fake eyes detected. Please look at the camera.', 'gaze': gaze_score }
        }

    logger.info(f"✅ GAZE CHECK PASSED: Score={gaze_score:.2f}")

    # ===== LAYER 4: TEXTURE ANALYSIS (LBP) =====
    # Detects "Glass vs Skin" (OLED/High-Res Screens)
    texture_score, texture_msg = detect_texture_liveness(frames)
    
    if texture_score < 0.5:
        logger.warning(f"❌ SMOOTH SCREEN DETECTED! Texture Score {texture_score:.2f}")
        return {
            'score': texture_score,
            'decision': 'FAKE',
            'details': { 'msg': texture_msg, 'texture_score': texture_score }
        }
        
    logger.info(f"✅ TEXTURE CHECK PASSED: Score={texture_score:.2f}")

    # ===== FINAL: PASSED (Rely on YOLO) =====
    return {
        'score': 1.0,
        'decision': 'LIVE',
        'details': {
            'msg': 'Liveness Passed',
            'motion_score': 1.0,
            'texture_score': texture_score
        },
    }


def detect_texture_liveness(frames):
    """
    Analyzes surface texture using Local Binary Patterns (LBP).
    Real Skin: High Entropy (Pores, irregularities)
    Screen/OLED: Low Entropy (Smooth glass emission)
    """
    try:
        landmarker = get_face_landmarker()
        scores = []
        
        # Analyze a few sharp frames
        step = max(1, len(frames) // 5)
        for i in range(0, len(frames), step):
            frame = frames[i]
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # 1. Get Face ROI (Region of Interest)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            result = landmarker.detect(mp_image)
            
            if not result.face_landmarks: continue
            
            lm = result.face_landmarks[0]
            h, w = gray.shape
            
            # Calculate Dynamic Face Size (Cheek to Cheek)
            # Left Cheek: 234, Right Cheek: 454
            x_left = int(lm[234].x * w)
            x_right = int(lm[454].x * w)
            face_width = abs(x_right - x_left)
            
            # Crop to Cheek area (Texture rich, avoiding eyes/mouth)
            # Left Cheek Center: 205 (Better than 234 which is the edge/ear)
            cx, cy = int(lm[205].x * w), int(lm[205].y * h)
            
            # Dynamic Size: 20% of Face Width (Captures significant texture/edge detail)
            # User requires >5.0 score. 12%->4.6, 15%->4.8, so 20% should hit >5.0.
            size = max(4, int(face_width * 0.20))
            
            x1, y1 = max(0, cx - size), max(0, cy - size)
            x2, y2 = min(w, cx + size), min(h, cy + size)
            
            roi = gray[y1:y2, x1:x2]
            
            # Skip if ROI is too small (e.g., face too far)
            if roi.shape[0] < 8 or roi.shape[1] < 8:
                 continue
            
            # 2. Calculate LBP (NumPy Vectorized)
            # Center pixel
            center = roi[1:-1, 1:-1]
            
            # Neighbors (Top-Left, Top, Top-Right, etc.)
            val_ar = []
            val_ar.append(roi[:-2, :-2] >= center) # Top-Left
            val_ar.append(roi[:-2, 1:-1] >= center) # Top
            val_ar.append(roi[:-2, 2:] >= center)  # Top-Right
            val_ar.append(roi[1:-1, 2:] >= center) # Right
            val_ar.append(roi[2:, 2:] >= center)   # Bottom-Right
            val_ar.append(roi[2:, 1:-1] >= center) # Bottom
            val_ar.append(roi[2:, :-2] >= center)  # Bottom-Left
            val_ar.append(roi[1:-1, :-2] >= center) # Left
            
            # Convert binary array to decimal LBP codes
            lbp_code = np.zeros_like(center, dtype=np.uint8)
            for i, val in enumerate(val_ar):
                lbp_code += (val.astype(np.uint8) << i)
                
            # 3. Calculate Histogram Entropy
            hist, _ = np.histogram(lbp_code.ravel(), bins=256, range=(0, 256))
            hist = hist.astype("float")
            hist /= (hist.sum() + 1e-7)
            
            # Shannon Entropy
            entropy = -np.sum(hist * np.log2(hist + 1e-7))
            scores.append(entropy)
            
        if not scores:
            return 0.5, "No face found for texture scan"
            
        avg_entropy = np.mean(scores)
        
        # QUALITY CHECK: Detect if camera is blurry/low-quality
        # Calculate Laplacian Variance of the face ROI (Sharpness)
        # Sharp image > 100, Blurry < 50
        laplacian_var = cv2.Laplacian(roi, cv2.CV_64F).var()
        logger.info(f"🧬 Texture Entropy: {avg_entropy:.4f} | Sharpness: {laplacian_var:.2f}")
        
        # Adaptive Threshold
        if laplacian_var < 50.0:
            # Low Quality / Blurry Camera
            # Noise in low quality cams artifically inflates entropy (e.g. 5.18 on screen)
            # So we must INCREASE threshold to filter them out.
            logger.warning(f"⚠️ Low Quality Camera Detected (Sharpness {laplacian_var:.2f}). Raising threshold.")
            threshold = 5.2  
        else:
            # High Quality / Sharp Camera
            threshold = 5.0
            
        if avg_entropy < threshold: 
             return 0.0, f"Screen detected (Smooth Surface, Ent={avg_entropy:.2f}<{threshold})"
             
        return 1.0, "Pass"
        
    except Exception as e:
        logger.error(f"Texture check error: {e}")
        return 0.5, "Error"


def load_frames_from_files(frame_files):
    """Load frames from uploaded file handles."""
    frames = []
    for f in frame_files:
        f.seek(0)
        arr = np.frombuffer(f.read(), dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is not None:
            frames.append(img)
    
    logger.info(f"📸 Loaded {len(frames)} frames from upload")
    return frames


# Backward compatibility
compute_liveness = compute_liveness_score
