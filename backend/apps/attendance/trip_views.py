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
                'checkin_compliance_details': trip.checkin_vehicle.compliance_details if trip.checkin_vehicle else None,
                # Check-out images
                'checkout_driver_image': get_image_url(trip.checkout_driver_detection),
                'checkout_helper_image': get_image_url(trip.checkout_helper_detection),
                'checkout_vehicle_image': get_vehicle_image_url(trip.checkout_vehicle),
                'checkout_vehicle_detections': trip.checkout_vehicle.detections if trip.checkout_vehicle else None,
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
            })
        
        return Response({'trips': data})

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
            'checkin_time': trip.checkin_time.isoformat() if trip.checkin_time else None
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
        
        # Check for frame-burst upload (passive liveness)
        frame_files = request.FILES.getlist('frames')  # Multiple frames
        challenge_frame = request.data.get('challenge_frame') # Active liveness sync
        
        if not org_code or not employee_id or (not image_file and not frame_files):
            return Response({'error': 'org_code, employee_id, and image (or frames) required'}, status=400)
        
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
        
        # Verify face (with optional passive liveness if frames provided)
        # If frame_files has 8+ frames, passive liveness runs first
        # Otherwise falls back to single-frame YOLO check
        face_result = self._verify_face(
            employee, 
            image_file if image_file else frame_files[len(frame_files)//2] if frame_files else None,
            org,
            frame_files=frame_files if len(frame_files) >= 8 else None,
            challenge_frame=challenge_frame
        )
        if not face_result['success']:
            return Response(face_result, status=401)

        now = timezone.now()
        
        # Save face detection result
        detection = LoginDetectionResult.objects.create(
            organization=org,
            employee=employee,
            face_confidence=face_result.get('confidence', 0),
            detections={},
            compliance_passed=True
        )
        from django.core.files.base import ContentFile
        
        # Save frame image (handle both single image and frame-burst modes)
        if image_file:
            # Single image mode
            image_file.seek(0)
            detection.frame_image.save(
                f'{employee_id}_{now.strftime("%Y%m%d_%H%M%S")}_{"helper" if employee.role == "helper" else "driver"}.jpg',
                ContentFile(image_file.read()),
                save=True
            )
        elif frame_files and len(frame_files) > 0:
            # Frame-burst mode - save middle frame
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
            status='driver_checked_in'
        )
        
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
        Body: employee_id, password, image (face photo)
        """
        trip = get_object_or_404(Trip, pk=pk)
        
        if trip.status not in ['driver_checked_in']:
            return Response({
                'error': f'Cannot add helper. Trip status: {trip.status}'
            }, status=400)
        
        employee_id = request.data.get('employee_id', '').strip()
        password = request.data.get('password', '').strip()
        image_file = request.FILES.get('image')
        
        if not employee_id or not image_file:
            return Response({'error': 'employee_id and image required'}, status=400)
        
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
        
        # Verify face
        face_result = self._verify_face(helper, image_file, trip.organization)
        if not face_result['success']:
            return Response(face_result, status=401)
        
        # Save detection
        now = timezone.now()
        detection = LoginDetectionResult.objects.create(
            organization=trip.organization,
            employee=helper,
            face_confidence=face_result['confidence'],
            detections={},
            compliance_passed=True
        )
        from django.core.files.base import ContentFile
        image_file.seek(0)
        detection.frame_image.save(
            f'{employee_id}_{now.strftime("%Y%m%d_%H%M%S")}_helper.jpg',
            ContentFile(image_file.read()),
            save=True
        )
        
        # Update Trip
        trip.helper = helper
        trip.checkin_helper_detection = detection
        trip.status = 'helper_checked_in'
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
        if not image_file:
            return Response({'error': 'Vehicle image required'}, status=400)
        
        # Run YOLO detection
        yolo_result = self._run_yolo_detection(trip.organization, image_file)
        
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
        
        # Check for frame-burst upload (passive liveness)
        frame_files = request.FILES.getlist('frames')  # Multiple frames
        
        if not image_file and not frame_files:
            return Response({'error': 'Face image or frames required'}, status=400)
        
        # Determine who to verify: If driver is a dummy (helper-as-driver scenario), verify helper instead
        is_helper_as_driver = trip.driver.employee_id.startswith('DUMMY_DRIVER_')
        verify_employee = trip.helper if is_helper_as_driver and trip.helper else trip.driver
        
        # Verify face (with optional passive liveness if frames provided)
        # Extract challenge frame active liveness key
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
        
        # Save detection (record against the actual person being verified)
        now = timezone.now()
        detection = LoginDetectionResult.objects.create(
            organization=trip.organization,
            employee=verify_employee,
            face_confidence=face_result['confidence'],
            detections={},
            compliance_passed=True
        )
        from django.core.files.base import ContentFile
        
        # Save frame image (handle both single image and frame-burst modes)
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
        
        if not image_file:
            return Response({'error': 'Face image required'}, status=400)
        
        # Verify it's the same helper
        if employee_id and employee_id != trip.helper.employee_id:
            return Response({'error': 'Helper ID does not match trip'}, status=400)
        
        # Verify password
        if password and trip.helper.password and trip.helper.password != password:
            return Response({'error': 'Invalid password'}, status=401)
        
        # Verify face
        face_result = self._verify_face(trip.helper, image_file, trip.organization)
        if not face_result['success']:
            return Response(face_result, status=401)
        
        # Save detection
        now = timezone.now()
        detection = LoginDetectionResult.objects.create(
            organization=trip.organization,
            employee=trip.helper,
            face_confidence=face_result['confidence'],
            detections={},
            compliance_passed=True
        )
        from django.core.files.base import ContentFile
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
        
        # Run YOLO detection
        yolo_result = self._run_yolo_detection(trip.organization, image_file)
        
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
        trip.status = 'completed'
        trip.calculate_work_duration()
        
        return Response({
            'success': True,
            'trip_id': str(trip.id),
            'compliance_passed': compliance_result['passed'],
            'compliance_summary': compliance_result['summary'],
            'work_duration': str(trip.work_duration) if trip.work_duration else None,
            'message': 'Trip completed successfully!' if compliance_result['passed'] else 'Trip completed but checkout compliance failed'
        })
    
    def _verify_face(self, employee, image_file, org, frame_files=None, challenge_frame=None):
        """Verify employee face against stored embeddings with optional passive liveness."""
        stored_embeddings = employee.face_embeddings or employee.heavy_embeddings
        if not stored_embeddings:
            return {
                'success': False,
                'error': 'No face embeddings found. Please train face model first.'
            }
        
        import tempfile
        import os
        import cv2
        
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
                    error_msg = liveness_result.get('details', {}).get('msg', 'Liveness check failed. This appears to be a replay attack.')
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
                from ultralytics import YOLO
                # Load Medium model (Better at detecting phones/laptops than Nano)
                yolo_spoof = YOLO('yolov8m.pt') 
                spoof_results = yolo_spoof(temp_path, verbose=False)
                
                # COCO Classes: 67=cell phone, 63=laptop, 62=tv
                SPOOF_CLASSES = [67, 63, 62] 
                
                for r in spoof_results:
                    for box in r.boxes:
                        cls_id = int(box.cls[0])
                        conf = float(box.conf[0])
                        obj_name = yolo_spoof.names[cls_id]
                        
                        # Log everything we see for debugging
                        if conf > 0.2:
                             logger.info(f"👀 YOLO Saw: {obj_name} ({conf:.2f})")

                        # Confidence threshold 0.25 (User requested adjustment)
                        if cls_id in SPOOF_CLASSES:
                            if conf > 0.25:
                                logger.warning(f"❌ Spoof Object Detected: {obj_name} ({conf:.2f})")
                                return {
                                    'success': False, 
                                    'error': f"Spoof Detected: We see a {obj_name} in the frame! Real faces only.",
                                    'liveness_failed': True
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
                return {'success': False, 'error': result.get('error', 'Face processing failed')}

            # ========== PROXIMITY CHECK (Force Context for YOLO) ==========
            # If face takes up > 50% of image width (Tightened from 55%)
            bbox = result.get('facial_area', []) # [x1, y1, x2, y2]
            img_size = result.get('image_size', []) # [w, h]
            
            if bbox and img_size and len(bbox) == 4 and len(img_size) == 2:
                face_w = bbox[2] - bbox[0]
                img_w = img_size[0]
                ratio = face_w / img_w
                
                # Threshold: 0.40 (40% of screen width)
                # Tightened to force spoofers back, revealing the phone bezel for YOLO.
                if ratio > 0.40:
                     logger.warning(f"⚠️ Face too close (Ratio: {ratio:.2f}). Rejecting.")
                     return {
                        'success': False, 
                        'error': "Too Close! Please move back so we can see your shoulders.",
                        'pose_error': True 
                    }
            # =============================================================
            
            # Check Pose from result
            pose_result = result.get('pose', {})
            if not pose_result.get('is_frontal', True):
                return {
                    'success': False,
                    'error': f"Please look straight at the camera. {pose_result.get('error', 'Face not frontal')}",
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
        
        # Save temp file
        import tempfile
        import os
        import cv2
        import numpy as np
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
            for chunk in image_file.chunks():
                temp_file.write(chunk)
            temp_path = temp_file.name
        
        try:
            from ultralytics import YOLO
            model = YOLO(yolo_model.model_file.path)
            
            # Get class IDs for required classes only
            class_ids = []
            required_lower = [c.lower() for c in required_classes]
            for idx, name in model.names.items():
                if name.lower() in required_lower:
                    class_ids.append(idx)
            
            print(f"YOLO filtering to classes: {required_classes} -> IDs: {class_ids}")
            
            # Run detection with class filter
            results = model(temp_path, classes=class_ids if class_ids else None)
            
            # Count detections by class
            detections = {}
            if results and len(results) > 0:
                for r in results:
                    for box in r.boxes:
                        class_id = int(box.cls[0])
                        class_name = r.names[class_id]
                        detections[class_name] = detections.get(class_name, 0) + 1
            
            # Generate Annotated Image (with boxes, without confidence scores for cleaner UX)
            annotated_image = None
            if results and len(results) > 0:
                im_array = results[0].plot(conf=False)  # conf=False removes confidence percentages
                success, encoded_img = cv2.imencode('.jpg', im_array)
                if success:
                    annotated_image = encoded_img.tobytes()
            
            return {
                'detections': detections,
                'model_id': str(yolo_model.id),
                'model_name': yolo_model.name,
                'annotated_image': annotated_image,
                'required_classes': required_classes
            }
        except Exception as e:
            print(f"YOLO Error: {e}")
            return {
                'detections': {},
                'model_id': str(yolo_model.id) if yolo_model else None,
                'annotated_image': None,
                'error': str(e)
            }
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
