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

from core.models import Organization, SaaSEmployee as Employee, SaaSAttendance as AttendanceRecord, Trip, Area, Ward, Route
from django.db.models import Q


class OrganizationListView(APIView):
    """
    Public API to fetch all active organizations.
    Used for employee login organization selection.
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        orgs = Organization.objects.filter(is_active=True).values(
            'id', 'org_code', 'name', 'logo'
        ).order_by('name')
        
        return Response({
            'success': True,
            'organizations': list(orgs)
        })


class AreaListView(APIView):
    """
    Get all areas for a specific organization.
    Used by driver login and admin interface.
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        org_code = request.GET.get('org_code')
        organization_id = request.GET.get('organization_id')
        
        if not org_code and not organization_id:
            return Response({'error': 'org_code or organization_id required'}, status=400)
        
        try:
            if organization_id:
                org = Organization.objects.get(id=organization_id, is_active=True)
            else:
                org = Organization.objects.get(org_code=org_code, is_active=True)
            areas = Area.objects.filter(
                organization=org,
                is_active=True
            ).values('id', 'code', 'name', 'name_hindi').order_by('name')
            
            # Add ward count to each area
            areas_list = list(areas)
            for area in areas_list:
                area['ward_count'] = Ward.objects.filter(area_id=area['id']).count()
            
            return Response({
                'success': True,
                'areas': areas_list
            })
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)


class WardListView(APIView):
    """
    Get all wards for a specific area.
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        area_id = request.GET.get('area_id')
        if not area_id:
            return Response({'error': 'area_id required'}, status=400)
        
        try:
            wards = Ward.objects.filter(
                area_id=area_id,
                is_active=True
            ).values('id', 'number', 'name', 'name_hindi').order_by('number')
            
            # Add route count to each ward
            wards_list = list(wards)
            for ward in wards_list:
                ward['route_count'] = Route.objects.filter(ward_id=ward['id']).count()
            
            return Response({
                'success': True,
                'wards': wards_list
            })
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class RouteListView(APIView):
    """
    Get all routes for a specific ward.
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        ward_id = request.GET.get('ward_id')
        if not ward_id:
            return Response({'error': 'ward_id required'}, status=400)
        
        try:
            routes = Route.objects.filter(
                ward_id=ward_id,
                is_active=True
            ).values(
                'id', 'code', 'name', 'name_hindi',
                'distance_km', 'estimated_duration_hours'
            ).order_by('code')
            
            return Response({
                'success': True,
                'routes': list(routes)
            })
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class CheckEmployeeIDView(APIView):
    """
    Check if an employee ID exists and return their Organization.
    Used for ID-First Login Flow.
    POST /api/v1/attendance/check-employee-id/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        employee_id = request.data.get('employee_id', '').strip()
        if not employee_id:
            return Response({'error': 'Employee ID required'}, status=400)

        matches = Employee.objects.filter(
            employee_id=employee_id, 
            status='active',
            organization__is_active=True
        ).select_related('organization')

        if not matches.exists():
            return Response({'exists': False, 'error': 'ID not found'}, status=404)

        results = []
        for emp in matches:
            # Check for active trip (Duty ON) - ANY incomplete trip
            active_trip = Trip.objects.filter(
                Q(driver=emp) | Q(helper=emp),
                organization=emp.organization
            ).exclude(status='completed').first()
            
            is_active_duty = False
            trip_data = None
            route_data = None
            
            if active_trip:
                is_active_duty = True
                if active_trip.route:
                    route_data = {
                        'id': active_trip.route.id,
                        'name': active_trip.route.name,
                        'code': active_trip.route.code
                    }
                trip_data = {
                    'id': str(active_trip.id),
                    'start_time': active_trip.checkin_time.isoformat() if active_trip.checkin_time else None
                }

            results.append({
                'employee_name': emp.full_name,
                'employee_id': emp.employee_id,
                'org_code': emp.organization.org_code,
                'org_name': emp.organization.name,
                'designation': emp.designation,
                # Active Duty Fields for Auto-Login
                'is_active_duty': is_active_duty,
                'trip': trip_data,
                'route': route_data,
                # Full details for session storage
                'full_details': {
                   'id': str(emp.id),
                   'employee_id': emp.employee_id,
                   'name': emp.full_name,
                   'department': emp.department,
                   'designation': emp.designation,
                   'face_enrolled': emp.face_enrolled,
                   'image_count': emp.image_count,
                   'image_status': emp.image_status,
                   'org_code': emp.organization.org_code,
                   'org_name': emp.organization.name
                }
            })
            
        return Response({
            'exists': True,
            'count': len(results),
            'matches': results
        })


class RootAdminLoginView(APIView):
    """
    Root admin login - manage all organizations.
    """
    permission_classes = [AllowAny]
    throttle_classes = []  # Disable throttling for admin login
    
    def post(self, request):
        from django.contrib.auth import authenticate
        from apps.users.models import User
        
        username = request.data.get('username', '').strip()  # Can be email or name
        password = request.data.get('password', '')
        
        if not username or not password:
            return Response({'error': 'Username/Email and password required'}, status=400)
        
        # Try to authenticate with email (USERNAME_FIELD)
        user = authenticate(request, email=username, password=password)
        
        # If that fails, try to find user by email and check password manually
        if not user:
            try:
                user = User.objects.get(email=username)
                if user.check_password(password) and (user.is_staff or user.is_superuser):
                    # Manually authenticate worked
                    pass
                else:
                    user = None
            except User.DoesNotExist:
                user = None
        
        if user and (user.is_staff or user.is_superuser):
            return Response({
                'success': True,
                'admin': {
                    'id': str(user.id),
                    'username': user.email,  # Return email as username
                    'name': user.name,
                    'is_superuser': user.is_superuser,
                    'is_staff': user.is_staff
                }
            })
        else:
            return Response(
                {'error': 'Invalid credentials or insufficient permissions'},
                status=401
            )



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
                'recognition_mode': org.recognition_mode,  # light or heavy
                'attendance_mode': org.attendance_mode,
                'compliance_enforcement': org.compliance_enforcement
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


class GetOrgSettingsView(APIView):
    """
    Get org settings (for Kiosk to refresh recognition_mode without password)
    GET /api/v1/attendance/org-settings/?org_code=XXX
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        org_code = request.GET.get('org_code', '').upper().strip()
        
        if not org_code:
            return Response({'error': 'org_code required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        return Response({
            'success': True,
            'organization': {
                'id': str(org.id),
                'org_code': org.org_code,
                'name': org.name,
                'recognition_mode': org.recognition_mode,
                'attendance_mode': org.attendance_mode,
                'compliance_enforcement': org.compliance_enforcement
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
        # password = request.data.get('password', '').strip() # Removed

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
        
        # Password validation removed per user request (relying on Face Auth for critical actions)
        # if employee.password != password:
        #     return Response({'error': 'Invalid password'}, status=401)
        
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
        from django.utils.timezone import localtime
        thirty_days_ago = date.today() - timedelta(days=30)
        records = AttendanceRecord.objects.filter(
            employee=employee,
            date__gte=thirty_days_ago
        ).order_by('-date')[:30]
        
        attendance_list = [{
            'date': r.date.strftime('%Y-%m-%d'),
            'check_in': localtime(r.check_in).strftime('%H:%M') if r.check_in else None,
            'check_out': localtime(r.check_out).strftime('%H:%M') if r.check_out else None,
            'status': r.status
        } for r in records]
        
        # Get Trips (Trip workflow) - last 30 days
        trips = Trip.objects.filter(
            Q(driver=employee) | Q(helper=employee),
            date__gte=thirty_days_ago
        ).order_by('-date', '-checkin_time')
        
        for t in trips:
            # Determine status based on trip status
            status = 'present'
            if t.status == 'incomplete': status = 'absent'
            
            attendance_list.append({
                'date': t.date.strftime('%Y-%m-%d'),
                'check_in': localtime(t.checkin_time).strftime('%H:%M') if t.checkin_time else None,
                'check_out': localtime(t.checkout_time).strftime('%H:%M') if t.checkout_time else None,
                'status': status
            })
            
        # Sort combined list by date desc
        attendance_list.sort(key=lambda x: x['date'], reverse=True)
        
        # Today's status (or CURRENT active status regardless of date)
        today = date.today()
        today_record = AttendanceRecord.objects.filter(employee=employee, date=today).first()
        
        # Check Trip model (prioritize Trip over legacy Record)
        # Find ANY active trip (not completed) for this employee (Driver OR Helper)
        # We generally expect only one active trip at a time per person.
        today_trip = Trip.objects.filter(
            Q(driver=employee) | Q(helper=employee),
            organization=org
        ).exclude(status='completed').first() # Get active trip

        # If no active, check for completed (latest check-out)
        if not today_trip:
            today_trip = Trip.objects.filter(
                organization=org, 
                driver=employee, 
                date=today,
                status='completed'
            ).order_by('-checkout_time').first()
        
        # Determine Check-in/out times (convert to local timezone)
        from django.utils.timezone import localtime
        check_in_time = None
        check_out_time = None

        if today_trip:
            check_in_time = localtime(today_trip.checkin_time).strftime('%H:%M') if today_trip.checkin_time else None
            check_out_time = localtime(today_trip.checkout_time).strftime('%H:%M') if today_trip.checkout_time else None
        elif today_record:
            check_in_time = localtime(today_record.check_in).strftime('%H:%M') if today_record.check_in else None
            check_out_time = localtime(today_record.check_out).strftime('%H:%M') if today_record.check_out else None

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
                'checked_in': check_in_time,
                'checked_out': check_out_time
            },
            'attendance': attendance_list
        })


