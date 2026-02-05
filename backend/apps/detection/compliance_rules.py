"""
Dynamic Compliance Rules Engine
Checks if detected classes match what user marked as required in database.

Special Rules:
- Number Plate: Either "Number Plate" OR "Painted Number Plate" satisfies the requirement
"""
import logging

logger = logging.getLogger(__name__)

# Special OR groups - if ANY of these are detected, the requirement is satisfied
NUMBER_PLATE_ALTERNATIVES = ['number plate', 'painted number plate']


def check_compliance_dynamic(detections: dict, required_classes: list) -> dict:
    """
    Check if all required classes are detected.
    
    Args:
        detections: dict of {class_name: count} from YOLO detection
        required_classes: list of class names that must be detected
    
    Returns:
        {
            'passed': bool,
            'checks': {'required': {'passed': bool, 'missing': [], 'detected': []}},
            'summary': str
        }
    """
    result = {
        'passed': True,
        'checks': {},
        'summary': '',
        'failed_reasons': []
    }
    
    if not required_classes:
        result['summary'] = "✅ No requirements configured"
        return result
    
    # Normalize detection keys to lowercase
    detected_lower = {k.lower().strip(): v for k, v in detections.items()}
    
    missing = []
    detected = []
    
    # Check if any number plate alternative is in required classes
    number_plate_required = any(
        rc.lower().strip() in NUMBER_PLATE_ALTERNATIVES 
        for rc in required_classes
    )
    number_plate_found = False
    
    for req_class in required_classes:
        req_lower = req_class.lower().strip()
        
        # Special handling for Number Plate alternatives
        if req_lower in NUMBER_PLATE_ALTERNATIVES:
            # Check if ANY number plate type was detected
            if not number_plate_found:  # Only check once
                for alt in NUMBER_PLATE_ALTERNATIVES:
                    if detected_lower.get(alt):
                        number_plate_found = True
                        detected.append("Number Plate")
                        break
                if not number_plate_found:
                    missing.append("Number Plate")
            continue
        
        # Normal class check
        if detected_lower.get(req_lower):
            detected.append(req_class)
        else:
            missing.append(req_class)
    
    result['checks']['required'] = {
        'passed': len(missing) == 0,
        'missing': missing,
        'detected': detected
    }
    
    if missing:
        result['passed'] = False
        result['failed_reasons'].append(f"Missing: {', '.join(missing)}")
    
    # Generate Summary
    if result['passed']:
        result['summary'] = "✅ All compliance checks passed"
    else:
        result['summary'] = "❌ " + "; ".join(result['failed_reasons'])
    
    logger.info(f"Compliance check: {result['summary']}")
    
    return result


def check_full_compliance(detections: dict, yolo_model=None) -> dict:
    """
    Run compliance check using database requirements.
    
    Args:
        detections: dict of {class_name: count} from YOLO detection
        yolo_model: Optional CustomYoloModel instance to get requirements from
    
    Returns compliance result dict
    """
    from core.models import DetectionRequirement
    
    # Get required classes from database
    required_classes = []
    if yolo_model:
        required_classes = list(
            DetectionRequirement.objects.filter(
                yolo_model=yolo_model,
                is_required=True
            ).values_list('class_name', flat=True)
        )
    
    logger.info(f"Required classes from DB: {required_classes}")
    logger.info(f"Detections: {detections}")
    
    return check_compliance_dynamic(detections, required_classes)


# Quick API function for views
def is_compliant(detections: dict, yolo_model=None) -> tuple:
    """
    Quick compliance check for views.
    Returns: (passed, summary_message)
    """
    result = check_full_compliance(detections, yolo_model)
    return result['passed'], result['summary']
