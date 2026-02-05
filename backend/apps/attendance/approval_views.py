from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from core.models import Organization, SaaSEmployee as Employee

class ApproveEmployeeView(APIView):
    """
    Approve or Reject employee images.
    POST /api/v1/attendance/approve-employee/
    Body: { org_code, employee_id, status: 'approved'|'rejected' }
    """
    permission_classes = [AllowAny] # TODO: Add IsAuthenticated

    def post(self, request):
        org_code = request.data.get('org_code')
        employee_id = request.data.get('employee_id')
        status = request.data.get('status') # 'approved' or 'rejected'
        
        if not all([org_code, employee_id, status]):
            return Response({'error': 'Missing fields'}, status=400)
            
        try:
            org = Organization.objects.get(org_code=org_code, is_active=True)
            employee = Employee.objects.get(organization=org, employee_id=employee_id)
            
            if status == 'approved':
                employee.image_status = 'approved'
                employee.save()
                return Response({'success': True, 'message': f'Approved {employee.first_name}'})
                
            elif status == 'rejected':
                # Rejecting means we set back to pending so they can retake
                employee.image_status = 'pending'
                # Optional: Delete images? User said "manager can retake", usually implies clearing bad ones.
                # But safer to let them delete manually or overwrite. 
                # Let's just set status to pending for now and maybe clear image_count if we were deleting files
                # For now, just change status. Kiosk logic usually checks check (image_count > X) OR status.
                # If status is 'pending', Kiosk should force capture.
                employee.save()
                return Response({'success': True, 'message': f'Rejected {employee.first_name}. Marked for retake.'})
                
            else:
                return Response({'error': 'Invalid status'}, status=400)
                
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