class CaptureImagesView(APIView):
    """
    Employee captures face images - saves for admin review
    Stores BOTH:
    - 128-d embeddings from frontend (face-api.js) in captured_embeddings_light
    - 512-d embeddings from backend (DeepFace) in captured_embeddings
    
    POST: images + optional light_embeddings (128-d from face-api.js)
    Saves:
    1. Image files to disk (for admin to view)
    2. Both embeddings to database (for training)
    """
    parser_classes = [MultiPartParser]
    permission_classes = [AllowAny]
    
    def post(self, request):
        org_code = request.data.get('org_code', '').upper().strip()
        employee_id = request.data.get('employee_id', '').strip()
        images = request.FILES.getlist('images')
        # NEW: Accept 128-d embeddings from frontend (face-api.js)
        light_embeddings_json = request.data.get('light_embeddings', '[]')
        
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
            import json
            
            service = get_deepface_service()
            
            # Parse light embeddings from frontend
            try:
                frontend_light_embeddings = json.loads(light_embeddings_json) if isinstance(light_embeddings_json, str) else light_embeddings_json
            except:
                frontend_light_embeddings = []
            
            # Create directory for employee images
            images_dir = os.path.join(settings.MEDIA_ROOT, 'employee_faces', org_code, employee_id)
            os.makedirs(images_dir, exist_ok=True)
            try:
                os.chmod(images_dir, 0o755)  # Ensure directory is readable/executable by others (Nginx)
            except Exception as e:
                print(f"Warning: Could not chmod directory: {e}")
            
            new_heavy_embeddings = []  # 512-d from DeepFace
            faces_detected = 0
            current_count = employee.image_count or 0
            
            for idx, img in enumerate(images):
                with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as f:
                    for chunk in img.chunks():
                        f.write(chunk)
                    temp_path = f.name
                
                # Generate 512-d embedding with DeepFace
                embedding = service.get_embedding(temp_path)
                if embedding is not None:
                    new_heavy_embeddings.append(list(embedding))
                    faces_detected += 1
                    
                    # Save image to permanent location
                    img_filename = f"{current_count + faces_detected:04d}.jpg"
                    img_path = os.path.join(images_dir, img_filename)
                    shutil.copy(temp_path, img_path)
                    try:
                        os.chmod(img_path, 0o644) # Ensure file is readable by others (Nginx)
                    except Exception as e:
                        print(f"Warning: Could not chmod file: {e}")
                
                os.unlink(temp_path)
            
            if faces_detected == 0:
                return Response({'error': 'No faces detected. Please ensure good lighting and face visibility.'}, status=400)
            
            # Store 512-d embeddings (for heavy model)
            current_heavy = employee.captured_embeddings or []
            current_heavy.extend(new_heavy_embeddings)
            employee.captured_embeddings = current_heavy
            
            # Store 128-d embeddings (for light model) - from frontend
            if frontend_light_embeddings:
                current_light = employee.captured_embeddings_light or []
                current_light.extend(frontend_light_embeddings)
                employee.captured_embeddings_light = current_light
            
            employee.image_count = len(current_heavy)
            employee.image_status = 'captured'
            employee.save()
            
            return Response({
                'success': True,
                'message': f'{faces_detected} images saved! Admin will review and train.',
                'images_added': faces_detected,
                'total_images': employee.image_count,
                'light_embeddings_count': len(employee.captured_embeddings_light or []),
                'heavy_embeddings_count': len(employee.captured_embeddings or []),
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
        ).defer(
            'face_embeddings', 'heavy_embeddings', 'light_embeddings',
            'captured_embeddings', 'captured_embeddings_light'
        )
        
        if employees.count() == 0:
            return Response({'error': 'No employees with images to train'}, status=400)
        
        trained_count = 0
        total_embeddings = 0
        
        # Import ChromaDB service
        from services.vector_db import vector_db
        
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
                    # Store in ChromaDB for fast similarity search
                    vector_db.add_embeddings(
                        org_code=org_code,
                        model_type='heavy',
                        employee_id=emp.employee_id,
                        embeddings=deep_embeddings,
                        employee_name=emp.full_name
                    )
                    
                    # Update employee status (keep embeddings in MySQL as backup)
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
            # LIGHT MODE: Use 128-d embeddings from face-api.js (frontend capture)
            for emp in employees:
                # Use 128-d face-api.js embeddings for light model
                embeddings = emp.captured_embeddings_light or []
                
                # Fallback: if no light embeddings, skip this employee for light training
                if len(embeddings) < 3:
                    continue
                
                # Store in ChromaDB for fast similarity search
                vector_db.add_embeddings(
                    org_code=org_code,
                    model_type='light',
                    employee_id=emp.employee_id,
                    embeddings=embeddings,
                    employee_name=emp.full_name
                )
                
                # Store in LIGHT model fields (128-d embeddings) - keep as backup
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
        
        model_name = 'DeepFace/ArcFace (512-d)' if mode == 'heavy' else 'face-api.js (128-d)'
        
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
            
            # Check dimension compatibility
            stored_sample = np.array(target_employee.face_embeddings[0])
            if len(test_embedding) != len(stored_sample):
                return Response({
                    'error': f'Embedding dimension mismatch! Test image: {len(test_embedding)}d, Stored: {len(stored_sample)}d. Please RETRAIN this employee with the current model.',
                    'test_dim': len(test_embedding),
                    'stored_dim': len(stored_sample),
                    'solution': 'Click the Train button to retrain with InsightFace (512d)'
                }, status=400)
            
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
                    
                    # Skip if dimension mismatch (old vs new model)
                    if len(stored) != len(test_embedding):
                        continue
                    
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
        
        employees = Employee.objects.filter(organization=org, status='active').defer(
            'face_embeddings', 'heavy_embeddings', 'light_embeddings',
            'captured_embeddings', 'captured_embeddings_light'
        )
        
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
                # EMBEDDING COUNTS (Optimized: Don't load blobs for list view)
                'face_embeddings_count': 0, # len(emp.face_embeddings or []),
                'light_embeddings_count': 0, # len(emp.light_embeddings or []),
                'heavy_embeddings_count': 0, # len(emp.heavy_embeddings or []),
                'captured_light_count': 0, # len(emp.captured_embeddings_light or []),
                'captured_heavy_count': 0, # len(emp.captured_embeddings or []),
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
            
            # Use ChromaDB for fast vector search
            from services.vector_db import vector_db
            
            # Try heavy model first (512-d), then light model (128-d)
            match_result = vector_db.find_best_match(
                org_code=org_code,
                model_type='heavy',
                query_embedding=query_embedding.tolist(),
                min_confidence=0.6
            )
            
            if not match_result:
                # No match in heavy, this could also be a dimension mismatch - skip light for 512-d
                pass
            
            best_match = None
            best_confidence = 0
            
            if match_result:
                employee_id, confidence, employee_name = match_result
                try:
                    best_match = Employee.objects.get(
                        organization=org, 
                        employee_id=employee_id, 
                        status='active'
                    )
                    best_confidence = confidence / 100  # Convert to 0-1
                except Employee.DoesNotExist:
                    pass
            
            # Fallback to MySQL-based search if ChromaDB fails
            if best_match is None:
                employees = Employee.objects.filter(organization=org, face_enrolled=True, status='active')
                best_distance = float('inf')
                
                for emp in employees:
                    for stored in (emp.face_embeddings or []):
                        stored = np.array(stored)
                        if len(stored) != len(query_embedding):
                            continue  # Skip dimension mismatch
                        distance = 1 - np.dot(query_embedding, stored) / (
                            np.linalg.norm(query_embedding) * np.linalg.norm(stored)
                        )
                        if distance < best_distance:
                            best_distance = distance
                            best_match = emp
                            best_confidence = 1 - distance
                
                if best_distance > 0.4:
                    best_match = None
            
            if best_match is None:
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
                defaults={'check_in': timezone.now(), 'check_in_confidence': best_confidence}
            )
            
            if not created and record.check_in:
                return Response({
                    'success': True,
                    'already_checked_in': True,
                    'employee': best_match.full_name,
                    'check_in_time': record.check_in.strftime('%H:%M')
                })
            
            record.check_in = timezone.now()
            record.check_in_confidence = best_confidence
            record.save()
            
            return Response({
                'success': True,
                'employee': best_match.full_name,
                'employee_id': best_match.employee_id,
                'check_in_time': record.check_in.strftime('%H:%M'),
                'confidence': round(best_confidence * 100, 1)
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
            
            # Use ChromaDB for fast vector search
            from services.vector_db import vector_db
            
            match_result = vector_db.find_best_match(
                org_code=org_code,
                model_type='heavy',
                query_embedding=query_embedding.tolist(),
                min_confidence=0.6
            )
            
            best_match = None
            best_confidence = 0
            
            if match_result:
                employee_id, confidence, employee_name = match_result
                try:
                    best_match = Employee.objects.get(
                        organization=org, 
                        employee_id=employee_id, 
                        status='active'
                    )
                    best_confidence = confidence / 100
                except Employee.DoesNotExist:
                    pass
            
            # Fallback to MySQL-based search if ChromaDB fails
            if best_match is None:
                employees = Employee.objects.filter(organization=org, face_enrolled=True, status='active')
                best_distance = float('inf')
                
                for emp in employees:
                    for stored in (emp.face_embeddings or []):
                        stored = np.array(stored)
                        if len(stored) != len(query_embedding):
                            continue
                        distance = 1 - np.dot(query_embedding, stored) / (
                            np.linalg.norm(query_embedding) * np.linalg.norm(stored)
                        )
                        if distance < best_distance:
                            best_distance = distance
                            best_match = emp
                            best_confidence = 1 - distance
                
                if best_distance > 0.4:
                    best_match = None
            
            if best_match is None:
                return Response({'success': False, 'message': 'Face not recognized'}, status=400)
            
            today = date.today()
            try:
                record = AttendanceRecord.objects.get(organization=org, employee=best_match, date=today)
            except AttendanceRecord.DoesNotExist:
                return Response({'error': 'No check-in record found for today'}, status=400)
            
            record.check_out = timezone.now()
            record.check_out_confidence = best_confidence
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
            'role': e.role,  # Add role field
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
            role=request.data.get('role', 'driver'),
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
                'face_enrolled': employee.face_enrolled,
                'training_mode': employee.training_mode,
                # Add counts back here (fast for single employee)
                'face_embeddings_count': len(employee.face_embeddings or []),
                'light_embeddings_count': len(employee.light_embeddings or []),
                'heavy_embeddings_count': len(employee.heavy_embeddings or []),
                'captured_light_count': len(employee.captured_embeddings_light or []),
                'captured_heavy_count': len(employee.captured_embeddings or []),
            },
            'images': images,
            'total': len(images)
        })


