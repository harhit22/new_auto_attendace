import cv2
import numpy as np
import re
import platform
import logging

logger = logging.getLogger(__name__)

def get_paddle_reader():
    """
    Load a fresh PaddleOCR reader instance.
    Designed to work on both local Windows (CPU) and VM (CPU/GPU).
    """
    try:
        logger.info("INFO Loading PaddleOCR reader...")
        from paddleocr import PaddleOCR
        import paddle
        
        # Disable angle classifier on Windows to prevent 'ConvertPirAttribute2RuntimeAttribute' error
        # This is a known issue with PaddleOCR on Windows CPU
        is_windows = platform.system() == 'Windows'
        use_angle = False if is_windows else True
        
        # Check for GPU
        use_gpu = paddle.device.is_compiled_with_cuda()
        
        logger.info(f"INFO PaddleOCR Init: use_angle_cls={use_angle}, use_gpu={use_gpu}, os={platform.system()}")
        
        # Suppress logs
        logging.getLogger('ppocr').setLevel(logging.ERROR)
        
        # Disable MKLDNN globally (Windows & Linux) to prevent SIGSEGV/crashes
        # This is common when mixing PyTorch, Paddle, and ONNXRuntime
        import os
        os.environ['FLAGS_use_mkldnn'] = '0'
        os.environ['OMP_NUM_THREADS'] = '1'
        
        # Initialize PaddleOCR (Strictly matching reference code style + mkldnn fix)
        reader = PaddleOCR(
            use_angle_cls=use_angle, 
            lang='en',
            enable_mkldnn=False
        )
        logger.info("INFO PaddleOCR reader loaded successfully")
        return reader
    except Exception as e:
        logger.error(f"ERROR Failed to load PaddleOCR: {e}")
        return None

def clean_plate_number(text):
    """
    Clean and format license plate text.
    - Removes special characters
    - Converts to uppercase
    - Basic validation for Indian number plates
    """
    if not text:
        return ""
    
    # Remove non-alphanumeric characters
    cleaned = re.sub(r'[^A-Z0-9]', '', text.upper())
    
    # Basic length check (Indian plates are usually 8-10 chars)
    if len(cleaned) < 4:
        return ""
        
    return cleaned

