"""
Smart Compliance Rules Engine
Complex logic for vehicle/uniform compliance checking.

Rules:
1. REQUIRED: Hooter, Nagar Nigam, Logo - all must be detected
2. NUMBER PLATE: Either "Number Plate" OR "Painted Number Plate" must be detected
3. UNIFORM: Multi-person logic
   - 1 person: must have Wevois Uniform
   - 2 persons: both must have Wevois Uniform, no Improper Uniform
"""
import logging

logger = logging.getLogger(__name__)


# Detection class names (case-insensitive matching)
REQUIRED_ALWAYS = ['hooter', 'nagar nigam', 'logo']
NUMBER_PLATE_OPTIONS = ['number plate', 'painted number plate']
UNIFORM_CLASS = 'wevois uniform'
IMPROPER_UNIFORM_CLASS = 'improper uniform'


def normalize_detection_keys(detections: dict) -> dict:
    """Normalize all detection keys to lowercase for comparison."""
    return {k.lower().strip(): v for k, v in detections.items()}


def check_required_detections(detections: dict) -> tuple[bool, list[str]]:
    """
    Check if all required items are detected.
    Returns: (passed, list of missing items)
    """
    normalized = normalize_detection_keys(detections)
    missing = []
    
    for required in REQUIRED_ALWAYS:
        if not normalized.get(required):
            missing.append(required.title())
    
    return len(missing) == 0, missing


def check_number_plate(detections: dict) -> tuple[bool, str]:
    """
    Check if either Number Plate OR Painted Number Plate is detected.
    Returns: (passed, message)
    """
    normalized = normalize_detection_keys(detections)
    
    for plate_option in NUMBER_PLATE_OPTIONS:
        if normalized.get(plate_option):
            return True, f"Detected: {plate_option.title()}"
    
    return False, "No Number Plate detected"


def count_uniforms(detections: dict) -> dict:
    """
    Count uniform-related detections.
    Returns: dict with counts for uniform types
    """
    normalized = normalize_detection_keys(detections)
    
    # YOLO detection returns count of objects detected
    uniform_count = normalized.get(UNIFORM_CLASS, 0)
    improper_count = normalized.get(IMPROPER_UNIFORM_CLASS, 0)
    
    # Handle boolean values (True = 1, False = 0)
    if isinstance(uniform_count, bool):
        uniform_count = 1 if uniform_count else 0
    if isinstance(improper_count, bool):
        improper_count = 1 if improper_count else 0
    
    return {
        'proper_uniform': int(uniform_count),
        'improper_uniform': int(improper_count),
        'total_people': int(uniform_count) + int(improper_count)
    }


def check_uniform_compliance(detections: dict) -> tuple[bool, str]:
    """
    Check uniform compliance with multi-person logic.
    
    Rules:
    - 1 person: must have Wevois Uniform
    - 2 persons: both must have Wevois Uniform
    - Any Improper Uniform detected = FAIL
    
    Returns: (passed, message)
    """
    counts = count_uniforms(detections)
    proper = counts['proper_uniform']
    improper = counts['improper_uniform']
    total = counts['total_people']
    
    # Rule: Any improper uniform = FAIL
    if improper > 0:
        return False, f"Improper Uniform detected ({improper})"
    
    # Rule: At least one proper uniform required
    if proper == 0:
        return False, "No Wevois Uniform detected"
    
    # Rule: If 2 people, both must have uniform (no improper)
    if total >= 2 and improper > 0:
        return False, f"Not all persons in proper uniform ({proper}/{total})"
    
    # All good
    if total == 1:
        return True, "Uniform compliance passed (1 person)"
    else:
        return True, f"Uniform compliance passed ({proper} persons)"


def check_full_compliance(detections: dict) -> dict:
    """
    Run all compliance checks and return detailed result.
    
    Args:
        detections: dict of {class_name: detected_count_or_bool}
    
    Returns:
        {
            'passed': bool,
            'checks': {
                'required': {'passed': bool, 'missing': []},
                'number_plate': {'passed': bool, 'message': str},
                'uniform': {'passed': bool, 'message': str}
            },
            'summary': str
        }
    """
    result = {
        'passed': True,
        'checks': {},
        'summary': '',
        'failed_reasons': []
    }
    
    # 1. Check Required Detections (Hooter, Nagar Nigam, Logo)
    req_passed, req_missing = check_required_detections(detections)
    result['checks']['required'] = {
        'passed': req_passed,
        'missing': req_missing
    }
    if not req_passed:
        result['passed'] = False
        result['failed_reasons'].append(f"Missing: {', '.join(req_missing)}")
    
    # 2. Check Number Plate (Either/Or)
    plate_passed, plate_msg = check_number_plate(detections)
    result['checks']['number_plate'] = {
        'passed': plate_passed,
        'message': plate_msg
    }
    if not plate_passed:
        result['passed'] = False
        result['failed_reasons'].append(plate_msg)
    
    # 3. Check Uniform (Multi-Person Logic)
    uniform_passed, uniform_msg = check_uniform_compliance(detections)
    result['checks']['uniform'] = {
        'passed': uniform_passed,
        'message': uniform_msg
    }
    if not uniform_passed:
        result['passed'] = False
        result['failed_reasons'].append(uniform_msg)
    
    # Generate Summary
    if result['passed']:
        result['summary'] = "✅ All compliance checks passed"
    else:
        result['summary'] = "❌ " + "; ".join(result['failed_reasons'])
    
    logger.info(f"Compliance check: {result['summary']}")
    
    return result


# Quick API function for views
def is_compliant(detections: dict) -> tuple[bool, str]:
    """
    Quick compliance check for views.
    Returns: (passed, summary_message)
    """
    result = check_full_compliance(detections)
    return result['passed'], result['summary']
