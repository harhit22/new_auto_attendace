import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image
import os
import logging

logger = logging.getLogger(__name__)

class DeepPixBis(nn.Module):
    def __init__(self, pretrained=True):
        super(DeepPixBis, self).__init__()
        # Use DenseNet161 as backbone
        dense = models.densenet161(pretrained=pretrained)
        features = list(dense.features.children())
        
        # Feature extractor
        self.enc = nn.Sequential(*features)
        
        # Decoder / Heads
        self.dec = nn.Conv2d(2208, 1, kernel_size=1, stride=1, padding=0)
        self.linear = nn.Linear(2208, 2) # Binary classification (Real/Spoof)

    def forward(self, x):
        enc = self.enc(x)
        dec = self.dec(enc)
        out_map = F.sigmoid(dec)
        out_map = F.interpolate(out_map, size=(14, 14), mode='bilinear', align_corners=False)
        
        feat = F.avg_pool2d(enc, kernel_size=7)
        feat = feat.view(feat.size(0), -1)
        out_score = self.linear(feat)
        
        return out_map, out_score

class DeepPixBisService:
    def __init__(self, model_path='ml/models/DeePixBiS.pth'):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = DeepPixBis(pretrained=False)
        
        # Load weights
        if os.path.exists(model_path):
            try:
                state_dict = torch.load(model_path, map_location=self.device)
                self.model.load_state_dict(state_dict)
                logger.info(f"✅ DeepPixBis model loaded from {model_path}")
            except Exception as e:
                logger.error(f"❌ Failed to load DeepPixBis weights: {e}")
        else:
            logger.warning(f"⚠️ DeepPixBis weights not found at {model_path}")

        self.model.to(self.device)
        self.model.eval()
        
        # Preprocessing (Standard for DeepPixBis/DenseNet)
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])


        # RetinaFace for accurate cropping
        from deepface import DeepFace
        self.detector_backend = 'retinaface'

    def check_liveness(self, image_path):
        """
        Returns:
            {'is_live': bool, 'score': float, 'reason': str}
        """
        try:
            # 1. Detect and Crop Face using DeepFace (RetinaFace)
            # We use extract_faces to get the aligned/cropped face
            try:
                from deepface import DeepFace
                face_objs = DeepFace.extract_faces(
                    img_path=image_path,
                    detector_backend=self.detector_backend,
                    enforce_detection=True,
                    align=False
                )
                
                # Take the first/largest face
                if not face_objs:
                    return {'is_live': False, 'score': 0, 'reason': 'No face detected'}
                
                # face_objs[0]['face'] is a normalized numpy array (0..1)
                # We need to convert it back to PIL Image (0..255)
                face_arr = face_objs[0]['face'] * 255
                img = Image.fromarray(face_arr.astype('uint8')).convert('RGB')
                
            except Exception as e:
                logger.warning(f"Face detection failed in liveness check: {e}")
                # Fallback: Use full image if detection fails
                img = Image.open(image_path).convert('RGB')

            # 2. Run DeepPixBis Inference on Cropped Face
            img_tensor = self.transform(img).unsqueeze(0).to(self.device)
            
            with torch.no_grad():
                _, out_score = self.model(img_tensor)
                prob = F.softmax(out_score, dim=1)
                live_score = prob[0][1].item() # Probability of class 1 (Live)
            
            # Threshold: usually 0.5, but can be tuned
            is_live = live_score > 0.5
            
            return {
                'is_live': is_live,
                'score': live_score,
                'reason': 'Real face' if is_live else 'Spoof detected (Texture/Pixel mismatch)'
            }
            
        except Exception as e:
            logger.error(f"DeepPixBis Check Failed: {e}")
            return {'is_live': False, 'score': 0, 'reason': f"Error: {str(e)}"}

# Singleton instance
_service = None

def get_antispoof_service():
    global _service
    if _service is None:
        model_path = os.path.join(os.path.dirname(__file__), 'models/DeePixBiS.pth')
        _service = DeepPixBisService(model_path)
    return _service
