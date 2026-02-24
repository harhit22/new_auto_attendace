"""
Trip API Views
Handles the complete trip workflow: Driver check-in -> Helper login -> Vehicle capture -> Checkout
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.parsers import MultiPartParser, JSONParser
from django.utils import timezone
from django.shortcuts import get_object_or_404
import numpy as np
import logging

logger = logging.getLogger(__name__)

from core.models import (
    Organization, SaaSEmployee, Trip, VehicleComplianceRecord, 
    LoginDetectionResult, CustomYoloModel
)
from apps.detection.compliance_rules import check_full_compliance
from .reports import generate_trip_excel


class TripViewSet(viewsets.ViewSet):
    """
    Trip workflow API:
    
    CHECK-IN FLOW:
    1. POST /trips/driver-checkin/ - Driver verifies face, creates Trip
    2. POST /trips/{id}/helper-checkin/ - Helper verifies face (optional)
    3. POST /trips/{id}/skip-helper/ - Skip helper
    4. POST /trips/{id}/vehicle-checkin/ - Capture vehicle, run YOLO compliance
    
    CHECK-OUT FLOW:
    5. POST /trips/{id}/driver-checkout/ - Driver verifies face
    6. POST /trips/{id}/helper-checkout/ - Helper verifies face
    7. POST /trips/{id}/vehicle-checkout/ - Vehicle compliance, complete trip
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    parser_classes = [MultiPartParser, JSONParser]
    
    def list(self, request):
        """List trips for an organization, ward, or route with all image URLs"""
        org_id = request.query_params.get('organization_id')
        ward_id = request.query_params.get('ward_id')
        route_id = request.query_params.get('route_id')
        date_filter = request.query_params.get('date')  # Single date YYYY-MM-DD format
        start_date = request.query_params.get('start_date')  # Range start
        end_date = request.query_params.get('end_date')  # Range end
        
        if not org_id and not ward_id and not route_id:
            return Response({'error': 'organization_id, ward_id, or route_id required'}, status=400)
        
        # Build query based on filters
        query = Trip.objects.all()
        
        if route_id:
            query = query.filter(route_id=route_id)
        elif ward_id:
            query = query.filter(route__ward_id=ward_id)
        elif org_id:
            query = query.filter(organization_id=org_id)
        
        # Apply date filter - prefer range over single date
        if start_date and end_date:
            query = query.filter(date__gte=start_date, date__lte=end_date)
        elif date_filter:
            query = query.filter(date=date_filter)
        
        trips = query.select_related(
            'driver', 'helper', 'route',
            'checkin_driver_detection', 'checkin_helper_detection', 'checkin_vehicle',
            'checkout_driver_detection', 'checkout_helper_detection', 'checkout_vehicle'
        ).order_by('-date', '-checkin_time')[:50]
        
        def get_image_url(detection):
            if detection and detection.frame_image:
                return detection.frame_image.url
            return None
        
        def get_vehicle_image_url(vehicle):
            if vehicle and vehicle.vehicle_image:
                return vehicle.vehicle_image.url
            return None
        
        data = []
        for trip in trips:
            data.append({
                'id': str(trip.id),
                'date': str(trip.date),
                'driver': {
                    'id': trip.driver.employee_id,
                    'name': trip.driver.full_name
                },
                'helper': {
                    'id': trip.helper.employee_id,
                    'name': trip.helper.full_name
                } if trip.helper else None,
                'helper_skipped': trip.helper_skipped,
                'status': trip.status,
                'checkin_time': trip.checkin_time.isoformat() if trip.checkin_time else None,
                'checkout_time': trip.checkout_time.isoformat() if trip.checkout_time else None,
                'route': {
                    'id': str(trip.route.id),
                    'name': trip.route.name,
                    'code': trip.route.code
                } if trip.route else None,
                'checkin_compliance_passed': trip.checkin_compliance_passed,
                'checkout_compliance_passed': trip.checkout_compliance_passed,
                'work_duration': str(trip.work_duration) if trip.work_duration else None,
                'checkin_driver_image': get_image_url(trip.checkin_driver_detection),
                'checkin_helper_image': get_image_url(trip.checkin_helper_detection),
                'checkin_vehicle_image': get_vehicle_image_url(trip.checkin_vehicle),
                'checkin_vehicle_detections': trip.checkin_vehicle.detections if trip.checkin_vehicle else None,
                'checkin_vehicle_plate_number': trip.checkin_vehicle.plate_number if trip.checkin_vehicle else None,
                'checkin_compliance_details': trip.checkin_vehicle.compliance_details if trip.checkin_vehicle else None,
                # Check-out images
                'checkout_driver_image': get_image_url(trip.checkout_driver_detection),
                'checkout_helper_image': get_image_url(trip.checkout_helper_detection),
                'checkout_vehicle_image': get_vehicle_image_url(trip.checkout_vehicle),
                'checkout_vehicle_detections': trip.checkout_vehicle.detections if trip.checkout_vehicle else None,
                'checkout_vehicle_plate_number': trip.checkout_vehicle.plate_number if trip.checkout_vehicle else None,
                'checkout_compliance_details': trip.checkout_vehicle.compliance_details if trip.checkout_vehicle else None,
                # GPS Locations
                'checkin_location': {
                    'latitude': float(trip.checkin_latitude) if trip.checkin_latitude else None,
                    'longitude': float(trip.checkin_longitude) if trip.checkin_longitude else None
                } if trip.checkin_latitude and trip.checkin_longitude else None,
                'checkout_location': {
                    'latitude': float(trip.checkout_latitude) if trip.checkout_latitude else None,
                    'longitude': float(trip.checkout_longitude) if trip.checkout_longitude else None
                } if trip.checkout_latitude and trip.checkout_longitude else None,
                # Substitute Mode Info
                'is_substitute_driver': trip.is_substitute_driver,
                'is_substitute_helper': trip.is_substitute_helper,
                'substitute_driver_name': trip.substitute_driver_name or None,
                'substitute_driver_phone': trip.substitute_driver_phone or None,
            })
        
        return Response({'trips': data})

    @action(detail=False, methods=['get'])
    def export_excel(self, request):
        """
        Download trips data as Excel (.xlsx)
        GET /trips/export_excel/?organization_id=X&ward_id=Y&start_date=Z...
        """
        # Reuse filtering logic from list()
        org_id = request.query_params.get('organization_id')
        ward_id = request.query_params.get('ward_id')
        route_id = request.query_params.get('route_id')
        date_filter = request.query_params.get('date')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if not org_id and not ward_id and not route_id:
            return Response({'error': 'organization_id, ward_id, or route_id required'}, status=400)
        
        query = Trip.objects.all()
        
        if route_id:
            query = query.filter(route_id=route_id)
        elif ward_id:
            query = query.filter(route__ward_id=ward_id)
        elif org_id:
            query = query.filter(organization_id=org_id)
            
        if start_date and end_date:
            query = query.filter(date__gte=start_date, date__lte=end_date)
        elif date_filter:
            query = query.filter(date=date_filter)
            
        # Prefetch related data for efficiency
        queryset = query.select_related(
            'driver', 'helper', 'route',
            'checkin_vehicle', 'checkout_vehicle',
            'route__ward'
        ).order_by('-date', '-checkin_time')
        
        return generate_trip_excel(queryset)

    def retrieve(self, request, pk=None):
        """Get single trip details"""
        trip = get_object_or_404(Trip, pk=pk)
        data = {
            'id': str(trip.id),
            'status': trip.status,
            'driver': {
                'id': trip.driver.employee_id,
                'name': trip.driver.full_name
            },
            'helper': {
                'id': trip.helper.employee_id,
                'name': trip.helper.full_name,
                'image_url': trip.helper.face_image.url if trip.helper.face_image else None
            } if trip.helper else None,
            'helper_skipped': trip.helper_skipped,
            'checkin_time': trip.checkin_time.isoformat() if trip.checkin_time else None,
            # Substitute Mode
            'is_substitute_driver': trip.is_substitute_driver,
            'is_substitute_helper': trip.is_substitute_helper,
            'substitute_driver_name': trip.substitute_driver_name or None,
            'substitute_driver_phone': trip.substitute_driver_phone or None,
        }
        return Response(data)

    @action(detail=False, methods=['get'], url_path='active-trip')
    def active_trip(self, request):
        """
        Get the active trip for a driver.
        GET /trips/active-trip/?org_code=XXX&employee_id=YYY
        """
        org_code = request.query_params.get('org_code')
        employee_id = request.query_params.get('employee_id')
        
        if not org_code or not employee_id:
            return Response({'error': 'org_code and employee_id required'}, status=400)
            
        try:
            # Find trips that are NOT completed
            # Check both driver AND helper (for helper-as-driver scenarios where helper does driver duties)
            from django.db.models import Q
            trip = Trip.objects.filter(
                organization__org_code=org_code
            ).filter(
                Q(driver__employee_id=employee_id) | Q(helper__employee_id=employee_id)
            ).exclude(status='completed').order_by('-date', '-checkin_time').first()
            
            if trip:
                # Check if this is a helper-as-driver scenario
                is_helper_as_driver = trip.driver.employee_id.startswith('DUMMY_DRIVER_')
                return Response({
                    'found': True,
                    'trip_id': str(trip.id),
                    'status': trip.status,
                    'helper_skipped': trip.helper_skipped,
                    'has_helper': bool(trip.helper),
                    'is_helper_as_driver': is_helper_as_driver,
                    # For helper-as-driver, helper_checkout is considered done when checkout_helper_detection exists
                    'helper_checkout_done': bool(trip.checkout_helper_detection) or trip.helper_skipped
                })
            
            return Response({'found': False, 'message': 'No active trip found'})
            
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    
    @action(detail=False, methods=['post'], url_path='driver-checkin')
    def driver_checkin(self, request):
        """
        Step 1: Driver checks in with face verification.
        Creates a new Trip record.
        
        POST /trips/driver-checkin/
        Body: org_code, employee_id, image (face photo)
        """
        org_code = request.data.get('org_code', '').upper().strip()
        employee_id = request.data.get('employee_id', '').strip()
        image_file = request.FILES.get('image')
        
        # Substitute mode
        is_substitute = request.data.get('is_substitute', '').lower() in ('true', '1', 'yes')
        substitute_name = request.data.get('substitute_name', '').strip()
        substitute_phone = request.data.get('substitute_phone', '').strip()
        substitute_photo = request.FILES.get('substitute_photo')  # Face photo of substitute
        substitute_license = request.FILES.get('substitute_license')  # License photo
        
        # Check for frame-burst upload (passive liveness)
        frame_files = request.FILES.getlist('frames')  # Multiple frames
        challenge_frame = request.data.get('challenge_frame') # Active liveness sync
        
        if not org_code or not employee_id:
            return Response({'error': 'org_code and employee_id required'}, status=400)
        
        if not is_substitute and not image_file and not frame_files:
            return Response({'error': 'image (or frames) required for non-substitute check-in'}, status=400)
        
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        
        try:
            # 🔹 OPTIMIZED: Load only active embeddings, check role
            employee = SaaSEmployee.objects.only(
                'id',
                'employee_id',
                'first_name',
                'last_name',
                'organization',
                'heavy_embeddings',
                'role'  # Added role check
            ).get(
                organization=org, 
                employee_id=employee_id, 
                status='active'
            )
        except SaaSEmployee.DoesNotExist:
            return Response({'error': 'Employee not found'}, status=404)
        
        now = timezone.now()
        from django.core.files.base import ContentFile
        detection = None
        
        if is_substitute:
            # SUBSTITUTE MODE: Skip face verification, just save photo
            logger.info(f"🔄 SUBSTITUTE MODE: {substitute_name} replacing {employee.full_name}")
            
            detection = LoginDetectionResult.objects.create(
                organization=org,
                employee=employee,
                face_confidence=0.0,
                detections={'substitute': True, 'substitute_name': substitute_name},
                compliance_passed=True
            )
            
            # Save substitute photo as detection frame
            if substitute_photo:
                substitute_photo.seek(0)
                detection.frame_image.save(
                    f'{employee_id}_{now.strftime("%Y%m%d_%H%M%S")}_substitute.jpg',
                    ContentFile(substitute_photo.read()),
                    save=True
                )
        else:
            # NORMAL MODE: Verify face
            face_result = self._verify_face(
                employee, 
                image_file if image_file else frame_files[len(frame_files)//2] if frame_files else None,
                org,
                frame_files=frame_files if len(frame_files) >= 8 else None,
                challenge_frame=challenge_frame
            )
            if not face_result['success']:
                return Response(face_result, status=401)
            
            detection = LoginDetectionResult.objects.create(
                organization=org,
                employee=employee,
                face_confidence=face_result.get('confidence', 0),
                detections={},
                compliance_passed=True
            )
            
            # Save frame image
            if image_file:
                image_file.seek(0)
                detection.frame_image.save(
                    f'{employee_id}_{now.strftime("%Y%m%d_%H%M%S")}_{"helper" if employee.role == "helper" else "driver"}.jpg',
                    ContentFile(image_file.read()),
                    save=True
                )
            elif frame_files and len(frame_files) > 0:
                middle_frame = frame_files[len(frame_files) // 2]
                middle_frame.seek(0)
                detection.frame_image.save(
                    f'{employee_id}_{now.strftime("%Y%m%d_%H%M%S")}_{"helper" if employee.role == "helper" else "driver"}.jpg',
                    ContentFile(middle_frame.read()),
                    save=True
                )

        # Get GPS/Route (Common)
        latitude = request.data.get('latitude')
        longitude = request.data.get('longitude')
        route_id = request.data.get('route_id')
        route = None
        if route_id:
            from core.models import Route
            try:
                route = Route.objects.get(id=route_id)
            except Route.DoesNotExist:
                pass


        # === HELPER ONLY MODE ===
        if employee.role == 'helper':
            # Create/Get Dummy Driver
            dummy_id = f"DUMMY_DRIVER_{org.org_code}"
            dummy_driver, _ = SaaSEmployee.objects.get_or_create(
                organization=org,
                employee_id=dummy_id,
                defaults={
                    'first_name': 'Absent',
                    'last_name': 'Driver',
                    'role': 'driver',
                    'status': 'active',
                    'face_enrolled': True,
                    'face_embeddings': []
                }
            )

            # Create Trip (Helper Only)
            trip = Trip.objects.create(
                organization=org,
                driver=dummy_driver,
                helper=employee, # The Real User
                route=route,
                checkin_time=now,
                checkin_helper_detection=detection, # Saved as Helper Checkin
                checkin_driver_detection=None, # No Driver
                checkin_latitude=latitude if latitude else None,
                checkin_longitude=longitude if longitude else None,
                status='helper_checked_in', # SKIP Driver Login
                helper_skipped=False
            )

            return Response({
                'success': True,
                'message': f'Helper {employee.full_name} started trip (Driver Absent)',
                'trip_id': str(trip.id),
                'next_step': 'vehicle-checkin', # SKIP Helper Login (Already done) -> Go to Vehicle
                'time': now.isoformat()
            })


        # === NORMAL DRIVER MODE ===
        # (It's a driver)
        driver = employee
        
        # Check if driver already has an incomplete trip today
        existing_trip = Trip.objects.filter(
            driver=driver,
            date=now.date(),
            status__in=['driver_checked_in', 'helper_checked_in', 'helper_skipped', 'checkin_complete']
        ).first()
        
        if existing_trip:
            return Response({
                'success': False,
                'error': f'You already have an active trip for today. Trip ID: {existing_trip.id}',
                'trip_id': str(existing_trip.id)
            }, status=400)
        
        # Create Trip
        trip = Trip.objects.create(
            organization=org,
            driver=driver,
            route=route,
            checkin_time=now,
            checkin_driver_detection=detection,
            checkin_latitude=latitude if latitude else None,
            checkin_longitude=longitude if longitude else None,
            status='driver_checked_in',
            is_substitute_driver=is_substitute,
            substitute_driver_name=substitute_name if is_substitute else '',
            substitute_driver_phone=substitute_phone if is_substitute else '',
        )
        
        # Save substitute files on trip (after creation)
        if is_substitute:
            if substitute_photo:
                substitute_photo.seek(0)
                trip.substitute_driver_photo.save(
                    f'sub_driver_{employee_id}_{now.strftime("%Y%m%d")}.jpg',
                    ContentFile(substitute_photo.read()),
                    save=False
                )
            if substitute_license:
                substitute_license.seek(0)
                trip.substitute_driver_license.save(
                    f'sub_license_{employee_id}_{now.strftime("%Y%m%d")}.jpg',
                    ContentFile(substitute_license.read()),
                    save=False
                )
            trip.save()
        
        return Response({
            'success': True,
            'message': f'Driver {driver.full_name} checked in!',
            'trip_id': str(trip.id),
            'next_step': 'helper-checkin',
            'time': now.isoformat()
        })
    
    @action(detail=True, methods=['post'], url_path='helper-checkin')
    def helper_checkin(self, request, pk=None):
        """
        Step 2: Helper checks in with face verification.
        
        POST /trips/{trip_id}/helper-checkin/
        Body: employee_id, password, image (face photo) OR frames (list)
        """
        trip = get_object_or_404(Trip, pk=pk)
        
        if trip.status not in ['driver_checked_in']:
            return Response({
                'error': f'Cannot add helper. Trip status: {trip.status}'
            }, status=400)
        
        employee_id = request.data.get('employee_id', '').strip()
        password = request.data.get('password', '').strip()
        image_file = request.FILES.get('image')
        
        # Substitute mode
        is_substitute = request.data.get('is_substitute', '').lower() in ('true', '1', 'yes')
        substitute_photo = request.FILES.get('substitute_photo')
        
        # Check for frame-burst upload (passive liveness)
        frame_files = request.FILES.getlist('frames')
        challenge_frame = request.data.get('challenge_frame')
        
        if not employee_id:
            return Response({'error': 'employee_id required'}, status=400)
        if not is_substitute and not image_file and not frame_files:
            return Response({'error': 'image (or frames) required for non-substitute check-in'}, status=400)
        
        # Security: Prevent Driver from being Helper
        if trip.driver.employee_id == employee_id:
            return Response({'error': 'Driver cannot be the Helper. Please ask the helper to log in.'}, status=400)
        
        try:
            helper = SaaSEmployee.objects.get(
                organization=trip.organization,
                employee_id=employee_id,
                status='active'
            )
        except SaaSEmployee.DoesNotExist:
            return Response({'error': 'Helper not found'}, status=404)
        
        # Verify password if provided
        if password and helper.password and helper.password != password:
            return Response({'error': 'Invalid password'}, status=401)
        
        now = timezone.now()
        from django.core.files.base import ContentFile
        detection = None
        
        if is_substitute:
            # SUBSTITUTE MODE: Skip face verification
            logger.info(f"🔄 SUBSTITUTE HELPER: replacing {helper.full_name}")
            
            detection = LoginDetectionResult.objects.create(
                organization=trip.organization,
                employee=helper,
                face_confidence=0.0,
                detections={'substitute': True},
                compliance_passed=True
            )
            if substitute_photo:
                substitute_photo.seek(0)
                detection.frame_image.save(
                    f'{employee_id}_{now.strftime("%Y%m%d_%H%M%S")}_sub_helper.jpg',
                    ContentFile(substitute_photo.read()),
                    save=True
                )
        else:
            # NORMAL MODE: Verify face
            face_result = self._verify_face(
                helper, 
                image_file if image_file else frame_files[len(frame_files)//2] if frame_files else None,
                trip.organization,
                frame_files=frame_files if len(frame_files) >= 8 else None,
                challenge_frame=challenge_frame
            )
            if not face_result['success']:
                return Response(face_result, status=401)
            
            detection = LoginDetectionResult.objects.create(
                organization=trip.organization,
                employee=helper,
                face_confidence=face_result.get('confidence', 0),
                detections={},
                compliance_passed=True
            )
            if image_file:
                image_file.seek(0)
                detection.frame_image.save(
                    f'{employee_id}_{now.strftime("%Y%m%d_%H%M%S")}_helper.jpg',
                    ContentFile(image_file.read()),
                    save=True
                )
            elif frame_files and len(frame_files) > 0:
                middle_frame = frame_files[len(frame_files) // 2]
                middle_frame.seek(0)
                detection.frame_image.save(
                    f'{employee_id}_{now.strftime("%Y%m%d_%H%M%S")}_helper.jpg',
                    ContentFile(middle_frame.read()),
                    save=True
                )
        
        # Update Trip
        trip.helper = helper
        trip.checkin_helper_detection = detection
        trip.status = 'helper_checked_in'
        trip.is_substitute_helper = is_substitute
        if is_substitute and substitute_photo:
            substitute_photo.seek(0)
            trip.substitute_helper_photo.save(
                f'sub_helper_{employee_id}_{now.strftime("%Y%m%d")}.jpg',
                ContentFile(substitute_photo.read()),
                save=False
            )
        trip.save()
        
        return Response({
            'success': True,
            'message': f'Helper {helper.full_name} checked in!',
            'trip_id': str(trip.id),
            'next_step': 'vehicle-checkin'
        })
    
    @action(detail=True, methods=['post'], url_path='skip-helper')
    def skip_helper(self, request, pk=None):
        """
        Step 2 (alternative): Skip helper login.
        
        POST /trips/{trip_id}/skip-helper/
        """
        trip = get_object_or_404(Trip, pk=pk)
        
        if trip.status != 'driver_checked_in':
            return Response({'error': 'Cannot skip helper at this stage'}, status=400)
        
        trip.helper_skipped = True
        trip.status = 'helper_skipped'
        trip.save()
        
        return Response({
            'success': True,
            'message': 'Helper skipped',
            'trip_id': str(trip.id),
            'next_step': 'vehicle-checkin'
        })
    
    @action(detail=True, methods=['post'], url_path='vehicle-checkin')
    def vehicle_checkin(self, request, pk=None):
        """
        Step 3: Capture vehicle image and run YOLO compliance check.
        Completes the check-in process.
        
        POST /trips/{trip_id}/vehicle-checkin/
        Body: image (vehicle photo)
        """
        trip = get_object_or_404(Trip, pk=pk)
        
        if trip.status not in ['driver_checked_in', 'helper_checked_in', 'helper_skipped']:
            return Response({'error': 'Invalid trip status for vehicle check-in'}, status=400)
        
        image_file = request.FILES.get('image')
        vehicle_id = request.data.get('vehicle_id')
        if not image_file:
            return Response({'error': 'Vehicle image required'}, status=400)
        
        # Run YOLO detection (includes image quality checks and OCR)
        yolo_result = self._run_yolo_detection(trip.organization, image_file)
        
        # Check if image quality failed
        quality_check = yolo_result.get('quality_check', {})
        if quality_check and not quality_check.get('passed', True):
            return Response({
                'error': yolo_result.get('message', 'Image quality check failed'),
                'quality_issues': quality_check.get('errors', []),
                'quality_metrics': {
                    'blur_variance': quality_check.get('blur', {}).get('variance', 0),
                    'brightness': quality_check.get('brightness', {}).get('mean_brightness', 0)
                }
            }, status=400)
        
        # Check compliance (pass yolo_model for dynamic requirements)
        from core.models import CustomYoloModel, Vehicle
        yolo_model = CustomYoloModel.objects.filter(
            organization=trip.organization,
            is_active=True
        ).first()
        compliance_result = check_full_compliance(yolo_result['detections'], yolo_model)
        
        # --- NEW OCR MATCHING LOGIC ---
        import difflib
        detected_plate = yolo_result.get('plate_number', '').strip().upper()
        final_plate = detected_plate
        vehicle_obj = None
        
        if vehicle_id:
            vehicle_obj = Vehicle.objects.filter(id=vehicle_id).first()
            if vehicle_obj:
                expected_plate = vehicle_obj.plate_number.strip().upper()
                if detected_plate and expected_plate:
                    similarity = difflib.SequenceMatcher(None, detected_plate, expected_plate).ratio()
                    if similarity >= 0.70:
                        final_plate = expected_plate
                        if 'required_classes' in compliance_result:
                            if 'number_plate' in compliance_result['required_classes']:
                                compliance_result['required_classes']['number_plate']['passed'] = True
                                compliance_result['passed'] = all(c['passed'] for c in compliance_result['required_classes'].values())

        # Save VehicleComplianceRecord
        now = timezone.now()
        
        # DEBUG LOG FOR PLATE NUMBER
        plate_num_to_save = final_plate
        print(f"DEBUG: Saving VehicleComplianceRecord with plate_number='{plate_num_to_save}'")

        vehicle_record = VehicleComplianceRecord.objects.create(
            organization=trip.organization,
            yolo_model_id=yolo_result.get('model_id'),
            detections=yolo_result['detections'],
            plate_number=plate_num_to_save,
            compliance_passed=compliance_result['passed'],
            compliance_details=compliance_result
        )
        
        # Save image (Annotated if available, else original)
        if yolo_result.get('annotated_image'):
            from django.core.files.base import ContentFile
            vehicle_record.vehicle_image.save(
                f'vehicle_checkin_{now.strftime("%Y%m%d_%H%M%S")}.jpg',
                ContentFile(yolo_result['annotated_image']),
                save=True
            )
        else:
            from django.core.files.base import ContentFile
            image_file.seek(0)
            vehicle_record.vehicle_image.save(
                f'vehicle_checkin_{now.strftime("%Y%m%d_%H%M%S")}.jpg',
                ContentFile(image_file.read()),
                save=True
            )
        
        # Update trip
        if vehicle_obj:
            trip.vehicle = vehicle_obj
        trip.checkin_vehicle = vehicle_record
        trip.checkin_compliance_passed = compliance_result['passed']
        trip.status = 'checkin_complete'
        trip.save()
        
        return Response({
            'success': True,
            'trip_id': str(trip.id),
            'compliance_passed': compliance_result['passed'],
            'compliance_summary': compliance_result['summary'],
            'detections': yolo_result['detections'],
            'plate_number': yolo_result.get('plate_number', ''),
            'plate_confidence': yolo_result.get('plate_confidence', 0.0),
            'quality_metrics': quality_check,
            'checks': compliance_result['checks'],
            'message': 'Check-in complete!' if compliance_result['passed'] else 'Check-in complete but compliance failed'
        })

    # ... (driver_checkout, helper_checkout, skip_helper_checkout omitted, assume unchanged) ...

    @action(detail=True, methods=['post'], url_path='driver-checkout')
    def driver_checkout(self, request, pk=None):
        """
        Step 4: Driver checks out with face verification.
        
        POST /trips/{trip_id}/driver-checkout/
        Body: image (face photo)
        """
        trip = get_object_or_404(Trip, pk=pk)
        
        if trip.status != 'checkin_complete':
            status_messages = {
                'driver_checked_in': 'Please complete helper login and vehicle capture first to finish check-in.',
                'helper_checked_in': 'Please complete vehicle capture first to finish check-in.',
                'checkout_started': 'Checkout already started. Please continue with helper checkout or vehicle capture.',
                'checkout_complete': 'This trip is already completed.'
            }
            msg = status_messages.get(trip.status, f'Cannot checkout. Trip status: {trip.status}')
            return Response({'error': msg}, status=400)
        
        image_file = request.FILES.get('image')
        substitute_photo = request.FILES.get('substitute_photo')
        
        # Check for frame-burst upload (passive liveness)
        frame_files = request.FILES.getlist('frames')  # Multiple frames
        
        # Determine who to verify: If driver is a dummy (helper-as-driver scenario), verify helper instead
        is_helper_as_driver = trip.driver.employee_id.startswith('DUMMY_DRIVER_')
        verify_employee = trip.helper if is_helper_as_driver and trip.helper else trip.driver
        
        now = timezone.now()
        from django.core.files.base import ContentFile
        detection = None
        
        if trip.is_substitute_driver:
            # SUBSTITUTE MODE: Skip face verification
            logger.info(f"🔄 SUBSTITUTE CHECKOUT: skipping face for {verify_employee.full_name}")
            
            if not substitute_photo and not image_file:
                return Response({'error': 'Photo required for substitute checkout'}, status=400)
            
            photo_file = substitute_photo or image_file
            detection = LoginDetectionResult.objects.create(
                organization=trip.organization,
                employee=verify_employee,
                face_confidence=0.0,
                detections={'substitute': True},
                compliance_passed=True
            )
            photo_file.seek(0)
            detection.frame_image.save(
                f'{trip.driver.employee_id}_{now.strftime("%Y%m%d_%H%M%S")}_sub_checkout.jpg',
                ContentFile(photo_file.read()),
                save=True
            )
        else:
            # NORMAL MODE: Face verification required
            if not image_file and not frame_files:
                return Response({'error': 'Face image or frames required'}, status=400)
            
            challenge_frame = request.data.get('challenge_frame')
            face_result = self._verify_face(
                verify_employee,
                image_file if image_file else frame_files[len(frame_files)//2] if frame_files else None,
                trip.organization,
                frame_files=frame_files if len(frame_files) >= 8 else None,
                challenge_frame=challenge_frame
            )
            if not face_result['success']:
                return Response(face_result, status=401)
            
            detection = LoginDetectionResult.objects.create(
                organization=trip.organization,
                employee=verify_employee,
                face_confidence=face_result['confidence'],
                detections={},
                compliance_passed=True
            )
            
            if image_file:
                image_file.seek(0)
                detection.frame_image.save(
                    f'{trip.driver.employee_id}_{now.strftime("%Y%m%d_%H%M%S")}_checkout.jpg',
                    ContentFile(image_file.read()),
                    save=True
                )
            elif frame_files and len(frame_files) > 0:
                middle_frame = frame_files[len(frame_files) // 2]
                middle_frame.seek(0)
                detection.frame_image.save(
                    f'{trip.driver.employee_id}_{now.strftime("%Y%m%d_%H%M%S")}_checkout.jpg',
                    ContentFile(middle_frame.read()),
                    save=True
                )
        
        trip.checkout_time = now
        trip.checkout_latitude = request.data.get('latitude')
        trip.checkout_longitude = request.data.get('longitude')
        trip.status = 'checkout_started'
        
        # For helper-as-driver: save detection to helper checkout (skip driver, no real driver)
        if is_helper_as_driver:
            trip.checkout_helper_detection = detection
            trip.checkout_driver_detection = None
        else:
            trip.checkout_driver_detection = detection
        
        trip.save()
        
        # For helper-as-driver: skip helper checkout page (helper already verified), go directly to vehicle
        if is_helper_as_driver:
            next_step = 'vehicle-checkout'
        else:
            next_step = 'helper-checkout' if trip.helper and not trip.helper_skipped else 'vehicle-checkout'
        
        return Response({
            'success': True,
            'message': f'{verify_employee.full_name} checkout verified',
            'trip_id': str(trip.id),
            'next_step': next_step
        })
    
    @action(detail=True, methods=['post'], url_path='helper-checkout')
    def helper_checkout(self, request, pk=None):
        """
        Step 5: Helper checks out with face verification.
        
        POST /trips/{trip_id}/helper-checkout/
        Body: employee_id, password, image
        """
        trip = get_object_or_404(Trip, pk=pk)
        
        if trip.status != 'checkout_started':
            return Response({'error': 'Invalid trip status'}, status=400)
        
        if not trip.helper:
            return Response({'error': 'No helper on this trip'}, status=400)
        
        employee_id = request.data.get('employee_id', '').strip()
        password = request.data.get('password', '').strip()
        image_file = request.FILES.get('image')
        substitute_photo = request.FILES.get('substitute_photo')
        
        # Verify it's the same helper
        if employee_id and employee_id != trip.helper.employee_id:
            return Response({'error': 'Helper ID does not match trip'}, status=400)
        
        # Verify password
        if password and trip.helper.password and trip.helper.password != password:
            return Response({'error': 'Invalid password'}, status=401)
        
        now = timezone.now()
        from django.core.files.base import ContentFile
        detection = None
        
        if trip.is_substitute_helper:
            # SUBSTITUTE MODE: Skip face verification
            logger.info(f"🔄 SUBSTITUTE HELPER CHECKOUT: skipping face for {trip.helper.full_name}")
            
            photo_file = substitute_photo or image_file
            if not photo_file:
                return Response({'error': 'Photo required for substitute checkout'}, status=400)
            
            detection = LoginDetectionResult.objects.create(
                organization=trip.organization,
                employee=trip.helper,
                face_confidence=0.0,
                detections={'substitute': True},
                compliance_passed=True
            )
            photo_file.seek(0)
            detection.frame_image.save(
                f'{trip.helper.employee_id}_{now.strftime("%Y%m%d_%H%M%S")}_sub_helper_out.jpg',
                ContentFile(photo_file.read()),
                save=True
            )
        else:
            # NORMAL MODE: Face verification
            if not image_file:
                return Response({'error': 'Face image required'}, status=400)
            
            face_result = self._verify_face(trip.helper, image_file, trip.organization)
            if not face_result['success']:
                return Response(face_result, status=401)
            
            detection = LoginDetectionResult.objects.create(
                organization=trip.organization,
                employee=trip.helper,
                face_confidence=face_result['confidence'],
                detections={},
                compliance_passed=True
            )
            image_file.seek(0)
            detection.frame_image.save(
                f'{trip.helper.employee_id}_{now.strftime("%Y%m%d_%H%M%S")}_helper_out.jpg',
                ContentFile(image_file.read()),
                save=True
            )
        
        trip.checkout_helper_detection = detection
        trip.save()
        
        return Response({
            'success': True,
            'message': f'Helper {trip.helper.full_name} checkout verified',
            'trip_id': str(trip.id),
            'next_step': 'vehicle-checkout'
        })
    
    @action(detail=True, methods=['post'], url_path='skip-helper-checkout')
    def skip_helper_checkout(self, request, pk=None):
        """Skip helper checkout if needed"""
        trip = get_object_or_404(Trip, pk=pk)
        
        if trip.status != 'checkout_started':
            return Response({'error': 'Invalid trip status'}, status=400)
        
        return Response({
            'success': True,
            'message': 'Helper checkout skipped',
            'trip_id': str(trip.id),
            'next_step': 'vehicle-checkout'
        })
    
    @action(detail=True, methods=['post'], url_path='vehicle-checkout')
    def vehicle_checkout(self, request, pk=None):
        """
        Step 6: Capture vehicle image and complete trip.
        
        POST /trips/{trip_id}/vehicle-checkout/
        Body: image (vehicle photo)
        """
        trip = get_object_or_404(Trip, pk=pk)
        
        if trip.status != 'checkout_started':
            return Response({'error': 'Invalid trip status for vehicle checkout'}, status=400)
        
        image_file = request.FILES.get('image')
        if not image_file:
            return Response({'error': 'Vehicle image required'}, status=400)
        
        # Run YOLO detection (includes image quality checks and OCR)
        yolo_result = self._run_yolo_detection(trip.organization, image_file)
        
        # Check if image quality failed
        quality_check = yolo_result.get('quality_check', {})
        if quality_check and not quality_check.get('passed', True):
            return Response({
                'error': yolo_result.get('message', 'Image quality check failed'),
                'quality_issues': quality_check.get('errors', []),
                'quality_metrics': {
                    'blur_variance': quality_check.get('blur', {}).get('variance', 0),
                    'brightness': quality_check.get('brightness', {}).get('mean_brightness', 0)
                }
            }, status=400)
        
        # Check compliance (pass yolo_model for dynamic requirements)
        from core.models import CustomYoloModel
        yolo_model = CustomYoloModel.objects.filter(
            organization=trip.organization,
            is_active=True
        ).first()
        compliance_result = check_full_compliance(yolo_result['detections'], yolo_model)
        
        # Save VehicleComplianceRecord
        now = timezone.now()
        
        vehicle_record = VehicleComplianceRecord.objects.create(
            organization=trip.organization,
            yolo_model_id=yolo_result.get('model_id'),
            detections=yolo_result['detections'],
            plate_number=yolo_result.get('plate_number', ''),
            compliance_passed=compliance_result['passed'],
            compliance_details=compliance_result
        )
        
        # Save image (Annotated if available, else original)
        if yolo_result.get('annotated_image'):
            from django.core.files.base import ContentFile
            vehicle_record.vehicle_image.save(
                f'vehicle_checkout_{now.strftime("%Y%m%d_%H%M%S")}.jpg',
                ContentFile(yolo_result['annotated_image']),
                save=True
            )
        else:
            from django.core.files.base import ContentFile
            image_file.seek(0)
            vehicle_record.vehicle_image.save(
                f'vehicle_checkout_{now.strftime("%Y%m%d_%H%M%S")}.jpg',
                ContentFile(image_file.read()),
                save=True
            )
        
        # Complete trip
        trip.checkout_vehicle = vehicle_record
        trip.checkout_compliance_passed = compliance_result['passed']
        
        # Fallback: Capture location if provided (in case driver-checkout missed it)
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        if lat and lng:
            trip.checkout_latitude = lat
            trip.checkout_longitude = lng
            
        trip.status = 'completed'
        trip.checkout_time = now # Update checkout time to match vehicle checkout if needed, or keep driver checkout time? 
        # Actually, if driver checkout happened, checkout_time is already set. 
        # But if we rely on vehicle checkout as the "final" step, we might want to update it or leave it.
        # Let's leave checkout_time unless it's null (which shouldn't happen if enabled properly)
        if not trip.checkout_time:
            trip.checkout_time = now

        trip.calculate_work_duration()
        
        return Response({
            'success': True,
            'trip_id': str(trip.id),
            'compliance_passed': compliance_result['passed'],
            'compliance_summary': compliance_result['summary'],
            'work_duration': str(trip.work_duration) if trip.work_duration else None,
            'message': 'Trip completed successfully!' if compliance_result['passed'] else 'Trip completed but checkout compliance failed'
        })
    
    def _verify_face(self, employee, image_file, org, frame_files=None, challenge_frame=None, skip_liveness=False):
        """Verify employee face against stored embeddings with optional passive liveness."""
        stored_embeddings = employee.face_embeddings or employee.heavy_embeddings
        if not stored_embeddings:
            return {
                'success': False,
                'error': 'आपका चेहरा दर्ज नहीं हुआ है (Face not enrolled). Contact Admin.'
            }
        
        import tempfile
        import os
        import cv2
        
        # Skip liveness if already verified (e.g., from unified check-in)
        if skip_liveness:
            logger.info("⏩ Skipping liveness (already verified)")
            frame_files = None  # Force single-frame mode
        
        # ========== LAYER 1: PASSIVE LIVENESS (Frame Burst) ==========
        if frame_files and len(frame_files) >= 8:
            try:
                from ml.passive_liveness import load_frames_from_files, compute_liveness_score
                
                logger.info(f"🎬 Running Active Liveness (Blink Challenge) on {len(frame_files)} frames...")
                frames = load_frames_from_files(frame_files)
                
                liveness_result = compute_liveness_score(frames, challenge_idx=challenge_frame)
                decision = liveness_result['decision']
                score = liveness_result['score']
                
                logger.info(f"🧠 Liveness: {decision} (Score: {score:.3f})")
                
                if decision == "FAKE":
                    # Use specific message if available
                    error_msg = liveness_result.get('details', {}).get('msg', 'Liveness Failed: Fake/Screen detected.')
                    return {
                        'success': False,
                        'error': error_msg,
                        'liveness_failed': True,
                        'liveness_score': score
                    }
                elif decision == "BORDERLINE":
                    # Pass through to YOLO backup layer
                    logger.warning(f"⚠️ Borderline liveness ({score:.3f}). Relying on YOLO backup.")
                
                # Use middle frame for face matching
                with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
                    middle_idx = len(frames) // 2
                    cv2.imwrite(temp_file.name, frames[middle_idx])
                    temp_path = temp_file.name
                
            except Exception as e:
                logger.error(f"❌ Passive Liveness Error: {e}")
                logger.info("⚠️ Falling back to single-frame YOLO")
                frame_files = None  # Force fallback
        
        # Fallback: Single frame mode
        if not frame_files or len(frame_files) < 8:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
                for chunk in image_file.chunks():
                    temp_file.write(chunk)
                temp_path = temp_file.name
        
        try:
            from apps.faces.deepface_service import get_deepface_service
            service = get_deepface_service()

            # ========== YOLO SPOOF DETECTION (Object) ==========
            try:
                from apps.detection.yolo_service import get_yolo_service
                yolo_service = get_yolo_service()
                
                # Ensure model is loaded (cached)
                MODEL_ID = 'spoof_check'
                yolo_service.load_model('yolov8m.pt', MODEL_ID)
                
                # Run detection (Get all low confidence boxes too)
                spoof_detections = yolo_service.detect_with_details(temp_path, MODEL_ID, confidence_threshold=0.2)
                
                # COCO Classes to watch for
                SPOOF_OBJECTS = ['cell phone', 'laptop', 'tv', 'remote']
                
                for det in spoof_detections:
                    obj_name = det['class']
                    conf = det['confidence']
                    
                    # Log for debugging
                    logger.info(f"👀 YOLO Saw: {obj_name} ({conf:.2f})")

                    # Check for spoof objects
                    if obj_name in SPOOF_OBJECTS:
                        if conf > 0.25:
                            logger.warning(f"❌ Spoof Object Detected: {obj_name} ({conf:.2f})")
                            return {
                                'success': False,
                                'error': f"Spoof Detected: {obj_name} found. Please remove it.",
                                'spoof_detected': True
                            }
                        else:
                            logger.info(f"⚠️ Ignored Spoof Object (Low Conf): {obj_name} ({conf:.2f})")

                logger.info("✅ YOLO Spoof Check Passed")
            except Exception as e:
                logger.error(f"⚠️ YOLO Spoof Check Skipped: {e}")
            # ===================================================

            # Direct Face Processing (No Anti-Spoof)
            result = service.process_face(temp_path)
            
            if not result.get('success'):
                return {'success': False, 'error': result.get('error', 'Face not detected')}

            # ========== PROXIMITY CHECK (Force Context for YOLO) ==========
            # If face takes up > 50% of image width (Tightened from 55%)
            bbox = result.get('facial_area', []) # [x1, y1, x2, y2]
            img_size = result.get('image_size', []) # [w, h]
            
            if bbox and img_size and len(bbox) == 4 and len(img_size) == 2:
                face_w = bbox[2] - bbox[0]
                img_w = img_size[0]
                ratio = face_w / img_w
                
                # Threshold: 0.60 (60% of screen width)
                # Adjusted to be less strict on distance requirements
                if ratio > 0.80:
                     logger.warning(f"⚠️ Face too close (Ratio: {ratio:.2f}). Rejecting.")
                     return {
                        'success': False, 
                        'error': "Camera Too Close. Move Back.",
                        'pose_error': True 
                    }
            # =============================================================
            
            # Check Pose from result
            pose_result = result.get('pose', {})
            if not pose_result.get('is_frontal', True):
                return {
                    'success': False,
                    'error': f"Head not straight. Look at camera.",
                    'pose_error': True,
                    'yaw': pose_result.get('yaw'),
                    'pitch': pose_result.get('pitch')
                }
            
            # Get API-ready embedding
            query_embedding = result.get('embedding')
            if query_embedding is None: # Should be caught by success check, but safety first
                 return {'success': False, 'error': 'No embedding generated'}
            
            query_embedding = np.array(query_embedding)
            
            # Calculate all distances
            distances = []
            for stored in stored_embeddings:
                stored_arr = np.array(stored)
                dot_product = np.dot(query_embedding, stored_arr)
                norm_product = np.linalg.norm(query_embedding) * np.linalg.norm(stored_arr)
                if norm_product > 0:
                    distance = 1 - (dot_product / norm_product)
                    distances.append(distance)
            
            if not distances:
                 return {'success': False, 'error': 'No valid embeddings to compare against'}
            
            distances.sort()  # Sort ascending (best matches first)
            
            # Use central threshold from service
            from apps.faces.deepface_service import DeepFaceService
            
            # --- k-NN Logic (Voting) ---
            # If we have enough data (>= 5 samples), use voting
            if len(distances) >= 5:
                k = 3
                top_k = distances[:k]
                avg_distance = sum(top_k) / len(top_k)
                
                # Check 1: Average of top 3 is good
                # We expect average to be slightly higher than best, so we use the relaxed threshold 
                is_match = avg_distance < DeepFaceService.THRESHOLD
                
                # Check 2: At least 2 are VERY good (strict match)
                # This saves cases where 1 match is bad but 2 are excellent
                strict_threshold = 0.15
                strong_matches = len([d for d in top_k if d < strict_threshold])
                if strong_matches >= 2:
                    is_match = True
                    
                match_score = round(1 - avg_distance, 3)
                final_distance = round(avg_distance, 3)
                match_type = f"k-NN (avg top {k})"
            else:
                # Not enough data, fall back to single best match
                # But use a slightly stricter check since we lack voting confidence
                best_distance = distances[0]
                is_match = best_distance < DeepFaceService.THRESHOLD
                match_score = round(1 - best_distance, 3)
                final_distance = round(best_distance, 3)
                match_type = "Single Best (Low Data)"

            if not is_match:
                return {
                    'success': False,
                    'error': f'Face verification failed ({match_type}, dist: {final_distance})',
                    'distance': final_distance
                }
            
            return {
                'success': True,
                'confidence': match_score,
                'distance': final_distance,
                'method': match_type
            }
        except Exception as e:
            return {'success': False, 'error': f'Face verification error: {str(e)}'}
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
    
    def _run_yolo_detection(self, org, image_file):
        """Run YOLO detection on vehicle image, return detections AND annotated image.
        Only detects classes that user has marked as 'required' in the YOLO model settings.
        """
        from core.models import DetectionRequirement
        
        # Get active YOLO model for org
        yolo_model = CustomYoloModel.objects.filter(
            organization=org,
            is_active=True
        ).first()
        
        if not yolo_model:
            return {
                'detections': {},
                'model_id': None,
                'annotated_image': None,
                'message': 'No YOLO model configured'
            }
        
        # Get required classes from database (only detect what user selected)
        required_classes = list(
            DetectionRequirement.objects.filter(
                yolo_model=yolo_model,
                is_required=True
            ).values_list('class_name', flat=True)
        )
        
        if not required_classes:
            return {
                'detections': {},
                'model_id': str(yolo_model.id),
                'annotated_image': None,
                'message': 'No classes marked as required'
            }
        
        # Save temp file and load image
        import tempfile
        import os
        import cv2
        import numpy as np
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
            for chunk in image_file.chunks():
                temp_file.write(chunk)
            temp_path = temp_file.name
        
        # Load image for quality validation
        img = cv2.imread(temp_path)
        if img is None:
            return {
                'detections': {},
                'model_id': str(yolo_model.id) if yolo_model else None,
                'annotated_image': None,
                'message': 'Failed to load image',
                'quality_check': {'passed': False, 'errors': ['Invalid image file']}
            }
        
        # 1. IMAGE QUALITY VALIDATION
        from ml.image_quality import validate_image_quality
        quality_result = validate_image_quality(
            img,
            blur_threshold=50.0,       # Laplacian variance threshold (lowered for mobile cameras)
            dark_threshold=50,          # Min brightness
            bright_threshold=200        # Max brightness
        )
        
        if not quality_result['passed']:
            # Cleanup temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            
            return {
                'detections': {},
                'model_id': str(yolo_model.id) if yolo_model else None,
                'annotated_image': None,
                'message': quality_result['summary'],
                'quality_check': quality_result
            }
        
        try:
            from apps.detection.yolo_service import get_yolo_service
            yolo_service = get_yolo_service()
            
            # Load custom model (cached)
            model_id = f"custom_{yolo_model.id}"
            yolo_service.load_model(yolo_model.model_file.path, model_id)
            
            # Filter classes (names overlap check)
            # Service handles this via allowed_classes logic
            
            print(f"YOLO filtering to classes: {required_classes}")
            
            # Run detection using service
            results = yolo_service.detect_with_details(
                temp_path, 
                model_id, 
                allowed_classes=required_classes
            )
            
            # Count detections by class
            detections = {}
            if results:
                for det in results:
                    class_name = det['class']
                    detections[class_name] = detections.get(class_name, 0) + 1
            
                # Generate Annotated Image (Manual Drawing since results is list of dicts)
                import cv2
                annotated_img = img.copy()
                
                for det in results:
                    bbox = det.get('bbox')
                    if bbox:
                        x1, y1, x2, y2 = map(int, bbox)
                        label = det.get('class', 'Unknown')
                        
                        # Draw Box (Green)
                        cv2.rectangle(annotated_img, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        
                        # Draw Label
                        text_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)[0]
                        cv2.rectangle(annotated_img, (x1, y1 - 20), (x1 + text_size[0], y1), (0, 255, 0), -1)
                        cv2.putText(annotated_img, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)
                
                res_plotted = annotated_img
                
                # 2. NUMBER PLATE OCR EXTRACTION
                from ml.plate_ocr import extract_plate_from_yolo_result
                ocr_result = extract_plate_from_yolo_result(img, results)
                print(f"DEBUG: OCR Result in _run_yolo_detection: {ocr_result}")
                
                # Convert to bytes
                import io
                is_success, buffer = cv2.imencode(".jpg", res_plotted)
                if is_success:
                    return {
                        'detections': detections,
                        'model_id': str(yolo_model.id),
                        'annotated_image': buffer.tobytes(),
                        'plate_number': ocr_result.get('plate_number', ''),
                        'plate_confidence': ocr_result.get('confidence', 0.0),
                        'quality_check': quality_result,
                        'message': 'Detection successful'
                    }
                    
            return {
                'detections': {},
                'model_id': str(yolo_model.id),
                'annotated_image': None,
                'message': 'No vehicles detected'
            }
            
        except Exception as e:
            return {
                'detections': {},
                'model_id': str(yolo_model.id) if yolo_model else None,
                'annotated_image': None,
                'message': f'YOLO Error: {str(e)}'
            }
        finally:
            # Cleanup temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)

    @action(detail=False, methods=['post'], url_path='verify-liveness')
    def verify_liveness(self, request):
        """
        Stateless Verification for Client-Side UI Feedback.
        Does NOT create a Trip. Just verifies the face/liveness.
        
        POST /trips/verify-liveness/
        Body: employee_id, org_code, frames[] (or image)
        """
        org_code = request.data.get('org_code', '').upper().strip()
        employee_id = request.data.get('employee_id', '').strip()
        image_file = request.FILES.get('image')
        frame_files = request.FILES.getlist('frames')
        challenge_frame = request.data.get('challenge_frame')
        
        if not org_code or not employee_id:
            return Response({'error': 'org_code and employee_id required'}, status=400)
        
        logger.info(f"🔍 VERIFY-LIVENESS: org={org_code}, employee={employee_id}, frames={len(frame_files)}, has_image={bool(image_file)}")
        
        # Early return if no image data at all
        if not image_file and not frame_files:
            return Response({'error': 'No image or frames provided', 'retry': True}, status=400)
            
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
            employee = SaaSEmployee.objects.get(organization=org, employee_id=employee_id, status='active')
            
            # Run Verification
            face_result = self._verify_face(
                employee, 
                image_file if image_file else frame_files[len(frame_files)//2] if frame_files else None,
                org,
                frame_files=frame_files if len(frame_files) >= 5 else None,
                challenge_frame=challenge_frame
            )
            
            if face_result['success']:
                logger.info(f"✅ VERIFY-LIVENESS PASSED: {employee.full_name}")
                return Response({'success': True, 'message': 'Liveness Verified', 'employee_name': employee.full_name})
            else:
                error_msg = face_result.get('error', 'Unknown Error')
                logger.warning(f"❌ VERIFY-LIVENESS FAILED: {employee.full_name} — {error_msg}")
                
                # Special Case: No Embeddings = 400 (Do not retry)
                if 'not enrolled' in error_msg or 'Face not enrolled' in error_msg:
                    return Response(face_result, status=400)
                    
                return Response(face_result, status=401)
                
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found', 'retry': False}, status=400)
        except SaaSEmployee.DoesNotExist:
            return Response({'error': 'Employee not found', 'retry': False}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['post'], url_path='unified-checkin')
    def unified_checkin(self, request):
        """
        Atomic Check-in for Single Screen Flow.
        Creates Trip ONLY after all data is received and validated.
        
        POST /trips/unified-checkin/
        """
        import json
        
        # 1. Parse Data
        try:
            org_code = request.data.get('org_code', '').upper().strip()
            driver_id = request.data.get('driver_id', '').strip()
            route_id = request.data.get('route_id')
            
            # Driver Images
            driver_frames = request.FILES.getlist('driver_frames')
            driver_chal = request.data.get('driver_challenge_frame')
            
            # Helper Data (Optional)
            helper_id = request.data.get('helper_id', '').strip()
            helper_frames = request.FILES.getlist('helper_frames')
            helper_chal = request.data.get('helper_challenge_frame')
            
            # Vehicle Data
            vehicle_image = request.FILES.get('vehicle_image')
            
            # GPS
            lat = request.data.get('latitude')
            lng = request.data.get('longitude')
            
            # Vehicle ID
            vehicle_id = request.data.get('vehicle_id')
            
            
        except Exception as e:
            return Response({'error': f"Data Parse Error: {str(e)}"}, status=400)
            
        if not org_code or not driver_id:
            return Response({'error': "Driver ID and Org Code Required"}, status=400)
        
        try:
            from django.db import transaction
            # ATOMIC BLOCK START
            with transaction.atomic():
                org = Organization.objects.get(org_code=org_code, is_active=True)
                
                # --- 1. Verify Driver ---
                driver = SaaSEmployee.objects.get(organization=org, employee_id=driver_id, status='active')

                # [FIX] Check for Existing Active Trip (Prevent Duplicates)
                from datetime import date
                if Trip.objects.filter(driver=driver, status='active', date=date.today()).exists():
                     # Handle Race Condition: If duplicate check-in within seconds
                     return Response({'error': "Driver already has an active trip today! Please Checkout first."}, status=400)
                
                # Re-run liveness (Security check)
                if not driver_frames: 
                    return Response({'error': "Driver frames missing"}, status=400)
                    
                driver_res = self._verify_face(
                    driver, driver_frames[len(driver_frames)//2], org, 
                    frame_files=driver_frames, challenge_frame=driver_chal,
                    skip_liveness=True  # Already verified via verify-liveness
                )
                if not driver_res['success']:
                    raise Exception(f"Driver Verification Failed: {driver_res.get('error')}")
                    
                # Setup Driver Detection Record
                now = timezone.now()
                driver_det = LoginDetectionResult.objects.create(
                    organization=org, employee=driver, face_confidence=driver_res.get('confidence', 0),
                    detections={}, compliance_passed=True
                )
                from django.core.files.base import ContentFile
                driver_frames[len(driver_frames)//2].seek(0)  # Reset file pointer after _verify_face
                driver_det.frame_image.save(
                    f'{driver_id}_unified.jpg', ContentFile(driver_frames[len(driver_frames)//2].read()), save=True
                )

                # --- 2. Verify Helper (If exists) ---
                helper = None
                helper_det = None
                if helper_id:
                    if helper_id == driver_id:
                        raise Exception("Driver cannot be Helper")
                        
                    helper = SaaSEmployee.objects.get(organization=org, employee_id=helper_id, status='active')
                    
                    if not helper_frames:
                        raise Exception("Helper frames missing")
                        
                    helper_res = self._verify_face(
                        helper, helper_frames[len(helper_frames)//2], org, 
                        frame_files=helper_frames, challenge_frame=helper_chal,
                        skip_liveness=True  # Already verified via verify-liveness
                    )
                    if not helper_res['success']:
                        raise Exception(f"Helper Verification Failed: {helper_res.get('error')}")
                        
                    helper_det = LoginDetectionResult.objects.create(
                        organization=org, employee=helper, face_confidence=helper_res.get('confidence', 0),
                        detections={}, compliance_passed=True
                    )
                    helper_frames[len(helper_frames)//2].seek(0)  # Reset file pointer after _verify_face
                    helper_det.frame_image.save(
                        f'{helper_id}_unified.jpg', ContentFile(helper_frames[len(helper_frames)//2].read()), save=True
                    )
                
                # --- 3. Verify Vehicle ---
                if not vehicle_image:
                    raise Exception("Vehicle Image Missing")
                    
                yolo_res = self._run_yolo_detection(org, vehicle_image)
                
                from core.models import CustomYoloModel, Vehicle
                yolo_model = CustomYoloModel.objects.filter(organization=org, is_active=True).first()
                compliance_result = check_full_compliance(yolo_res['detections'], yolo_model)
                
                # --- NEW OCR MATCHING LOGIC ---
                import difflib
                detected_plate = yolo_res.get('plate_number', '').strip().upper()
                final_plate = detected_plate
                vehicle_obj = None
                
                if vehicle_id:
                    vehicle_obj = Vehicle.objects.filter(id=vehicle_id).first()
                    if vehicle_obj:
                        expected_plate = vehicle_obj.plate_number.strip().upper()
                        # Allow minor OCR errors (e.g. 0 vs O, missing character)
                        if detected_plate and expected_plate:
                            similarity = difflib.SequenceMatcher(None, detected_plate, expected_plate).ratio()
                            if similarity >= 0.70:
                                # Overwrite messy OCR with actual clean DB plate
                                final_plate = expected_plate
                                # Guarantee plate compliance if it matches our expected vehicle
                                if 'required_classes' in compliance_result:
                                    if 'number_plate' in compliance_result['required_classes']:
                                        compliance_result['required_classes']['number_plate']['passed'] = True
                                        compliance_result['passed'] = all(c['passed'] for c in compliance_result['required_classes'].values())

                vehicle_rec = VehicleComplianceRecord.objects.create(
                    organization=org, yolo_model_id=yolo_res.get('model_id'),
                    detections=yolo_res['detections'], 
                    plate_number=final_plate,  # Save clean plate if matched
                    compliance_passed=compliance_result['passed'],
                    compliance_details=compliance_result
                )
                if yolo_res.get('annotated_image'):
                     vehicle_rec.vehicle_image.save(f'vehicle_unified.jpg', ContentFile(yolo_res['annotated_image']), save=True)
                else:
                     vehicle_image.seek(0)
                     vehicle_rec.vehicle_image.save(f'vehicle_unified.jpg', ContentFile(vehicle_image.read()), save=True)
                
                # --- 4. Create Trip ---
                route_obj = None
                if route_id:
                    from core.models import Route
                    route_obj = Route.objects.filter(id=route_id).first()

                trip = Trip.objects.create(
                    organization=org,
                    driver=driver,
                    helper=helper, # Can be None
                    route=route_obj,
                    vehicle=vehicle_obj, # Save selected vehicle
                    checkin_time=now,
                    checkin_driver_detection=driver_det,
                    checkin_helper_detection=helper_det,
                    checkin_vehicle=vehicle_rec,
                    checkin_compliance_passed=compliance_result['passed'],
                    checkin_latitude=lat,
                    checkin_longitude=lng,
                    
                    # Status logic
                    helper_skipped=not bool(helper),
                    status='checkin_complete'
                )
                
                return Response({
                    'success': True,
                    'message': 'Unified Check-in Complete!',
                    'trip_id': str(trip.id),
                    'compliance_passed': compliance_result['passed']
                })

        except Exception as e:
            # Transaction rolls back automatically on exception
            logger.error(f"Unified Checkin Error: {e}")
            return Response({'error': str(e)}, status=500)
    @action(detail=True, methods=['post'], url_path='unified-checkout')
    def unified_checkout(self, request, pk=None):
        """
        Atomic Checkout for Single Screen Flow.
        Completes Trip ONLY after all data is received and validated.
        
        POST /trips/{id}/unified-checkout/
        """
        trip = get_object_or_404(Trip, pk=pk)
        
        if trip.status == 'trip_completed' or trip.status == 'completed':
            return Response({'error': "Trip already completed"}, status=400)
            
        try:
            from django.db import transaction
            # ATOMIC BLOCK START
            with transaction.atomic():
                # Refresh trip to lock row and ensure status hasn't changed
                trip = Trip.objects.select_for_update().get(pk=trip.pk)
                if trip.status == 'completed':
                     return Response({'error': "Trip already completed (Race Condition)"}, status=400)

                # 1. Driver Verification
                now = timezone.now()
                from django.core.files.base import ContentFile
                
                if trip.is_substitute_driver:
                    # SUBSTITUTE: Accept simple photo
                    sub_photo = request.FILES.get('driver_photo') or request.FILES.get('substitute_photo')
                    driver_det = LoginDetectionResult.objects.create(
                        organization=trip.organization, employee=trip.driver,
                        face_confidence=0.0,
                        detections={'substitute': True}, compliance_passed=True
                    )
                    if sub_photo:
                        sub_photo.seek(0)
                        driver_det.frame_image.save(
                            f'{trip.driver.employee_id}_sub_checkout_unified.jpg',
                            ContentFile(sub_photo.read()), save=True
                        )
                else:
                    # NORMAL: Face verification
                    driver_frames = request.FILES.getlist('driver_frames')
                    driver_chal = request.data.get('driver_challenge_frame')
                    
                    if not driver_frames:
                         return Response({'error': "Driver frames missing"}, status=400)
                         
                    driver_res = self._verify_face(
                        trip.driver, driver_frames[len(driver_frames)//2], trip.organization, 
                        frame_files=driver_frames, challenge_frame=driver_chal,
                        skip_liveness=True
                    )
                    if not driver_res['success']:
                        raise Exception(f"Driver Verification Failed: {driver_res.get('error')}")
                    
                    driver_det = LoginDetectionResult.objects.create(
                        organization=trip.organization, employee=trip.driver, 
                        face_confidence=driver_res.get('confidence', 0),
                        detections={}, compliance_passed=True
                    )
                    driver_frames[len(driver_frames)//2].seek(0)
                    driver_det.frame_image.save(
                        f'{trip.driver.employee_id}_checkout_unified.jpg', 
                        ContentFile(driver_frames[len(driver_frames)//2].read()), save=True
                    )
                
                # 2. Helper Verification (If enabled in trip)
                helper_det = None
                
                if trip.helper and not trip.helper_skipped:
                    if trip.is_substitute_helper:
                        # SUBSTITUTE: Accept simple photo
                        helper_photo = request.FILES.get('helper_photo') or request.FILES.get('substitute_helper_photo')
                        helper_det = LoginDetectionResult.objects.create(
                            organization=trip.organization, employee=trip.helper,
                            face_confidence=0.0,
                            detections={'substitute': True}, compliance_passed=True
                        )
                        if helper_photo:
                            helper_photo.seek(0)
                            helper_det.frame_image.save(
                                f'{trip.helper.employee_id}_sub_checkout_unified.jpg',
                                ContentFile(helper_photo.read()), save=True
                            )
                    else:
                        # NORMAL: Face verification
                        helper_frames = request.FILES.getlist('helper_frames')
                        helper_chal = request.data.get('helper_challenge_frame')
                        
                        if not helper_frames:
                            raise Exception("Helper frames missing for checkout")
                            
                        helper_res = self._verify_face(
                            trip.helper, helper_frames[len(helper_frames)//2], trip.organization,
                            frame_files=helper_frames, challenge_frame=helper_chal,
                            skip_liveness=True
                        )
                        if not helper_res['success']:
                            raise Exception(f"Helper Verification Failed: {helper_res.get('error')}")
                            
                        helper_det = LoginDetectionResult.objects.create(
                            organization=trip.organization, employee=trip.helper,
                            face_confidence=helper_res.get('confidence', 0),
                            detections={}, compliance_passed=True
                        )
                        helper_frames[len(helper_frames)//2].seek(0)
                        helper_det.frame_image.save(
                            f'{trip.helper.employee_id}_checkout_unified.jpg', 
                            ContentFile(helper_frames[len(helper_frames)//2].read()), save=True
                        )
                
                # 3. Vehicle Compliance
                vehicle_image = request.FILES.get('vehicle_image')
                if not vehicle_image:
                     raise Exception("Vehicle Image Missing")
                     
                yolo_res = self._run_yolo_detection(trip.organization, vehicle_image)
                yolo_model = CustomYoloModel.objects.filter(organization=trip.organization, is_active=True).first()
                compliance_result = check_full_compliance(yolo_res['detections'], yolo_model)
                
                vehicle_rec = VehicleComplianceRecord.objects.create(
                    organization=trip.organization, yolo_model_id=yolo_res.get('model_id'),
                    detections=yolo_res['detections'], 
                    plate_number=yolo_res.get('plate_number', ''), # FIX: Save Plate Number
                    compliance_passed=compliance_result['passed'],
                    compliance_details=compliance_result
                )
                if yolo_res.get('annotated_image'):
                     vehicle_rec.vehicle_image.save(f'vehicle_checkout_unified.jpg', ContentFile(yolo_res['annotated_image']), save=True)
                else:
                     vehicle_image.seek(0)
                     vehicle_rec.vehicle_image.save(f'vehicle_checkout_unified.jpg', ContentFile(vehicle_image.read()), save=True)

                # 4. Finalize Trip
                trip.checkout_driver_detection = driver_det
                trip.checkout_helper_detection = helper_det
                trip.checkout_vehicle = vehicle_rec
                trip.checkout_compliance_passed = compliance_result['passed']
                trip.checkout_time = now
                trip.checkout_latitude = request.data.get('latitude')
                trip.checkout_longitude = request.data.get('longitude')
                trip.status = 'completed'
                
                # Calc Duration
                if trip.checkin_time:
                    duration = now - trip.checkin_time
                    trip.work_duration = duration
                
                trip.save()
                
                return Response({
                    'success': True,
                    'message': 'Unified Checkout Complete!',
                    'trip_id': str(trip.id),
                    'work_duration': trip.work_duration
                })

        except Exception as e:
            logger.error(f"Unified Checkout Error: {e}")
            return Response({'error': str(e)}, status=500)