def extract_plate_text(image: np.ndarray, bbox=None) -> dict:
    """
    Extract text from the license plate region using PaddleOCR.
    If bbox is provided [x1, y1, x2, y2], crop the image first.
    """
    try:
        # Crop if bbox provided
        if bbox:
            x1, y1, x2, y2 = map(int, bbox)
            # Ensure within bounds
            h, w = image.shape[:2]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            
            # Sanity check
            if x2 <= x1 or y2 <= y1:
                return {'plate_number': '', 'confidence': 0.0, 'error': 'Invalid bbox'}
                
            plate_img = image[y1:y2, x1:x2]
        else:
            plate_img = image

        if plate_img.size == 0:
             return {'plate_number': '', 'confidence': 0.0, 'error': 'Empty image'}

        # Preprocessing
        # Convert to gray
        gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
        
        # Resize small images to improve OCR accuracy
        if gray.shape[0] < 50:
            scale = 2
            gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        
        reader = get_paddle_reader()
        if not reader:
            return {'plate_number': '', 'confidence': 0.0, 'error': 'PaddleOCR not loaded'}

        # Run OCR
        # PaddleOCR expects image array (BGR/RGB) or path (BGR is fine for opencv images)
        ocr_input = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        result = reader.ocr(ocr_input)
        
        # CLEANUP: Explicitly delete reader and run GC to avoid SIGSEGV threading issues
        del reader
        import gc
        gc.collect()
        
        if not result or result[0] is None:
             return {'plate_number': '', 'confidence': 0.0, 'raw_text': ''}

        # ---------------- NEW LOGIC (User Reference) ----------------
        # Collect all detected text
        texts = []
        confidences = []
        
        # Debug: Log raw result type
        # logger.info(f"DEBUG PaddleOCR Result Type: {type(result)} -> {type(result[0])}")
        
        # Check if result[0] is a dict (New format / PaddleX format)
        if isinstance(result[0], dict):
             # Extract texts and scores directly from dict
             texts = result[0].get('rec_texts', [])
             confidences = result[0].get('rec_scores', [])
             # Ensure they are lists
             if not isinstance(texts, list): texts = [str(texts)]
             if not isinstance(confidences, list): confidences = [float(confidences)]
             
             logger.info(f"INFO PaddleOCR (Dict Format): Found {len(texts)} text blocks")
        else:
             # Legacy Format: List of lines [ [[box], (text, score)], ... ]
             for idx, line in enumerate(result[0]):
                try:
                    # Robust extraction based on user reference: text = line[1][0]
                    # line structure: [ [x1,y1]... , (text, conf) ]
                    if not line or len(line) < 2:
                        continue
                        
                    text_data = line[1]
                    if isinstance(text_data, (list, tuple)) and len(text_data) >= 2:
                        text = text_data[0]
                        conf = text_data[1]
                        texts.append(text)
                        confidences.append(conf)
                    elif isinstance(text_data, str):
                        # Sometimes it's just the string directly
                        texts.append(text_data)
                        confidences.append(0.5)
                    else:
                        logger.warning(f"WARNING: Unexpected line structure at index {idx}: {line}")
                except Exception as e:
                    logger.error(f"ERROR parsing line {idx}: {line} -> {e}")
                    continue
            
        full_text = " ".join(texts).upper()
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
        
        # Indian vehicle number plate regex (Improved)
        # Matches: RJ14 GT 8198, KA 01 AB 1234
        # \b[A-Z]{2} : RJ
        # \s? : space?
        # \d{1,2} : 14
        # \s? : space?
        # [A-Z]{1,3} : GT (some older plates have 1 or 3 letters)
        # \s? : space?
        # \d{3,4} : 8198
        plate_pattern = r"\b[A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?\d{3,4}\b"
        
        matches = re.findall(plate_pattern, full_text)
        
        best_text = ""
        
        if matches:
            # Take the longest match or first match
            # Clean spaces (RJ14 GT 8198 -> RJ14GT8198)
            best_text = matches[0].replace(" ", "")
            logger.info(f"INFO Plate OCR (Regex Match): '{best_text}' from '{full_text}'")
        else:
            # Fallback: Use logic of "Cleaned text > 4 chars"
            # Prefer the longest contiguous block from original lines
            best_conf_line = 0.0
            for line in result[0]:
                cleaned = clean_plate_number(line[1][0])
                conf = line[1][1]
                if len(cleaned) > 4 and conf > best_conf_line:
                    best_text = cleaned
                    best_conf_line = conf
            
            if not best_text and len(clean_plate_number(full_text)) > 4:
                 best_text = clean_plate_number(full_text)
            
            logger.info(f"INFO Plate OCR (Fallback): '{best_text}'")

        return {
            'plate_number': best_text,
            'confidence': float(avg_conf), # Return average confidence of the whole block
            'raw_text': full_text, 
            'message': f"Plate detected: {best_text}" if best_text else "OCR detected text but no plate pattern"
        }

    except Exception as e:
        logger.error(f"ERROR in extract_plate_text: {e}")
        return {
            'plate_number': '',
            'confidence': 0.0,
            'error': str(e)
        }

def extract_plate_from_yolo_result(image: np.ndarray, yolo_results) -> dict:
    """
    Find the 'number_plate' class in YOLO results and run OCR on it.
    Can accept a single Result object or a list of Results (takes first).
    """
    try:
        plate_bbox = None
        best_conf = 0.0
        
        # Check if input is list of dicts (from YoloDetectionService)
        # Service format: [{'class': 'Name', 'confidence': 0.9, 'bbox': [x1, y1, x2, y2]}]
        if isinstance(yolo_results, list) and len(yolo_results) > 0 and isinstance(yolo_results[0], dict):
            for det in yolo_results:
                class_name = det.get('class', '').lower()
                conf = det.get('confidence', 0.0)
                
                if 'plate' in class_name or 'license' in class_name:
                    if conf > best_conf:
                        best_conf = conf
                        plate_bbox = det.get('bbox')
                        
        # Legacy: Handle Ultralytics Results object
        else:
            # Handle list input (YOLO returns list of Results)
            results_obj = yolo_results
            if isinstance(yolo_results, list):
                if not yolo_results:
                    return {'plate_number': '', 'confidence': 0.0, 'error': 'Empty YOLO results'}
                results_obj = yolo_results[0]
                
            # Iterate boxes
            if hasattr(results_obj, 'boxes'):
                for box in results_obj.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    class_name = results_obj.names[cls_id]
                    
                    # Check for 'plate' or 'license' logic
                    if 'plate' in class_name or 'license' in class_name:
                        if conf > best_conf:
                            best_conf = conf
                            plate_bbox = box.xyxy[0].tolist() # [x1, y1, x2, y2]
        
        if plate_bbox:
            return extract_plate_text(image, plate_bbox)
            
        return {
            'success': False,
            'plate_number': '',
            'confidence': 0.0,
            'raw_text': '',
            'message': 'Number plate not detected by YOLO'
        }

    except Exception as e:
        logger.error(f"ERROR in extract_plate_from_yolo_result: {e}")
        return {
            'success': False,
            'plate_number': '',
            'error': str(e)
        }
