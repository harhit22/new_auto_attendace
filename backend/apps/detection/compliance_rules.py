"""
Dynamic Compliance Rules Engine
Checks if detected classes match what user marked as required in database.

Special Rules:
- Number Plate: Either "Number Plate" OR "Painted Number Plate" satisfies the requirement
"""
import logging

logger = logging.getLogger(__name__)

# Special OR groups - if ANY of these are detected, the requirement is satisfied
NUMBER_PLATE_ALTERNATIVES = ['number plate', 'painted number plate', 'number_plate']
HOOTER_ALTERNATIVES = ['hooter', 'beacon', 'red_light']
LOGO_ALTERNATIVES = ['logo', 'swachh_bharat', 'emblem']
NN_ALTERNATIVES = ['nagar_nigam', 'text_nn', 'nn_text']

# Map standard requirement names to their alternatives
REQUIREMENT_GROUPS = {
    'number plate': NUMBER_PLATE_ALTERNATIVES,
    'hooter': HOOTER_ALTERNATIVES,
    'logo': LOGO_ALTERNATIVES,
    'nagar nigam': NN_ALTERNATIVES,
    'nagar_nigam': NN_ALTERNATIVES, # Handle both snake_case and space
}


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
        
        # Check if this requirement belongs to a special group (OR logic)
        alternatives = REQUIREMENT_GROUPS.get(req_lower)
        if not alternatives:
            # Also check if it matches any standard key in the map
            for key, headers in REQUIREMENT_GROUPS.items():
                if req_lower in headers:
                    alternatives = headers
                    break
        
        if alternatives:
            # Check if ANY item from the group was detected
            group_found = False
            for alt in alternatives:
                if detected_lower.get(alt):
                    group_found = True
                    detected.append(req_class) # Record the requirement name as detected
                    break
            
            if not group_found:
                missing.append(req_class)
            continue
        
        # Normal class check (Exact Match)
        if detected_lower.get(req_lower):
            detected.append(req_class)
        else:
            missing.append(req_class)
        
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
    
    # DEFAULT COMPLIANCE RULES (If nothing configured in DB)
    # As requested: Hooter, Logo, Nagar Nigam, Number Plate are MANDATORY
    if not required_classes:
        required_classes = ['number plate', 'hooter', 'logo', 'nagar nigam']
    
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
