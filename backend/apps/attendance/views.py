"""
Attendance API Views
Check-in/out with face recognition, reports, exports
FLOW: Employee captures images → Admin approves → Admin trains model
"""
import os
import io
import tempfile
from datetime import datetime, date, timedelta
from django.utils import timezone
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action
import numpy as np

from core.models import Organization, SaaSEmployee as Employee, SaaSAttendance as AttendanceRecord


class OrgLoginView(APIView):
    """
    Simple login with org_code + password
    Returns organization info for the session
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        org_code = request.data.get('org_code', '').upper().strip()
        password = request.data.get('password', '').strip()
        
        if not org_code or not password:
            return Response({'error': 'Organization code and password required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        if org.password != password:
            return Response({'error': 'Invalid password'}, status=401)
        
        return Response({
            'success': True,
            'organization': {
                'id': str(org.id),
                'org_code': org.org_code,
                'name': org.name,
                'plan': org.plan,
                'employee_count': org.employee_count,
                'max_employees': org.max_employees,
                'recognition_mode': org.recognition_mode  # light or heavy
            }
        })


class VerifyEmployeeView(APIView):
    """
    Verify employee exists for self-enrollment
    POST /api/v1/attendance/verify-employee/
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        org_code = request.data.get('org_code', '').upper().strip()
        employee_id = request.data.get('employee_id', '').strip()
        
        if not org_code or not employee_id:
            return Response({'error': 'org_code and employee_id required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        try:
            employee = Employee.objects.get(organization=org, employee_id=employee_id, status='active')
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found'}, status=404)
        
        return Response({
            'success': True,
            'employee': {
                'id': str(employee.id),
                'employee_id': employee.employee_id,
                'name': employee.full_name,
                'image_count': employee.image_count,
                'image_status': employee.image_status,
                'face_enrolled': employee.face_enrolled
            },
            'organization': {
                'name': org.name,
                'org_code': org.org_code
            }
        })


class EmployeeLoginView(APIView):
    """
    Employee login with individual credentials
    POST /api/v1/attendance/employee-login/
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        org_code = request.data.get('org_code', '').upper().strip()
        employee_id = request.data.get('employee_id', '').strip()
        password = request.data.get('password', '').strip()
        
        if not org_code or not employee_id or not password:
            return Response({'error': 'org_code, employee_id, and password required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        try:
            employee = Employee.objects.get(organization=org, employee_id=employee_id, status='active')
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found'}, status=404)
        
        if employee.password != password:
            return Response({'error': 'Invalid password'}, status=401)
        
        # Update last_login
        employee.last_login = timezone.now()
        employee.save(update_fields=['last_login'])
        
        return Response({
            'success': True,
            'employee': {
                'id': str(employee.id),
                'employee_id': employee.employee_id,
                'name': employee.full_name,
                'department': employee.department,
                'designation': employee.designation,
                'face_enrolled': employee.face_enrolled,
                'image_count': employee.image_count,
                'image_status': employee.image_status
            },
            'organization': {
                'id': str(org.id),
                'name': org.name,
                'org_code': org.org_code
            }
        })


class EmployeeDashboardView(APIView):
    """
    Get employee's attendance records and stats
    GET /api/v1/attendance/employee-dashboard/?org_code=X&employee_id=Y
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        org_code = request.query_params.get('org_code', '').upper().strip()
        employee_id = request.query_params.get('employee_id', '').strip()
        
        if not org_code or not employee_id:
            return Response({'error': 'org_code and employee_id required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
            employee = Employee.objects.get(organization=org, employee_id=employee_id, status='active')
        except (Organization.DoesNotExist, Employee.DoesNotExist):
            return Response({'error': 'Employee not found'}, status=404)
        
        # Get attendance records (last 30 days)
        from datetime import timedelta
        thirty_days_ago = date.today() - timedelta(days=30)
        records = AttendanceRecord.objects.filter(
            employee=employee,
            date__gte=thirty_days_ago
        ).order_by('-date')[:30]
        
        attendance_list = [{
            'date': r.date.strftime('%Y-%m-%d'),
            'check_in': r.check_in.strftime('%H:%M') if r.check_in else None,
            'check_out': r.check_out.strftime('%H:%M') if r.check_out else None,
            'status': r.status
        } for r in records]
        
        # Today's status
        today = date.today()
        today_record = AttendanceRecord.objects.filter(employee=employee, date=today).first()
        
        return Response({
            'employee': {
                'id': str(employee.id),
                'employee_id': employee.employee_id,
                'name': employee.full_name,
                'department': employee.department,
                'face_enrolled': employee.face_enrolled,
                'image_count': employee.image_count,
                'image_status': employee.image_status,
                'last_login': employee.last_login.isoformat() if employee.last_login else None
            },
            'organization': {
                'name': org.name,
                'org_code': org.org_code
            },
            'today': {
                'checked_in': today_record.check_in.strftime('%H:%M') if today_record and today_record.check_in else None,
                'checked_out': today_record.check_out.strftime('%H:%M') if today_record and today_record.check_out else None
            } if today_record else {'checked_in': None, 'checked_out': None},
            'attendance': attendance_list
        })


class CaptureImagesView(APIView):
    """
    Employee captures face images - ONLY SAVES, NO TRAINING
    POST /api/v1/attendance/capture-images/
    
    Saves both:
    1. Image files to disk (for admin to view)
    2. Embeddings to database (for training)
    """
    parser_classes = [MultiPartParser]
    permission_classes = [AllowAny]
    
    def post(self, request):
        org_code = request.data.get('org_code', '').upper().strip()
        employee_id = request.data.get('employee_id', '').strip()
        images = request.FILES.getlist('images')
        
        if not org_code or not employee_id:
            return Response({'error': 'org_code and employee_id required'}, status=400)
        
        if not images:
            return Response({'error': 'No images provided'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
            employee = Employee.objects.get(organization=org, employee_id=employee_id, status='active')
        except (Organization.DoesNotExist, Employee.DoesNotExist):
            return Response({'error': 'Organization or employee not found'}, status=404)
        
        try:
            from apps.faces.deepface_service import get_deepface_service
            from django.conf import settings
            import shutil
            
            service = get_deepface_service()
            
            # Create directory for employee images
            images_dir = os.path.join(settings.MEDIA_ROOT, 'employee_faces', org_code, employee_id)
            os.makedirs(images_dir, exist_ok=True)
            
            new_embeddings = []
            faces_detected = 0
            current_count = employee.image_count or 0
            
            for idx, img in enumerate(images):
                with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as f:
                    for chunk in img.chunks():
                        f.write(chunk)
                    temp_path = f.name
                
                embedding = service.get_embedding(temp_path)
                if embedding is not None:
                    new_embeddings.append(list(embedding))
                    faces_detected += 1
                    
                    # Save image to permanent location
                    img_filename = f"{current_count + faces_detected:04d}.jpg"
                    img_path = os.path.join(images_dir, img_filename)
                    shutil.copy(temp_path, img_path)
                
                os.unlink(temp_path)
            
            if faces_detected == 0:
                return Response({'error': 'No faces detected. Please ensure good lighting and face visibility.'}, status=400)
            
            # ONLY SAVE - DON'T TRAIN
            current = employee.captured_embeddings or []
            current.extend(new_embeddings)
            
            employee.captured_embeddings = current
            employee.image_count = len(current)
            employee.image_status = 'captured'
            employee.save()
            
            return Response({
                'success': True,
                'message': f'{faces_detected} images saved! Admin will review and train.',
                'images_added': faces_detected,
                'total_images': employee.image_count,
                'image_status': 'captured'
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class ApproveImagesView(APIView):
    """
    Admin approves employee images
    POST /api/v1/attendance/approve-images/
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        employee_id = request.data.get('employee_id')
        
        try:
            employee = Employee.objects.get(id=employee_id)
            employee.image_status = 'approved'
            employee.save()
            
            return Response({
                'success': True,
                'message': f'Images approved for {employee.full_name}'
            })
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found'}, status=404)


class TrainModelView(APIView):
    """
    Admin trains model for organization
    POST /api/v1/attendance/train-model/
    
    Modes:
    - light: Uses face-api.js embeddings (browser-based, fast, 128-dim)
    - heavy: Uses DeepFace/ArcFace embeddings (Python-based, accurate, 512-dim)
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        from django.conf import settings
        
        org_code = request.data.get('org_code', '').upper().strip()
        mode = request.data.get('mode', 'light')  # light or heavy
        
        if not org_code:
            return Response({'error': 'org_code required'}, status=400)
        
        if mode not in ['light', 'heavy']:
            return Response({'error': 'mode must be "light" or "heavy"'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        # Get employees with captured images
        employees = Employee.objects.filter(
            organization=org,
            status='active',
            image_status__in=['approved', 'captured']
        )
        
        if employees.count() == 0:
            return Response({'error': 'No employees with images to train'}, status=400)
        
        trained_count = 0
        total_embeddings = 0
        
        if mode == 'heavy':
            # HEAVY MODE: Re-process images with DeepFace for better accuracy
            from apps.faces.deepface_service import get_deepface_service
            service = get_deepface_service()
            
            for emp in employees:
                # Get images from disk
                images_dir = os.path.join(settings.MEDIA_ROOT, 'employee_faces', org_code, emp.employee_id)
                
                if not os.path.exists(images_dir):
                    continue
                
                deep_embeddings = []
                for filename in os.listdir(images_dir):
                    if filename.endswith(('.jpg', '.jpeg', '.png')):
                        img_path = os.path.join(images_dir, filename)
                        embedding = service.get_embedding(img_path)
                        if embedding is not None:
                            deep_embeddings.append(list(embedding))
                
                if len(deep_embeddings) >= 3:
                    # Store in HEAVY model fields
                    emp.heavy_embeddings = deep_embeddings
                    emp.heavy_trained = True
                    emp.heavy_trained_at = timezone.now()
                    
                    # Also set as active model if not already trained
                    if not emp.face_enrolled or emp.training_mode != 'light':
                        emp.face_embeddings = deep_embeddings
                        emp.training_mode = 'heavy'
                    
                    emp.face_enrolled = True
                    emp.image_status = 'trained'
                    emp.last_trained_at = timezone.now()
                    emp.save()
                    
                    trained_count += 1
                    total_embeddings += len(deep_embeddings)
        else:
            # LIGHT MODE: Use already-captured embeddings (from face-api.js or quick capture)
            for emp in employees:
                embeddings = emp.captured_embeddings or []
                if len(embeddings) < 3:
                    continue
                
                # Store in LIGHT model fields
                emp.light_embeddings = embeddings
                emp.light_trained = True
                emp.light_trained_at = timezone.now()
                
                # Also set as active model
                emp.face_embeddings = embeddings
                emp.training_mode = 'light'
                
                emp.face_enrolled = True
                emp.image_status = 'trained'
                emp.last_trained_at = timezone.now()
                emp.save()
                
                trained_count += 1
                total_embeddings += len(embeddings)
        
        model_name = 'DeepFace/ArcFace' if mode == 'heavy' else 'Quick Embeddings'
        
        return Response({
            'success': True,
            'mode': mode,
            'model': model_name,
            'employees_trained': trained_count,
            'total_embeddings': total_embeddings,
            'message': f'{trained_count} employees trained with {model_name}!'
        })


class TestEmployeeModelView(APIView):
    """
    Test model accuracy for an employee by matching a test image
    POST /api/v1/attendance/test-model/
    
    Upload a test image to see if the model correctly identifies the employee
    """
    parser_classes = [MultiPartParser]
    permission_classes = [AllowAny]
    
    def post(self, request):
        org_code = request.data.get('org_code', '').upper().strip()
        employee_id = request.data.get('employee_id', '').strip()
        image = request.FILES.get('image')
        
        if not org_code or not employee_id:
            return Response({'error': 'org_code and employee_id required'}, status=400)
        
        if not image:
            return Response({'error': 'Test image required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
            target_employee = Employee.objects.get(organization=org, employee_id=employee_id)
        except (Organization.DoesNotExist, Employee.DoesNotExist):
            return Response({'error': 'Employee not found'}, status=404)
        
        if not target_employee.face_enrolled or not target_employee.face_embeddings:
            return Response({'error': 'Employee model not trained yet'}, status=400)
        
        try:
            from apps.faces.deepface_service import get_deepface_service
            service = get_deepface_service()
            
            # Save test image temporarily
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as f:
                for chunk in image.chunks():
                    f.write(chunk)
                temp_path = f.name
            
            # Get test embedding
            test_embedding = service.get_embedding(temp_path)
            os.unlink(temp_path)
            
            if test_embedding is None:
                return Response({'error': 'No face detected in test image'}, status=400)
            
            test_embedding = np.array(test_embedding)
            
            # Test against target employee
            target_distances = []
            for stored in target_employee.face_embeddings:
                stored = np.array(stored)
                distance = 1 - np.dot(test_embedding, stored) / (
                    np.linalg.norm(test_embedding) * np.linalg.norm(stored)
                )
                target_distances.append(distance)
            
            avg_distance = np.mean(target_distances)
            min_distance = np.min(target_distances)
            confidence = (1 - min_distance) * 100
            
            # Check against all trained employees
            all_employees = Employee.objects.filter(
                organization=org, face_enrolled=True, status='active'
            )
            
            best_match = None
            best_distance = float('inf')
            
            for emp in all_employees:
                for stored in (emp.face_embeddings or []):
                    stored = np.array(stored)
                    distance = 1 - np.dot(test_embedding, stored) / (
                        np.linalg.norm(test_embedding) * np.linalg.norm(stored)
                    )
                    if distance < best_distance:
                        best_distance = distance
                        best_match = emp
            
            is_correct = best_match and best_match.id == target_employee.id
            
            return Response({
                'success': True,
                'target_employee': target_employee.full_name,
                'matched_employee': best_match.full_name if best_match else None,
                'is_correct_match': is_correct,
                'confidence': round(confidence, 1),
                'min_distance': round(min_distance, 4),
                'avg_distance': round(avg_distance, 4),
                'threshold': 0.4,
                'training_mode': target_employee.training_mode,
                'embeddings_count': len(target_employee.face_embeddings)
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class DeleteEmployeeDataView(APIView):
    """
    Delete employee's model and images
    POST /api/v1/attendance/delete-employee-data/
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        from django.conf import settings
        import shutil
        
        org_code = request.data.get('org_code', '').upper().strip()
        employee_id = request.data.get('employee_id', '').strip()
        
        if not org_code or not employee_id:
            return Response({'error': 'org_code and employee_id required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
            employee = Employee.objects.get(organization=org, employee_id=employee_id)
        except (Organization.DoesNotExist, Employee.DoesNotExist):
            return Response({'error': 'Employee not found'}, status=404)
        
        # Delete images from disk
        images_dir = os.path.join(settings.MEDIA_ROOT, 'employee_faces', org_code, employee_id)
        deleted_images = 0
        if os.path.exists(images_dir):
            deleted_images = len(os.listdir(images_dir))
            shutil.rmtree(images_dir)
        
        # Reset employee model data
        employee.face_embeddings = []
        employee.captured_embeddings = []
        employee.face_enrolled = False
        employee.image_count = 0
        employee.image_status = 'pending'
        employee.training_mode = ''
        employee.last_trained_at = None
        employee.save()
        
        return Response({
            'success': True,
            'message': f'Deleted {deleted_images} images and reset model for {employee.full_name}',
            'deleted_images': deleted_images
        })


class TrainingStatusView(APIView):
    """
    Get training status for organization
    GET /api/v1/attendance/training-status/?org_code=X
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        org_code = request.query_params.get('org_code', '').upper().strip()
        
        if not org_code:
            return Response({'error': 'org_code required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        employees = Employee.objects.filter(organization=org, status='active')
        
        employee_stats = []
        total_images = 0
        pending_count = 0
        captured_count = 0
        trained_count = 0
        light_trained_count = 0
        heavy_trained_count = 0
        
        for emp in employees:
            total_images += emp.image_count
            
            if emp.image_status == 'pending':
                pending_count += 1
            elif emp.image_status in ['captured', 'approved']:
                captured_count += 1
            elif emp.image_status == 'trained':
                trained_count += 1
            
            # Track dual model counts
            if getattr(emp, 'light_trained', False):
                light_trained_count += 1
            if getattr(emp, 'heavy_trained', False):
                heavy_trained_count += 1
            
            employee_stats.append({
                'id': str(emp.id),
                'employee_id': emp.employee_id,
                'name': emp.full_name,
                'department': emp.department,
                'image_count': emp.image_count,
                'image_status': emp.image_status,
                'ready_for_heavy': emp.image_count >= 100,
                'face_enrolled': emp.face_enrolled,
                'training_mode': emp.training_mode,
                'last_trained_at': emp.last_trained_at,
                # DUAL MODEL STATUS
                'light_trained': getattr(emp, 'light_trained', False),
                'light_trained_at': getattr(emp, 'light_trained_at', None),
                'light_accuracy': getattr(emp, 'light_accuracy', None),
                'heavy_trained': getattr(emp, 'heavy_trained', False),
                'heavy_trained_at': getattr(emp, 'heavy_trained_at', None),
                'heavy_accuracy': getattr(emp, 'heavy_accuracy', None),
            })
        
        return Response({
            'organization': org.name,
            'org_code': org.org_code,
            'total_employees': employees.count(),
            'total_images': total_images,
            'pending_capture': pending_count,
            'awaiting_training': captured_count,
            'trained': trained_count,
            'light_trained': light_trained_count,
            'heavy_trained': heavy_trained_count,
            'employees': employee_stats
        })


class CheckInView(APIView):
    """
    Face-based check-in
    POST /api/v1/attendance/checkin/
    """
    parser_classes = [MultiPartParser]
    permission_classes = [AllowAny]
    
    def post(self, request):
        org_code = request.data.get('org_code', '').upper().strip()
        image = request.FILES.get('image')
        
        if not org_code:
            return Response({'error': 'org_code required'}, status=400)
        
        if not image:
            return Response({'error': 'Image required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        try:
            from apps.faces.deepface_service import get_deepface_service
            service = get_deepface_service()
            
            # Save temp image
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as f:
                for chunk in image.chunks():
                    f.write(chunk)
                temp_path = f.name
            
            # Get embedding for query
            query_embedding = service.get_embedding(temp_path)
            os.unlink(temp_path)
            
            if query_embedding is None:
                return Response({'error': 'No face detected'}, status=400)
            
            query_embedding = np.array(query_embedding)
            
            # Find matching employee
            employees = Employee.objects.filter(organization=org, face_enrolled=True, status='active')
            
            best_match = None
            best_distance = float('inf')
            
            for emp in employees:
                for stored in (emp.face_embeddings or []):
                    stored = np.array(stored)
                    distance = 1 - np.dot(query_embedding, stored) / (
                        np.linalg.norm(query_embedding) * np.linalg.norm(stored)
                    )
                    if distance < best_distance:
                        best_distance = distance
                        best_match = emp
            
            if best_match is None or best_distance > 0.4:
                return Response({
                    'success': False,
                    'message': 'Face not recognized. Please try again.'
                }, status=400)
            
            # Create/update attendance record
            today = date.today()
            record, created = AttendanceRecord.objects.get_or_create(
                organization=org,
                employee=best_match,
                date=today,
                defaults={'check_in': timezone.now(), 'check_in_confidence': 1 - best_distance}
            )
            
            if not created and record.check_in:
                return Response({
                    'success': True,
                    'already_checked_in': True,
                    'employee': best_match.full_name,
                    'check_in_time': record.check_in.strftime('%H:%M')
                })
            
            record.check_in = timezone.now()
            record.check_in_confidence = 1 - best_distance
            record.save()
            
            return Response({
                'success': True,
                'employee': best_match.full_name,
                'employee_id': best_match.employee_id,
                'check_in_time': record.check_in.strftime('%H:%M'),
                'confidence': round((1 - best_distance) * 100, 1)
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class CheckOutView(APIView):
    """
    Face-based check-out
    POST /api/v1/attendance/checkout/
    """
    parser_classes = [MultiPartParser]
    permission_classes = [AllowAny]
    
    def post(self, request):
        org_code = request.data.get('org_code', '').upper().strip()
        image = request.FILES.get('image')
        
        if not org_code or not image:
            return Response({'error': 'org_code and image required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        try:
            from apps.faces.deepface_service import get_deepface_service
            service = get_deepface_service()
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as f:
                for chunk in image.chunks():
                    f.write(chunk)
                temp_path = f.name
            
            query_embedding = service.get_embedding(temp_path)
            os.unlink(temp_path)
            
            if query_embedding is None:
                return Response({'error': 'No face detected'}, status=400)
            
            query_embedding = np.array(query_embedding)
            
            employees = Employee.objects.filter(organization=org, face_enrolled=True, status='active')
            
            best_match = None
            best_distance = float('inf')
            
            for emp in employees:
                for stored in (emp.face_embeddings or []):
                    stored = np.array(stored)
                    distance = 1 - np.dot(query_embedding, stored) / (
                        np.linalg.norm(query_embedding) * np.linalg.norm(stored)
                    )
                    if distance < best_distance:
                        best_distance = distance
                        best_match = emp
            
            if best_match is None or best_distance > 0.4:
                return Response({'success': False, 'message': 'Face not recognized'}, status=400)
            
            today = date.today()
            try:
                record = AttendanceRecord.objects.get(organization=org, employee=best_match, date=today)
            except AttendanceRecord.DoesNotExist:
                return Response({'error': 'No check-in record found for today'}, status=400)
            
            record.check_out = timezone.now()
            record.check_out_confidence = 1 - best_distance
            record.calculate_work_duration()
            
            return Response({
                'success': True,
                'employee': best_match.full_name,
                'check_in_time': record.check_in.strftime('%H:%M') if record.check_in else None,
                'check_out_time': record.check_out.strftime('%H:%M'),
                'work_duration': str(record.work_duration).split('.')[0] if record.work_duration else None
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class EmployeeViewSet(viewsets.ModelViewSet):
    """
    CRUD for employees
    """
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            # Defer large JSON fields to avoid MySQL memory issues
            return Employee.objects.filter(
                organization_id=org_id, 
                status='active'
            ).defer('face_embeddings', 'captured_embeddings').order_by('employee_id')
        return Employee.objects.none()
    
    def list(self, request):
        queryset = self.get_queryset()
        employees = [{
            'id': str(e.id),
            'employee_id': e.employee_id,
            'name': e.full_name,
            'first_name': e.first_name,
            'last_name': e.last_name,
            'department': e.department,
            'password': e.password,  # Show password to admin
            'face_enrolled': e.face_enrolled,
            'image_count': e.image_count,
            'image_status': e.image_status
        } for e in queryset]
        return Response({'employees': employees})
    
    def create(self, request):
        import random
        import string
        
        org_id = request.data.get('organization_id')
        
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        # Generate random 6-digit password
        password = ''.join(random.choices(string.digits, k=6))
        
        emp = Employee.objects.create(
            organization=org,
            employee_id=request.data.get('employee_id'),
            first_name=request.data.get('first_name'),
            last_name=request.data.get('last_name'),
            department=request.data.get('department', ''),
            email=request.data.get('email', ''),
            phone=request.data.get('phone', ''),
            password=password
        )
        
        return Response({
            'id': str(emp.id),
            'name': emp.full_name,
            'employee_id': emp.employee_id,
            'password': password  # Show password once for admin to share
        }, status=201)


class AttendanceRecordViewSet(viewsets.ModelViewSet):
    """
    Attendance records
    """
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            return AttendanceRecord.objects.filter(organization_id=org_id).select_related('employee')
        return AttendanceRecord.objects.none()
    
    def list(self, request):
        """Return attendance records as JSON"""
        queryset = self.get_queryset().order_by('-date', '-check_in')[:100]  # Limit to 100 records
        records = []
        for r in queryset:
            records.append({
                'id': str(r.id),
                'employee_id': r.employee.employee_id if r.employee else None,
                'employee_name': r.employee.full_name if r.employee else None,
                'date': str(r.date),
                'check_in': r.check_in.isoformat() if r.check_in else None,
                'check_out': r.check_out.isoformat() if r.check_out else None,
                'work_duration': str(r.work_duration) if r.work_duration else None,
            })
        return Response({'records': records})
    
    @action(detail=False, methods=['get'])
    def today_summary(self, request):
        org_id = request.query_params.get('organization_id')
        if not org_id:
            return Response({'error': 'organization_id required'}, status=400)
        
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        today = date.today()
        total = org.employee_count
        present = AttendanceRecord.objects.filter(organization=org, date=today, check_in__isnull=False).count()
        
        return Response({
            'total_employees': total,
            'present': present,
            'absent': total - present,
            'late': 0
        })


class OrganizationViewSet(viewsets.ModelViewSet):
    """
    Organization CRUD
    """
    permission_classes = [AllowAny]
    queryset = Organization.objects.filter(is_active=True)
    
    def list(self, request):
        orgs = [{
            'id': str(o.id),
            'org_code': o.org_code,
            'name': o.name,
            'plan': o.plan,
            'employee_count': o.employee_count
        } for o in self.queryset]
        return Response({'organizations': orgs})
    
    def create(self, request):
        name = request.data.get('name')
        org_code = request.data.get('org_code', '').upper().strip()
        password = request.data.get('password', '1234')
        
        if not name or not org_code:
            return Response({'error': 'name and org_code required'}, status=400)
        
        if Organization.objects.filter(org_code=org_code).exists():
            return Response({'error': 'Organization code already exists'}, status=400)
        
        slug = name.lower().replace(' ', '-')
        
        org = Organization.objects.create(
            name=name,
            org_code=org_code,
            password=password,
            slug=slug,
            email=request.data.get('email', ''),
            phone=request.data.get('phone', ''),
            address=request.data.get('address', '')
        )
        
        return Response({
            'id': str(org.id),
            'org_code': org.org_code,
            'name': org.name,
            'password': org.password,
            'message': f'Organization created!'
        }, status=201)


class EnrollFaceView(APIView):
    """Legacy endpoint - redirect to new capture flow"""
    parser_classes = [MultiPartParser]
    permission_classes = [AllowAny]
    
    def post(self, request, employee_id):
        return Response({
            'error': 'Please use /capture-images/ endpoint instead'
        }, status=400)


class EmployeeImagesView(APIView):
    """
    Get all captured images for an employee
    GET /api/v1/attendance/employee-images/?org_code=X&employee_id=Y
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        from django.conf import settings
        
        org_code = request.query_params.get('org_code', '').upper().strip()
        employee_id = request.query_params.get('employee_id', '').strip()
        
        if not org_code or not employee_id:
            return Response({'error': 'org_code and employee_id required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
            employee = Employee.objects.get(organization=org, employee_id=employee_id)
        except (Organization.DoesNotExist, Employee.DoesNotExist):
            return Response({'error': 'Employee not found'}, status=404)
        
        # Get images from disk
        images_dir = os.path.join(settings.MEDIA_ROOT, 'employee_faces', org_code, employee_id)
        images = []
        
        if os.path.exists(images_dir):
            for filename in sorted(os.listdir(images_dir)):
                if filename.endswith(('.jpg', '.jpeg', '.png')):
                    images.append({
                        'filename': filename,
                        'url': f'/media/employee_faces/{org_code}/{employee_id}/{filename}'
                    })
        
        return Response({
            'employee': {
                'id': str(employee.id),
                'employee_id': employee.employee_id,
                'name': employee.full_name,
                'department': employee.department,
                'image_count': employee.image_count,
                'image_status': employee.image_status,
                'face_enrolled': employee.face_enrolled
            },
            'images': images,
            'total': len(images)
        })


class UpdateOrgSettingsView(APIView):
    """
    Update organization settings (recognition mode, etc.)
    POST /api/v1/attendance/update-settings/
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        org_code = request.data.get('org_code', '').upper().strip()
        recognition_mode = request.data.get('recognition_mode', '').lower().strip()
        
        if not org_code:
            return Response({'error': 'org_code required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        # Update settings
        if recognition_mode in ['light', 'heavy']:
            org.recognition_mode = recognition_mode
            org.save()
        
        return Response({
            'success': True,
            'message': f'Recognition mode set to {org.recognition_mode}',
            'recognition_mode': org.recognition_mode
        })


class TrainSingleEmployeeView(APIView):
    """
    Train model for a SINGLE employee (instead of all)
    POST /api/v1/attendance/train-employee/
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        from django.conf import settings as django_settings
        
        org_code = request.data.get('org_code', '').upper().strip()
        employee_id = request.data.get('employee_id', '').strip()
        mode = request.data.get('mode', 'light').lower()
        
        if not org_code or not employee_id:
            return Response({'error': 'org_code and employee_id required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        try:
            emp = Employee.objects.get(organization=org, employee_id=employee_id)
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found'}, status=404)
        
        if mode == 'heavy':
            # Heavy mode: Re-process images with DeepFace
            from apps.faces.deepface_service import get_deepface_service
            service = get_deepface_service()
            
            images_dir = os.path.join(django_settings.MEDIA_ROOT, 'employee_faces', org_code, employee_id)
            
            if not os.path.exists(images_dir):
                return Response({'error': 'No images found for this employee'}, status=400)
            
            deep_embeddings = []
            for filename in os.listdir(images_dir):
                if filename.endswith(('.jpg', '.jpeg', '.png')):
                    img_path = os.path.join(images_dir, filename)
                    embedding = service.get_embedding(img_path)
                    if embedding is not None:
                        deep_embeddings.append(list(embedding))
            
            if len(deep_embeddings) < 3:
                return Response({'error': f'Need at least 3 images, found {len(deep_embeddings)}'}, status=400)
            
            # Store in heavy model fields
            emp.heavy_embeddings = deep_embeddings
            emp.heavy_trained = True
            emp.heavy_trained_at = timezone.now()
            emp.face_embeddings = deep_embeddings
            emp.training_mode = 'heavy'
            emp.face_enrolled = True
            emp.image_status = 'trained'
            emp.last_trained_at = timezone.now()
            emp.save()
            
            return Response({
                'success': True,
                'message': f'{emp.full_name} trained with Heavy (DeepFace) model!',
                'embeddings_count': len(deep_embeddings),
                'mode': 'heavy'
            })
        else:
            # Light mode: Use captured embeddings
            embeddings = emp.captured_embeddings or []
            
            if len(embeddings) < 3:
                return Response({'error': f'Need at least 3 embeddings, found {len(embeddings)}'}, status=400)
            
            # Store in light model fields
            emp.light_embeddings = embeddings
            emp.light_trained = True
            emp.light_trained_at = timezone.now()
            emp.face_embeddings = embeddings
            emp.training_mode = 'light'
            emp.face_enrolled = True
            emp.image_status = 'trained'
            emp.last_trained_at = timezone.now()
            emp.save()
            
            return Response({
                'success': True,
                'message': f'{emp.full_name} trained with Light model!',
                'embeddings_count': len(embeddings),
                'mode': 'light'
            })

