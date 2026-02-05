"""
API Views for YOLO Model Management and Detection
"""
import os
import tempfile
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from django.utils import timezone

from core.models import (
    Organization, SaaSEmployee, SaaSAttendance,
    CustomYoloModel, DetectionRequirement, LoginDetectionResult
)
from .yolo_service import get_yolo_service, YOLO_AVAILABLE


class YoloModelUploadView(APIView):
    """
    Upload a custom YOLO model (.pt file)
    POST /api/v1/detection/yolo-models/upload/
    """
    parser_classes = [MultiPartParser]
    permission_classes = [AllowAny]  # Should be admin-only in production
    
    def post(self, request):
        org_code = request.data.get('org_code', '').upper().strip()
        model_name = request.data.get('name', '').strip()
        description = request.data.get('description', '')
        model_file = request.FILES.get('model_file')
        
        if not org_code or not model_name or not model_file:
            return Response({
                'error': 'org_code, name, and model_file are required'
            }, status=400)
        
        # Validate file extension
        if not model_file.name.endswith('.pt'):
            return Response({
                'error': 'Only .pt YOLO model files are supported'
            }, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        # Save the model
        yolo_model = CustomYoloModel.objects.create(
            organization=org,
            name=model_name,
            description=description,
            model_file=model_file,
            classes=[]  # Will be populated after extraction
        )
        
        # Extract classes from the model
        if YOLO_AVAILABLE:
            service = get_yolo_service()
            classes = service.get_model_classes(yolo_model.model_file.path)
            yolo_model.classes = classes
            yolo_model.save()
            
            # Auto-create detection requirements (all optional by default)
            for cls_name in classes:
                DetectionRequirement.objects.create(
                    yolo_model=yolo_model,
                    class_name=cls_name,
                    display_name=cls_name.replace('_', ' ').title(),
                    is_required=False
                )
        
        return Response({
            'success': True,
            'model_id': str(yolo_model.id),
            'name': yolo_model.name,
            'classes': yolo_model.classes,
            'message': f'Model uploaded with {len(yolo_model.classes)} detectable classes'
        })


class YoloModelListView(APIView):
    """
    List all YOLO models (temporarily without org filter for debugging)
    GET /api/v1/detection/yolo-models/
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        # Temporarily show ALL models for debugging
        models = CustomYoloModel.objects.filter(is_active=True)
        
        data = []
        for m in models:
            requirements = m.requirements.all()
            data.append({
                'id': str(m.id),
                'name': m.name,
                'description': m.description,
                'org_code': m.organization.org_code if m.organization else None,
                'classes': m.classes,
                'requirements': [
                    {
                        'class_name': r.class_name,
                        'display_name': r.display_name,
                        'is_required': r.is_required
                    }
                    for r in requirements
                ],
                'created_at': m.created_at.isoformat()
            })
        
        return Response({
            'models': data,
            'count': len(data)
        })


class YoloRequirementsUpdateView(APIView):
    """
    Update which classes are required for a YOLO model
    PUT /api/v1/detection/yolo-models/{model_id}/requirements/
    """
    permission_classes = [AllowAny]
    
    def put(self, request, model_id):
        requirements = request.data.get('requirements', [])
        # Format: [{"class_name": "helmet", "is_required": true}, ...]
        
        try:
            yolo_model = CustomYoloModel.objects.get(id=model_id)
        except CustomYoloModel.DoesNotExist:
            return Response({'error': 'Model not found'}, status=404)
        
        updated = 0
        for req in requirements:
            class_name = req.get('class_name')
            is_required = req.get('is_required', False)
            
            DetectionRequirement.objects.filter(
                yolo_model=yolo_model,
                class_name=class_name
            ).update(is_required=is_required)
            updated += 1
        
        return Response({
            'success': True,
            'updated': updated,
            'message': f'Updated {updated} requirements'
        })


class YoloAddClassView(APIView):
    """
    Manually add a detection class to a YOLO model
    POST /api/v1/detection/yolo-models/{model_id}/add-class/
    """
    permission_classes = [AllowAny]
    
    def post(self, request, model_id):
        class_name = request.data.get('class_name', '').strip().lower()
        display_name = request.data.get('display_name', '').strip()
        is_required = request.data.get('is_required', False)
        
        if not class_name:
            return Response({'error': 'class_name is required'}, status=400)
        
        try:
            yolo_model = CustomYoloModel.objects.get(id=model_id)
        except CustomYoloModel.DoesNotExist:
            return Response({'error': 'Model not found'}, status=404)
        
        # Add to model's classes list
        if class_name not in yolo_model.classes:
            yolo_model.classes.append(class_name)
            yolo_model.save()
        
        # Create requirement if not exists
        req, created = DetectionRequirement.objects.get_or_create(
            yolo_model=yolo_model,
            class_name=class_name,
            defaults={
                'display_name': display_name or class_name.replace('_', ' ').title(),
                'is_required': is_required
            }
        )
        
        if not created:
            req.is_required = is_required
            if display_name:
                req.display_name = display_name
            req.save()
        
        return Response({
            'success': True,
            'class_name': class_name,
            'created': created,
            'total_classes': len(yolo_model.classes),
            'message': f'Class "{class_name}" added successfully'
        })


class MultiLoginWithDetectionView(APIView):
    """
    Multi-face login with optional YOLO detection
    POST /api/v1/detection/multi-login/
    
    Detects ALL faces in frame, identifies each, runs YOLO, checks compliance.
    """
    parser_classes = [MultiPartParser]
    permission_classes = [AllowAny]
    authentication_classes = [] # Disable CSRF for public kiosk
    
    def post(self, request):
        from django.core.files import File
        from django.conf import settings
        import numpy as np
        from apps.faces.deepface_service import get_deepface_service
        
        org_code = request.data.get('org_code', '').upper().strip()
        image_file = request.FILES.get('image')

        print("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
        
        if not org_code or not image_file:
            return Response({'error': 'org_code and image required'}, status=400)
        print("yyyyyyyyyyyyyyyyyyyyyyyyyyyyyy")
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        print("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz")
        # Save image temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as f:
            for chunk in image_file.chunks():
                f.write(chunk)
            temp_path = f.name
        
        try:
            # 1. FACE RECOGNITION - Get embedding from image
            print("x")
            face_service = get_deepface_service()
            query_embedding = face_service.get_embedding(temp_path)
            print("y")
            
            if query_embedding is None:
                return Response({
                    'success': False,
                    'message': 'No face detected in image'
                }, status=400)
            
            query_embedding = np.array(query_embedding)
            
            # 2. Find matching employee (1:N search)
            employees = SaaSEmployee.objects.filter(
                organization=org, 
                face_enrolled=True, 
                status='active'
            )
            
            best_match = None
            best_distance = float('inf')
            
            for emp in employees:
                for stored in (emp.face_embeddings or []):
                    stored = np.array(stored)
                    # Cosine similarity
                    distance = 1 - np.dot(query_embedding, stored) / (
                        np.linalg.norm(query_embedding) * np.linalg.norm(stored) + 1e-10
                    )
                    if distance < best_distance:
                        best_distance = distance
                        best_match = emp
            
            if best_match is None or best_distance > 0.4:
                return Response({
                    'success': False,
                    'message': 'Face not recognized',
                    'distance': round(best_distance, 3) if best_distance != float('inf') else None
                }, status=400)
            
            face_confidence = 1 - best_distance
            
            # 3. YOLO DETECTION (if model is configured)
            detections = {}
            compliance_passed = True
            yolo_model_used = None
            
            active_yolo = CustomYoloModel.objects.filter(
                organization=org, 
                is_active=True
            ).first()
            print("active_yolo", active_yolo)
            print("YOLO_AVAILABLE", YOLO_AVAILABLE)
            
            if active_yolo and YOLO_AVAILABLE:
                yolo_model_used = active_yolo
                service = get_yolo_service()
                
                # Load model if not already loaded
                model_id = str(active_yolo.id)
                service.load_model(active_yolo.model_file.path, model_id)
                
                # Run detection
                detections = service.detect(temp_path, model_id)
                
                # Use DYNAMIC COMPLIANCE RULES (reads from database)
                from .compliance_rules import check_full_compliance
                compliance_result = check_full_compliance(detections, active_yolo)
                compliance_passed = compliance_result['passed']
                compliance_summary = compliance_result['summary']
            
            # --- Compliance Enforcement ---
            if org.compliance_enforcement == 'block' and not compliance_passed:
                # Log the failure first
                LoginDetectionResult.objects.create(
                    organization=org,
                    employee=best_match,
                    yolo_model=yolo_model_used,
                    face_confidence=face_confidence,
                    detections=detections,
                    compliance_passed=False
                )
                return Response({
                    'success': False,
                    'message': compliance_summary if 'compliance_summary' in dir() else "Compliance Failed: Entry Denied",
                    'compliance_passed': False,
                    'detections': detections
                }, status=400)
            
            # --- Attendance Mode Logic ---
            action = request.data.get('action', 'auto') # check_in, check_out, auto
            attendance_status = "marked"
            print("ssmom")

            if org.attendance_mode == 'daily':
                today = timezone.now().date()
                now = timezone.now()
                
                # Get or Create Attendance Record
                record, created = SaaSAttendance.objects.get_or_create(
                    organization=org,
                    employee=best_match,
                    date=today,
                    defaults={
                        'check_in': now,
                        'check_in_confidence': round(face_confidence * 100, 1),
                        'status': 'present'
                    }
                )

                if action == 'check_in':
                    if not created:
                        # If already exists, we essentially do nothing or update check_in if it was somehow null?
                        # Usually "Already Checked In". We can just ensure status is present.
                        attendance_status = "Already Checked In"
                    else:
                        attendance_status = "Checked In"

                elif action == 'check_out':
                    # Explicit Check Out
                    record.check_out = now
                    record.check_out_confidence = round(face_confidence * 100, 1)
                    if record.check_in:
                        record.work_duration = now - record.check_in
                    record.save()
                    attendance_status = "Checked Out"

                else: # 'auto'
                    if not created:
                        # Standard First-In Last-Out auto update
                        record.check_out = now
                        record.check_out_confidence = round(face_confidence * 100, 1)
                        if record.check_in:
                            record.work_duration = now - record.check_in
                        record.save()
                        attendance_status = "Checked Out (Auto)"
                    else:
                        attendance_status = "Checked In (Auto)"
            
            # 4. Record the result (Debounced)
            from datetime import timedelta
            
            # Check for recent log (within last 2 minutes) to update instead of create
            # This prevents spamming the DB with one record per second
            recent_threshold = timezone.now() - timedelta(minutes=2)
            recent_log = LoginDetectionResult.objects.filter(
                organization=org,
                employee=best_match,
                timestamp__gte=recent_threshold
            ).order_by('-timestamp').first()
            
            with open(temp_path, 'rb') as f:
                file_content = File(f, name=f"login_{best_match.employee_id}_{timezone.now().timestamp()}.jpg")
                
                if recent_log:
                    # Update existing log
                    recent_log.yolo_model = yolo_model_used
                    recent_log.face_confidence = face_confidence
                    recent_log.detections = detections
                    recent_log.compliance_passed = compliance_passed
                    
                    # Update timestamp to "now" (last seen)
                    recent_log.timestamp = timezone.now()
                    
                    # Replace image (delete old one to save space logic could be added, but Django handles overwrite if same name, 
                    # but here names are unique. For now, we accept file growth or we can delete)
                    # Simple overwrite:
                    recent_log.frame_image = file_content
                    recent_log.save()
                else:
                    # Create new log
                    LoginDetectionResult.objects.create(
                        organization=org,
                        employee=best_match,
                        yolo_model=yolo_model_used,
                        face_confidence=face_confidence,
                        detections=detections,
                        compliance_passed=compliance_passed,
                        frame_image=file_content
                    )
            compliance_msg = compliance_summary if 'compliance_summary' in dir() else ("✅ Compliance Passed" if compliance_passed else "❌ Compliance Failed")
            
            return Response({
                'success': True,
                'employee': {
                    'id': best_match.employee_id,
                    'name': best_match.full_name,
                    'department': best_match.department
                },
                'face_confidence': round(face_confidence * 100, 1),
                'detections': detections,
                'compliance_passed': compliance_passed,
                'compliance_summary': compliance_msg,
                'message': f"Welcome, {best_match.first_name}!" if compliance_passed else compliance_msg
            })
            
        finally:
            # Cleanup temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)


class ComplianceLogsView(APIView):
    """
    Get compliance/detection logs
    GET /api/v1/detection/logs/?org_code=ACME
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        org_code = request.query_params.get('org_code', '').upper().strip()
        limit = int(request.query_params.get('limit', 50))
        
        if not org_code:
            return Response({'error': 'org_code required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        logs = LoginDetectionResult.objects.filter(
            organization=org
        ).select_related('employee', 'yolo_model')[:limit]
        
        data = []
        for log in logs:
            data.append({
                'id': str(log.id),
                'employee': log.employee.full_name,
                'employee_id': log.employee.employee_id,
                'timestamp': log.timestamp.isoformat(),
                'face_confidence': round(log.face_confidence * 100, 1),
                'detections': log.detections,
                'compliance_passed': log.compliance_passed,
                'yolo_model': log.yolo_model.name if log.yolo_model else None,
                'image_url': log.frame_image.url if log.frame_image else None
            })
        
        return Response({
            'logs': data,
            'count': len(data)
        })


class LivePreviewView(APIView):
    """
    Lightweight preview endpoint. 
    Runs ONLY YOLO detection to give frontend visual feedback.
    POST /api/v1/detection/preview/
    """
    permission_classes = [AllowAny]
    authentication_classes = [] # Disable CSRF for public kiosk
    
    def post(self, request):
        from .yolo_service import get_yolo_service, YOLO_AVAILABLE
        import tempfile
        
        org_code = request.data.get('org_code', '').upper().strip()
        image_file = request.FILES.get('image')
        
        if not org_code or not image_file:
            return Response({'boxes': []}) # Fail silently for preview
            
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
            
            # --- 1. FACE RECOGNITION (Multi-Face Server-Side) ---
            face_results_list = []
            detected_name = None
            yolo_temp_path = None
            
            try:
                from apps.faces.deepface_service import get_deepface_service
                from services.vector_db import vector_db
                face_service = get_deepface_service()

                if 'image' in request.FILES:
                    # Save main image to temp path
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as f:
                        for chunk in request.FILES['image'].chunks():
                            f.write(chunk)
                        yolo_temp_path = f.name
                    
                    # Get ALL faces from the full image
                    # This uses DeepFace to detect faces in the uncropped image
                    results = face_service.get_all_embeddings(yolo_temp_path)
                    
                    for res in results:
                         embedding = res.get('embedding')
                         area = res.get('facial_area')
                         
                         name = None
                         conf = 0.0
                         
                         if embedding:
                             # Match heavy
                             match = vector_db.find_best_match(org_code, 'heavy', embedding, min_confidence=0.01)
                             if match:
                                 _, conf, name = match
                             else:
                                 # Match light
                                 match = vector_db.find_best_match(org_code, 'light', embedding, min_confidence=0.01)
                                 if match:
                                     _, conf, name = match
                         
                         if name:
                             face_results_list.append({
                                 'name': name,
                                 'confidence': conf,
                                 'box': area
                             })
                             print(f"Match: {name} at {area}")

                    if face_results_list:
                         detected_name = face_results_list[0]['name']

            except Exception as e:
                print(f"Preview Face System Error: {e}")
            
            # --- 2. YOLO DETECTION ---
            # Helper to get active model
            active_yolo = CustomYoloModel.objects.filter(
                organization=org, 
                is_active=True
            ).first()
            
            boxes = []
            if active_yolo and YOLO_AVAILABLE:
                try:
                    service = get_yolo_service()
                    model_id = str(active_yolo.id)
                    service.load_model(active_yolo.model_file.path, model_id)
                    
                    # Get detailed detections with boxes
                    if yolo_temp_path and os.path.exists(yolo_temp_path):
                        detections = service.detect_with_details(yolo_temp_path, model_id)
                    else:
                        detections = []
                    
                    # Check which classes are required
                    required_classes = set(
                        active_yolo.requirements.filter(is_required=True).values_list('class_name', flat=True)
                    )
                    
                    # Add compliance info to each box
                    for d in detections:
                        d['is_required'] = d['class'] in required_classes
                    
                    boxes = detections
                except Exception as e:
                    print(f"Preview YOLO Error: {e}")

            # Cleanup
            if yolo_temp_path and os.path.exists(yolo_temp_path):
                os.unlink(yolo_temp_path)
                
            return Response({
                'boxes': boxes,
                'detected_name': detected_name,
                'face_results': face_results_list
            })
                    
        except Exception as e:
            return Response({'boxes': [], 'detected_name': None})