class UpdateOrgSettingsView(APIView):
    """
    Update organization settings (recognition mode, attendance mode, compliance)
    POST /api/v1/attendance/update-settings/
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        org_code = request.data.get('org_code', '').upper().strip()
        
        # Get settings from request
        recognition_mode = request.data.get('recognition_mode', '').lower().strip()
        attendance_mode = request.data.get('attendance_mode', '').lower().strip()
        compliance_enforcement = request.data.get('compliance_enforcement', '').lower().strip()
        
        if not org_code:
            return Response({'error': 'org_code required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        # Track changes for message
        changes = []

        # Update Recognition Mode
        if recognition_mode in ['light', 'heavy']:
            org.recognition_mode = recognition_mode
            changes.append(f"Recognition: {recognition_mode}")
            
        # Update Attendance Mode
        if attendance_mode in ['daily', 'continuous']:
            org.attendance_mode = attendance_mode
            changes.append(f"Mode: {attendance_mode}")

        # Update Compliance Enforcement
        if compliance_enforcement in ['block', 'report']:
            org.compliance_enforcement = compliance_enforcement
            changes.append(f"Compliance: {compliance_enforcement}")

        org.save()
        
        return Response({
            'success': True,
            'message': f'Settings updated: {", ".join(changes)}' if changes else 'No changes made',
            'recognition_mode': org.recognition_mode,
            'attendance_mode': org.attendance_mode,
            'compliance_enforcement': org.compliance_enforcement
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
            # Light mode: Re-process images from disk (like Heavy, but uses light embeddings)
            from apps.faces.deepface_service import get_deepface_service
            service = get_deepface_service()
            
            images_dir = os.path.join(django_settings.MEDIA_ROOT, 'employee_faces', org_code, employee_id)
            
            if not os.path.exists(images_dir):
                return Response({'error': 'No images found for this employee'}, status=400)
            
            # Get all image files
            image_files = [f for f in os.listdir(images_dir) if f.endswith(('.jpg', '.jpeg', '.png'))]
            total_images = len(image_files)
            
            print(f"\n{'='*60}")
            print(f"🔄 TRAINING: {emp.full_name} ({employee_id})")
            print(f"{'='*60}")
            print(f"📁 Found {total_images} total images")
            
            # LIMIT: Only process up to 50 images to prevent hanging
            MAX_IMAGES = 50
            if len(image_files) > MAX_IMAGES:
                # Sort and take evenly distributed samples
                image_files = sorted(image_files)
                step = len(image_files) // MAX_IMAGES
                image_files = [image_files[i * step] for i in range(MAX_IMAGES)]
                print(f"⚡ Sampling {MAX_IMAGES} images (every {step}th frame)")
            else:
                print(f"⚡ Processing all {total_images} images")
            
            light_embeddings = []
            print(f"\n🧠 Starting InsightFace embedding generation...")
            
            for idx, filename in enumerate(image_files, 1):
                img_path = os.path.join(images_dir, filename)
                print(f"  [{idx}/{len(image_files)}] Processing {filename}...", end=' ')
                
                # Use same 512d embeddings from DeepFace for light model too
                embedding = service.get_embedding(img_path)
                if embedding is not None:
                    light_embeddings.append(list(embedding))
                    print(f"✅ Face detected")
                else:
                    print(f"❌ No face")
            
            print(f"\n✅ Generated {len(light_embeddings)} embeddings from {len(image_files)} images")
            
            if len(light_embeddings) < 3:
                print(f"❌ ERROR: Need at least 3 images with faces, found {len(light_embeddings)}")
                return Response({'error': f'Need at least 3 images with faces, found {len(light_embeddings)}'}, status=400)
            
            # Store in light model fields
            emp.light_embeddings = light_embeddings
            emp.light_trained = True
            emp.light_trained_at = timezone.now()
            emp.face_embeddings = light_embeddings
            emp.training_mode = 'light'
            emp.face_enrolled = True
            emp.image_status = 'trained'
            emp.last_trained_at = timezone.now()
            emp.save()
            
            print(f"💾 Saved {len(light_embeddings)} embeddings to database")
            print(f"{'='*60}\n")
            
            return Response({
                'success': True,
                'message': f'{emp.full_name} trained with Light model ({len(light_embeddings)} embeddings from {total_images} total images)!',
                'embeddings_count': len(light_embeddings),
                'total_images': total_images,
                'processed_images': len(image_files),
                'mode': 'light'
            })


class GetEmployeeEmbeddingsView(APIView):
    """
    Get embeddings for employees for real-time face matching in Kiosk.
    
    Parameters:
    - org_code: Organization code (required)
    - mode: 'light' or 'heavy' - determines which embeddings to return
    - employee_id: Optional - get specific employee
    
    Returns:
    - light mode: 128-d embeddings from light_embeddings (face-api.js compatible)
    - heavy mode: 512-d embeddings from heavy_embeddings (DeepFace)
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        org_code = request.GET.get('org_code', '').upper()
        employee_id = request.GET.get('employee_id', '')
        mode = request.GET.get('mode', 'light').lower()  # Default to light
        
        if not org_code:
            return Response({'error': 'org_code required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        # Determine which embedding field to use
        if mode == 'heavy':
            trained_field = 'heavy_trained'
            embeddings_field = 'heavy_embeddings'
            expected_dim = 512
        else:
            trained_field = 'light_trained'
            embeddings_field = 'light_embeddings'
            expected_dim = 128
        
        # If employee_id provided, get specific employee
        if employee_id:
            try:
                emp = Employee.objects.get(organization=org, employee_id=employee_id)
            except Employee.DoesNotExist:
                return Response({'error': 'Employee not found'}, status=404)
            
            embeddings = getattr(emp, embeddings_field) or []
            
            return Response({
                'success': True,
                'mode': mode,
                'embeddings': embeddings,
                'employee_id': emp.employee_id,
                'name': emp.full_name,
                'trained': getattr(emp, trained_field),
                'embedding_dimension': len(embeddings[0]) if embeddings else 0,
                'expected_dimension': expected_dim
            })
        
        # Get all trained employees for this mode
        filter_kwargs = {
            'organization': org,
            trained_field: True
        }
        employees = Employee.objects.filter(**filter_kwargs)
        
        result = []
        for emp in employees:
            embeddings = getattr(emp, embeddings_field) or []
            if embeddings:
                result.append({
                    'employee_id': emp.employee_id,
                    'name': emp.full_name,
                    'embeddings': embeddings[:5],  # Limit for performance
                    'embedding_dimension': len(embeddings[0]) if embeddings else 0
                })
        
        return Response({
            'success': True,
            'mode': mode,
            'expected_dimension': expected_dim,
            'employees': result,
            'count': len(result)
        })


class AutoCheckinView(APIView):
    """
    Auto check-in endpoint for real-time kiosk.
    Called when face is recognized for 2+ seconds.
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        org_code = request.data.get('org_code', '').upper()
        employee_id = request.data.get('employee_id', '')
        action = request.data.get('action', 'checkin')  # checkin or checkout
        
        if not org_code or not employee_id:
            return Response({'error': 'org_code and employee_id required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
            emp = Employee.objects.get(organization=org, employee_id=employee_id)
        except (Organization.DoesNotExist, Employee.DoesNotExist):
            return Response({'error': 'Organization or employee not found'}, status=404)
        
        now = timezone.now()
        today = now.date()
        
        # Check for existing record today
        existing = AttendanceRecord.objects.filter(
            employee=emp,
            organization=org,
            check_in__date=today
        ).first()
        
        if action == 'checkin':
            if existing:
                return Response({
                    'success': False,
                    'message': f'{emp.full_name} already checked in today at {existing.check_in.strftime("%H:%M")}'
                })
            
            # Create new check-in
            AttendanceRecord.objects.create(
                employee=emp,
                organization=org,
                check_in=now,
                check_in_confidence=95.0
            )
            
            return Response({
                'success': True,
                'message': f'{emp.full_name} checked in!',
                'check_in_time': now.isoformat(),
                'employee': {
                    'name': emp.full_name,
                    'employee_id': emp.employee_id
                }
            })
        else:
            # Check-out
            if not existing:
                return Response({
                    'success': False,
                    'message': f'{emp.full_name} has not checked in today'
                })
            
            if existing.check_out:
                return Response({
                    'success': False,
                    'message': f'{emp.full_name} already checked out at {existing.check_out.strftime("%H:%M")}'
                })
            
            existing.check_out = now
            existing.save()
            
            work_hours = (now - existing.check_in).total_seconds() / 3600
            
            return Response({
                'success': True,
                'message': f'{emp.full_name} checked out!',
                'check_out_time': now.isoformat(),
                'work_hours': round(work_hours, 2),
                'employee': {
                    'name': emp.full_name,
                    'employee_id': emp.employee_id
                }
            })


class EmployeeFaceCheckinView(APIView):
    """
    Employee self check-in with face verification
    POST /api/v1/attendance/employee-face-checkin/
    Verifies the employee's face against their stored embeddings
    """
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser]

    def post(self, request):
        org_code = request.data.get('org_code', '').upper().strip()
        employee_id = request.data.get('employee_id', '').strip()
        action = request.data.get('action', 'checkin')  # checkin or checkout
        image_file = request.FILES.get('image')
        print(org_code, employee_id, action, image_file)

        if not org_code or not employee_id or not image_file:
            return Response({'error': 'org_code, employee_id, and image required'}, status=400)

        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)

        try:
            employee = Employee.objects.get(organization=org, employee_id=employee_id, status='active')
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found'}, status=404)

        if not employee.face_enrolled:
            return Response({'error': 'Face not enrolled. Please enroll your face first.'}, status=400)

        # Get stored embeddings - use face_embeddings (same as kiosk)
        stored_embeddings = employee.face_embeddings or employee.heavy_embeddings
        if not stored_embeddings:
            return Response({'error': 'No face embeddings found. Please train your face model.'}, status=400)

        # Save incoming image temporarily
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
            for chunk in image_file.chunks():
                temp_file.write(chunk)
            temp_path = temp_file.name

        try:
            # Use same service as kiosk for consistency
            from apps.faces.deepface_service import get_deepface_service
            service = get_deepface_service()
            
            query_embedding = service.get_embedding(temp_path)
            
            if query_embedding is None:
                return Response({'error': 'No face detected in image'}, status=400)
            
            query_embedding = np.array(query_embedding)
            print(f"[DEBUG] Query embedding size: {len(query_embedding)}")

            # Compare using COSINE SIMILARITY (same as kiosk CheckInView)
            best_distance = float('inf')
            embedding_count = len(stored_embeddings)
            print(f"[DEBUG] Stored embeddings count: {embedding_count}")
            
            for stored in stored_embeddings:
                stored_arr = np.array(stored)
                # Cosine distance: 1 - cosine_similarity
                dot_product = np.dot(query_embedding, stored_arr)
                norm_product = np.linalg.norm(query_embedding) * np.linalg.norm(stored_arr)
                if norm_product > 0:
                    distance = 1 - (dot_product / norm_product)
                    if distance < best_distance:
                        best_distance = distance
            
            print(f"[DEBUG] Best cosine distance: {best_distance}")

            # Same threshold as kiosk (0.4)
            THRESHOLD = 0.4
            if best_distance > THRESHOLD or best_distance == float('inf'):
                print(f"[FAIL] Face verification failed! distance={best_distance}, threshold={THRESHOLD}")
                return Response({
                    'success': False,
                    'error': f'Face verification failed (distance: {best_distance:.3f}). Try better lighting.',
                    'distance': round(best_distance, 3) if best_distance != float('inf') else None
                }, status=401)

            # Face verified! Now do check-in/checkout
            now = timezone.now()
            today = now.date()

            existing = AttendanceRecord.objects.filter(
                employee=employee,
                organization=org,
                check_in__date=today
            ).first()

            if action == 'checkin':
                if existing:
                    return Response({
                        'success': False,
                        'error': f'Already checked in at {existing.check_in.strftime("%H:%M")}'
                    })

                AttendanceRecord.objects.create(
                    employee=employee,
                    organization=org,
                    check_in=now,
                    check_in_confidence=round((1 - best_distance) * 100, 1)
                )
                
                # Save face image to LoginDetectionResult for display in admin page
                from core.models import LoginDetectionResult
                from django.core.files.base import ContentFile
                import shutil
                
                try:
                    # Read the temp image and save to LoginDetectionResult
                    with open(temp_path, 'rb') as f:
                        image_content = f.read()
                    
                    log_entry = LoginDetectionResult.objects.create(
                        organization=org,
                        employee=employee,
                        face_confidence=round(1 - best_distance, 3),
                        detections={},
                        compliance_passed=True
                    )
                    # Save the image file
                    log_entry.frame_image.save(
                        f'{employee.employee_id}_{now.strftime("%Y%m%d_%H%M%S")}.jpg',
                        ContentFile(image_content),
                        save=True
                    )
                except Exception as save_error:
                    import traceback
                    print(f"[ERROR] Failed to save check-in image: {save_error}")
                    traceback.print_exc()

                return Response({
                    'success': True,
                    'message': f'Checked in at {now.strftime("%H:%M")}!',
                    'time': now.isoformat()
                })
            else:
                # Check-out
                if not existing:
                    return Response({
                        'success': False,
                        'error': 'Not checked in today. Please check in first.'
                    })

                if existing.check_out:
                    return Response({
                        'success': False,
                        'error': f'Already checked out at {existing.check_out.strftime("%H:%M")}'
                    })

                existing.check_out = now
                existing.check_out_confidence = round((1 - best_distance) * 100, 1)
                existing.save()
                
                # Save checkout face image to LoginDetectionResult
                from core.models import LoginDetectionResult
                from django.core.files.base import ContentFile
                
                try:
                    with open(temp_path, 'rb') as f:
                        image_content = f.read()
                    
                    log_entry = LoginDetectionResult.objects.create(
                        organization=org,
                        employee=employee,
                        face_confidence=round(1 - best_distance, 3),
                        detections={},
                        compliance_passed=True
                    )
                    log_entry.frame_image.save(
                        f'{employee.employee_id}_{now.strftime("%Y%m%d_%H%M%S")}_out.jpg',
                        ContentFile(image_content),
                        save=True
                    )
                except Exception as save_error:
                    import traceback
                    print(f"[ERROR] Failed to save check-out image: {save_error}")
                    traceback.print_exc()

                work_hours = (now - existing.check_in).total_seconds() / 3600

                return Response({
                    'success': True,
                    'message': f'Checked out at {now.strftime("%H:%M")}! Worked {work_hours:.1f} hours.',
                    'time': now.isoformat(),
                    'work_hours': round(work_hours, 2)
                })

        except Exception as e:
            return Response({'error': f'Face verification error: {str(e)}'}, status=500)
        finally:
            # Clean up temp file
            import os
            if os.path.exists(temp_path):
                os.remove(temp_path)


class DeleteEmployeeImageView(APIView):
    """
    Delete a single face image for an employee.
    DELETE /api/v1/attendance/delete-image/
    Body: org_code, employee_id, filename
    """
    permission_classes = [AllowAny]
    
    def delete(self, request):
        from django.conf import settings
        
        org_code = request.data.get('org_code', '').upper().strip()
        employee_id = request.data.get('employee_id', '').strip()
        filename = request.data.get('filename', '').strip()
        
        if not org_code or not employee_id or not filename:
            return Response({'error': 'org_code, employee_id, and filename required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
            employee = Employee.objects.get(organization=org, employee_id=employee_id)
        except (Organization.DoesNotExist, Employee.DoesNotExist):
            return Response({'error': 'Employee not found'}, status=404)
        
        # Build file path
        images_dir = os.path.join(settings.MEDIA_ROOT, 'employee_faces', org_code, employee_id)
        file_path = os.path.join(images_dir, filename)
        
        # Security: Ensure the file is within the allowed directory
        if not os.path.abspath(file_path).startswith(os.path.abspath(images_dir)):
            return Response({'error': 'Invalid file path'}, status=400)
        
        if not os.path.exists(file_path):
            return Response({'error': 'File not found'}, status=404)
        
        try:
            os.remove(file_path)
            
            # Update image count
            remaining_images = len([f for f in os.listdir(images_dir) if f.endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(images_dir) else 0
            employee.image_count = remaining_images
            employee.save(update_fields=['image_count', 'updated_at'])
            
            return Response({
                'success': True,
                'message': f'Deleted {filename}',
                'remaining_images': remaining_images
            })
        except Exception as e:
            return Response({'error': f'Failed to delete: {str(e)}'}, status=500)


class ResetEmployeeEmbeddingsView(APIView):
    """
    Clear all ChromaDB embeddings and reset training status for an employee.
    POST /api/v1/attendance/reset-embeddings/
    Body: org_code, employee_id, model_type (light, heavy, all)
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        from services.vector_db import vector_db
        
        org_code = request.data.get('org_code', '').upper().strip()
        employee_id = request.data.get('employee_id', '').strip()
        model_type = request.data.get('model_type', 'all').lower().strip()
        
        if not org_code or not employee_id:
            return Response({'error': 'org_code and employee_id required'}, status=400)
        
        if model_type not in ['light', 'heavy', 'all']:
            return Response({'error': 'model_type must be light, heavy, or all'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
            employee = Employee.objects.get(organization=org, employee_id=employee_id)
        except (Organization.DoesNotExist, Employee.DoesNotExist):
            return Response({'error': 'Employee not found'}, status=404)
        
        models_reset = []
        
        try:
            if model_type in ['light', 'all']:
                vector_db.delete_embeddings(org_code, 'light', employee_id)
                employee.light_embeddings = []
                employee.light_trained = False
                employee.light_trained_at = None
                employee.captured_embeddings_light = []  # Also clear capture buffer
                models_reset.append('light')
            
            if model_type in ['heavy', 'all']:
                vector_db.delete_embeddings(org_code, 'heavy', employee_id)
                employee.heavy_embeddings = []
                employee.heavy_trained = False
                employee.heavy_trained_at = None
                employee.captured_embeddings = []  # Also clear capture buffer
                models_reset.append('heavy')
            
            # If both are reset, mark face as not enrolled
            if model_type == 'all':
                employee.face_enrolled = False
                employee.face_embeddings = []
                employee.training_mode = ''
                employee.image_status = 'captured' if employee.image_count > 0 else 'pending'
            
            employee.save()
            
            return Response({
                'success': True,
                'message': f'Reset {", ".join(models_reset)} embeddings for {employee.full_name}',
                'models_reset': models_reset,
                'face_enrolled': employee.face_enrolled
            })
        except Exception as e:
            return Response({'error': f'Failed to reset: {str(e)}'}, status=500)


class DeleteAllEmployeeImagesView(APIView):
    """
    Delete ALL face images for an employee.
    DELETE /api/v1/attendance/delete-all-images/
    Body: org_code, employee_id
    """
    permission_classes = [AllowAny]
    
    def delete(self, request):
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
        
        images_dir = os.path.join(settings.MEDIA_ROOT, 'employee_faces', org_code, employee_id)
        deleted_count = 0
        
        try:
            if os.path.exists(images_dir):
                # Count images before deleting
                deleted_count = len([f for f in os.listdir(images_dir) if f.endswith(('.jpg', '.jpeg', '.png'))])
                # Remove entire directory
                shutil.rmtree(images_dir)
            
            # Reset employee image count and status
            employee.image_count = 0
            employee.image_status = 'pending'
            employee.save(update_fields=['image_count', 'image_status', 'updated_at'])
            
            return Response({
                'success': True,
                'message': f'Deleted {deleted_count} images for {employee.full_name}',
                'deleted_count': deleted_count
            })
        except Exception as e:
            return Response({'error': f'Failed to delete: {str(e)}'}, status=500)


class GetChromaDBEmbeddingsView(APIView):
    """
    Get all ChromaDB embeddings for an employee.
    GET /api/v1/attendance/chromadb-embeddings/?org_code=X&employee_id=Y
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        from services.vector_db import vector_db
        
        org_code = request.query_params.get('org_code', '').upper().strip()
        employee_id = request.query_params.get('employee_id', '').strip()
        
        if not org_code or not employee_id:
            return Response({'error': 'org_code and employee_id required'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
            employee = Employee.objects.get(organization=org, employee_id=employee_id)
        except (Organization.DoesNotExist, Employee.DoesNotExist):
            return Response({'error': 'Employee not found'}, status=404)
        
        # Get embeddings from both collections
        light_embeddings = vector_db.get_employee_embeddings(org_code, 'light', employee_id)
        heavy_embeddings = vector_db.get_employee_embeddings(org_code, 'heavy', employee_id)
        
        return Response({
            'employee_id': employee_id,
            'employee_name': employee.full_name,
            'light': {
                'count': len(light_embeddings),
                'embeddings': light_embeddings
            },
            'heavy': {
                'count': len(heavy_embeddings),
                'embeddings': heavy_embeddings
            }
        })


class DeleteChromaDBEmbeddingView(APIView):
    """
    Delete a specific embedding from ChromaDB.
    DELETE /api/v1/attendance/chromadb-embedding/
    Body: org_code, model_type (light/heavy), chroma_id
    """
    permission_classes = [AllowAny]
    
    def delete(self, request):
        from services.vector_db import vector_db
        
        org_code = request.data.get('org_code', '').upper().strip()
        model_type = request.data.get('model_type', '').lower().strip()
        chroma_id = request.data.get('chroma_id', '').strip()
        
        if not org_code or not model_type or not chroma_id:
            return Response({'error': 'org_code, model_type, and chroma_id required'}, status=400)
        
        if model_type not in ['light', 'heavy']:
            return Response({'error': 'model_type must be light or heavy'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        success = vector_db.delete_embedding_by_id(org_code, model_type, chroma_id)
        
        if success:
            return Response({
                'success': True,
                'message': f'Deleted {chroma_id} from {model_type} collection'
            })
        else:
            return Response({'error': 'Failed to delete embedding'}, status=500)
class MigrateToInsightFaceView(APIView):
    """
    Migrate tool: Regenerate embeddings for all employees using new InsightFace engine.
    This reads images from disk and updates the `face_embeddings` field.
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        from apps.faces.deepface_service import get_deepface_service
        from django.conf import settings
        import os
        
        service = get_deepface_service()
        employees = Employee.objects.filter(is_active=True)
        results = []
        success_count = 0
        
        for employee in employees:
            try:
                org_code = employee.organization.org_code
                employee_id = employee.employee_id
                
                # Path: media/employee_faces/{org_code}/{employee_id}
                images_dir = os.path.join(settings.MEDIA_ROOT, 'employee_faces', org_code, employee_id)
                
                if not os.path.exists(images_dir):
                    results.append(f"⚠️ {employee.full_name}: No images found at {images_dir}")
                    continue
                    
                images = [os.path.join(images_dir, f) for f in os.listdir(images_dir) 
                         if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
                
                if not images:
                    results.append(f"⚠️ {employee.full_name}: Empty image directory")
                    continue
                
                # Regenerate
                try:
                    res = service.train_person(employee_id, employee.full_name, images)
                    
                    # Update Employee Model
                    employee.face_embeddings = res['active_embeddings']
                    employee.embeddings_count = res['active_count']
                    # Clear heavy embeddings to force use of new light ones
                    employee.heavy_embeddings = [] 
                    employee.face_enrolled = True
                    employee.save()
                    
                    success_count += 1
                    results.append(f"✅ {employee.full_name}: Regenerated {res['active_count']} embeddings.")
                    
                except Exception as e:
                    results.append(f"❌ {employee.full_name}: Training failed - {str(e)}")
                    
            except Exception as e:
                results.append(f"❌ Error processing {employee.employee_id}: {e}")
        
        return Response({
            'success': True,
            'processed': len(employees),
            'migrated': success_count,
            'details': results
        })
