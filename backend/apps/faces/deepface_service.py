"""
DeepFace Recognition Service (Upgraded to InsightFace Engine)
High-accuracy face recognition using InsightFace (ArcFace r100)
"""
import os
import json
import logging
from pathlib import Path
from django.conf import settings
import numpy as np
import cv2

logger = logging.getLogger(__name__)

# Lazy import InsightFace
_insightface_app = None

def get_insightface_app():
    global _insightface_app
    if _insightface_app is None:
        try:
            import insightface
            from insightface.app import FaceAnalysis
            
            # Use 'buffalo_l' model (best accuracy)
            # OPTIMIZED: Only load detection & recognition (Skip gender/age/landmark_2d_106)
            app = FaceAnalysis(
                name='buffalo_l', 
                allowed_modules=['detection', 'recognition'],
                providers=['CPUExecutionProvider']
            )
            app.prepare(ctx_id=0, det_size=(640, 640))
            _insightface_app = app
            logger.info("✅ InsightFace (buffalo_l) loaded successfully!")
        except Exception as e:
            logger.error(f"❌ Failed to load InsightFace: {e}")
            raise e
    return _insightface_app


class DeepFaceService:
    """
    Service wrapper for InsightFace (keeping class name for compatibility).
    Used to be DeepFace, now uses InsightFace/ArcFace (state-of-the-art).
    """
    
    MODEL_NAME = "InsightFace:buffalo_l"
    DISTANCE_METRIC = "cosine"
    THRESHOLD = 0.50  # InsightFace (ArcFace) standard for verification is ~0.5 distance (similarity 0.5)
    
    # Face pose thresholds
    MAX_YAW_ANGLE = 25   # InsightFace is robust, we can allow slightly more angle
    MAX_PITCH_ANGLE = 20
    
    def __init__(self):
        logger.info("DeepFaceService (InsightFace Engine) initialized")
        self.embeddings_dir = Path(settings.BASE_DIR) / 'face_embeddings'
        self.embeddings_dir.mkdir(exist_ok=True)
        self.embeddings_file = self.embeddings_dir / 'embeddings.json'
        # Ensure separate file/collection for InsightFace to avoid mixup? 
        # Actually better to overwrite or use same file but user MUST regenerate.
        self.images_dir = self.embeddings_dir / 'images'
        self.images_dir.mkdir(exist_ok=True)
        self._embeddings_cache = None
        
        # Pre-load model
        try:
            get_insightface_app()
        except:
            pass
            
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

    def check_liveness(self, image_path):
        """
        Server-side liveness detection using MiniFAS ONNX model.
        
        Uses a dedicated anti-spoofing neural network trained on 300k samples
        with ~98% accuracy on CelebA Spoof benchmark.
        
        Returns:
            dict: {
                'is_live': bool,
                'confidence': float (0-100),
                'status': 'real' or 'spoof',
                'reason': str (if failed)
            }
        """
        try:
            from ml.anti_spoof import check_antispoof
            result = check_antispoof(image_path)
            
            # Map to expected format
            return {
                'is_live': result.get('is_live', False),
                'confidence': result.get('confidence', 0),
                'checks': {
                    'logit_diff': result.get('logit_diff', 0),
                    'real_logit': result.get('real_logit', 0),
                    'spoof_logit': result.get('spoof_logit', 0)
                },
                'reason': result.get('reason')
            }
            
        except ImportError as e:
            logger.warning(f"MiniFAS not available: {e}, allowing through")
            return {
                'is_live': True,
                'confidence': 50,
                'checks': {},
                'reason': 'AntiSpoof module not available'
            }
        except Exception as e:
            logger.error(f"Liveness check error: {e}")
            return {
                'is_live': False,
                'confidence': 0,
                'checks': {},
                'reason': f'Liveness check failed: {str(e)}'
            }

    def check_face_pose(self, image_path):
        """
        Check if face is frontal using InsightFace landmarks.
        InsightFace is very robust, but we still want to avoid extreme profiles.
        """
        try:
            app = get_insightface_app()
            img = cv2.imread(image_path)
            if img is None:
                return {'is_frontal': False, 'error': 'Could not load image'}
            
            faces = app.get(img)
            
            if len(faces) == 0:
                return {'is_frontal': False, 'error': 'No face detected'}
            
            # Initial check passed (InsightFace uses high threshold for detection)
            face = faces[0]
            kps = face.kps  # 5 keypoints: left_eye, right_eye, nose, left_mouth, right_mouth
            
            if kps is None or len(kps) < 5:
                return {'is_frontal': True, 'yaw': 0, 'pitch': 0, 'error': None} # If landmarks missing, trust detection
                
            left_eye = kps[0]
            right_eye = kps[1]
            nose = kps[2]
            
            # Simple Yaw Estimation
            # Distances from nose to eyes should be roughly equal
            d_left = np.linalg.norm(nose - left_eye)
            d_right = np.linalg.norm(nose - right_eye)
            
            # If looking straight, ratio is ~1.0
            # If looking left, left eye is closer to nose (ratio < 1)
            # If looking right, right eye is closer (ratio > 1)
            if d_right == 0: d_right = 0.001
            ratio = d_left / d_right
            
            # Rough translation of ratio to degrees (empirical)
            # 1.0 = 0 deg
            # 2.0 = ~45 deg
            # 0.5 = ~-45 deg
            # We want max ~25 deg => ration roughly 0.6 to 1.6
            
            if ratio < 0.6 or ratio > 1.6:
                 return {
                    'is_frontal': False,
                    'yaw': round((ratio-1)*45, 1),
                    'pitch': 0, 
                    'error': 'Face rotated too much. Look straight.'
                 }
            
            # Pitch is harder with just 5 points, but typically detection fails on extreme pitch.
            # We can trust InsightFace detection for pitch mostly.
            
            return {
                'is_frontal': True,
                'yaw': 0,
                'pitch': 0,
                'error': None
            }
            
        except Exception as e:
            logger.warning(f"Pose check warning: {e}")
            return {'is_frontal': True, 'yaw': 0, 'pitch': 0, 'error': None}

    def process_face(self, image_path):
        """
        Optimized single-pass method to get both Pose and Embedding.
        Avoids redundant inference calls.
        """
        try:
            app = get_insightface_app()
            img = cv2.imread(image_path)
            if img is None:
                return {'success': False, 'error': 'Could not load image'}
            
            # Single Inference Call (Expensive)
            faces = app.get(img)
            
            if not faces:
                return {'success': False, 'error': 'No face detected'}
            
            # Largest face (InsightFace usually sorts by size, but let's be sure)
            faces = sorted(faces, key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]), reverse=True)
            face = faces[0]
            
            # 1. Pose Check Logic (consolidated)
            kps = face.kps
            is_frontal = True
            yaw = 0
            pose_error = None
            
            if kps is not None and len(kps) >= 5:
                # Calculate Yaw Ratio
                d_left = np.linalg.norm(kps[2] - kps[0])
                d_right = np.linalg.norm(kps[2] - kps[1])
                if d_right == 0: d_right = 0.001
                ratio = d_left / d_right
                
                # Check thresholds (0.6 to 1.6)
                if ratio < 0.6 or ratio > 1.6:
                    is_frontal = False
                    yaw = round((ratio-1)*45, 1)
                    pose_error = 'Face rotated too much. Look straight.'
            
            pose_result = {
                'is_frontal': is_frontal,
                'yaw': yaw,
                'pitch': 0,
                'error': pose_error
            }
            
            # 2. Embedding Extraction
            embedding = face.embedding
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
                
            return {
                'success': True,
                'pose': pose_result,
                'embedding': embedding.tolist(),
                'facial_area': face.bbox.tolist(), # [x1, y1, x2, y2]
                'image_size': [img.shape[1], img.shape[0]] # [width, height]
            }
            
        except Exception as e:
            logger.error(f"Process face error: {e}")
            return {'success': False, 'error': str(e)}

    def get_embedding(self, image_path):
        """
        Generate embedding using InsightFace.
        Returns 512D normalized vector.
        """
        try:
            app = get_insightface_app()
            img = cv2.imread(image_path)
            if img is None:
                return None
                
            faces = app.get(img)
            if not faces:
                return None
                
            # InsightFace sorts by size (largest first) usually, but let's be sure
            faces = sorted(faces, key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]), reverse=True)
            
            # Embedding is already normalized by InsightFace usually, but let's double check/ensure
            embedding = faces[0].embedding
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
                
            return embedding.tolist()
            
        except Exception as e:
            logger.error(f"InsightFace embedding error: {e}")
            return None

    def get_all_embeddings(self, image_path):
        """Get embeddings for all faces."""
        try:
            app = get_insightface_app()
            img = cv2.imread(image_path)
            if img is None:
                return []
            
            faces = app.get(img)
            results = []
            for face in faces:
                # Normalize
                emb = face.embedding
                n = np.linalg.norm(emb)
                if n > 0:
                    emb = emb / n
                    
                results.append({
                    'embedding': emb.tolist(),
                    'face_confidence': face.det_score,
                    'facial_area': {
                        'x': int(face.bbox[0]),
                        'y': int(face.bbox[1]),
                        'w': int(face.bbox[2]-face.bbox[0]),
                        'h': int(face.bbox[3]-face.bbox[1])
                    }
                })
            return results
        except Exception as e:
            logger.error(f"Get all embeddings error: {e}")
            return []

    def _calculate_quality(self, image_path):
        """Use detection score as quality metric."""
        try:
            app = get_insightface_app()
            img = cv2.imread(image_path)
            if img is None: return 0
            
            faces = app.get(img)
            if faces:
                return float(faces[0].det_score) # Conf score (0.0 - 1.0)
            return 0.0
        except:
            return 0.0

    def train_person(self, person_id, person_name, images, on_progress=None):
        """
        Train/enroll a person with multiple face images.
        """
        label = f"{person_id}_{person_name.replace(' ', '_')}"
        embeddings_with_quality = []
        processed = 0
        total = len(images)
        
        # Create person's image directory
        person_dir = self.images_dir / label
        person_dir.mkdir(exist_ok=True)
        
        for i, image in enumerate(images):
            try:
                # Save image to disk
                if hasattr(image, 'read'):
                    image_path = person_dir / f"face_{i}.jpg"
                    with open(image_path, 'wb') as f:
                        f.write(image.read())
                    path_str = str(image_path)
                else:
                    path_str = str(image)
                
                # Get info (embedding + score)
                app = get_insightface_app()
                img = cv2.imread(path_str)
                if img is None: continue
                
                faces = app.get(img)
                if faces:
                    face = faces[0] # Largest
                    emb = face.embedding
                    n = np.linalg.norm(emb)
                    if n > 0: emb = emb / n
                    
                    embeddings_with_quality.append({
                        'vector': emb.tolist(),
                        'quality_score': float(face.det_score)
                    })
                
                processed += 1
                if on_progress:
                    on_progress({
                        'current': processed,
                        'total': total,
                        'embeddings_found': len(embeddings_with_quality),
                        'message': f'Processing {processed}/{total}...'
                    })
                    
            except Exception as e:
                logger.error(f"Error processing image {i}: {e}")
                continue
        
        if len(embeddings_with_quality) == 0:
            raise ValueError("No faces detected in training images")
        
        # Sort by quality
        embeddings_with_quality.sort(key=lambda x: x['quality_score'], reverse=True)
        
        # Select best N (limit to 10 for InsightFace, it's very consistent)
        best_count = min(10, len(embeddings_with_quality))
        # TODO: Add diversity selection if needed, but quality is king here
        selected = embeddings_with_quality[:best_count]
        
        active_vectors = [e['vector'] for e in selected]
        all_vectors = [e['vector'] for e in embeddings_with_quality]
        
        # Save to cache
        all_embeddings = self._load_embeddings()
        all_embeddings[label] = {
            'person_id': person_id,
            'person_name': person_name,
            'embeddings': active_vectors,
            'count': len(active_vectors),
            'model': self.MODEL_NAME,
            'trained_at': str(np.datetime64('now'))
        }
        self._save_embeddings(all_embeddings)
        
        return {
            'label': label,
            'person_id': person_id,
            'person_name': person_name,
            'active_embeddings': active_vectors,
            'active_count': len(active_vectors),
            'success': True
        }

    # Helper for diversity
    def _select_diverse_embeddings(self, embeddings_with_quality, count=7):
        # Placeholder compatibility
        return embeddings_with_quality[:count]
    
    # Instance accessor
    def get_trained_persons(self):
        # Reuse existing logic
        all_embeddings = self._load_embeddings()
        return [
            {
                'label': label,
                'person_id': data.get('person_id'),
                'person_name': data.get('person_name'),
                'embeddings_count': data.get('count', 0),
                'model': data.get('model', 'unknown'),
                 'trained_at': data.get('trained_at')
            }
            for label, data in all_embeddings.items()
        ]
        
    def delete_person(self, label):
        all_embeddings = self._load_embeddings()
        if label in all_embeddings:
            del all_embeddings[label]
            self._save_embeddings(all_embeddings)
            person_dir = self.images_dir / label
            if person_dir.exists():
                import shutil
                shutil.rmtree(person_dir)
            return True
        return False

# Singleton instance
_service = None

def get_deepface_service():
    global _service
    if _service is None:
        _service = DeepFaceService()
    return _service
