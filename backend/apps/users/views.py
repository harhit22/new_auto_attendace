"""
Views for User and Department management.
"""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from core.permissions import IsAdmin, IsManager, RoleBasedPermission, IsOwnerOrAdmin
from .models import User, Department, DeviceLog
from .serializers import (
    UserSerializer, UserCreateSerializer, UserMinimalSerializer,
    UserProfileSerializer, ChangePasswordSerializer,
    DepartmentSerializer, DeviceLogSerializer
)


class DepartmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Department management.
    
    Admin: Full access
    Manager: Read access
    Employee: Read access to own department
    """
    queryset = Department.objects.filter(deleted_at__isnull=True)
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'parent']
    search_fields = ['name', 'code']
    ordering_fields = ['name', 'created_at']
    
    role_permissions = {
        'list': ['admin', 'manager', 'employee'],
        'retrieve': ['admin', 'manager', 'employee'],
        'create': ['admin'],
        'update': ['admin'],
        'partial_update': ['admin'],
        'destroy': ['admin'],
    }
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Non-admins can only see active departments
        if self.request.user.role != 'admin':
            queryset = queryset.filter(is_active=True)
        
        return queryset
    
    @action(detail=True, methods=['get'])
    def employees(self, request, pk=None):
        """Get all employees in this department."""
        department = self.get_object()
        employees = department.users.filter(is_active=True, deleted_at__isnull=True)
        serializer = UserMinimalSerializer(employees, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def children(self, request, pk=None):
        """Get child departments."""
        department = self.get_object()
        children = department.children.filter(deleted_at__isnull=True)
        serializer = DepartmentSerializer(children, many=True)
        return Response(serializer.data)


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for User management.
    """
    queryset = User.objects.filter(deleted_at__isnull=True)
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['role', 'department', 'is_active']
    search_fields = ['name', 'email', 'employee_id']
    ordering_fields = ['name', 'created_at', 'employee_id']
    
    role_permissions = {
        'list': ['admin', 'manager'],
        'retrieve': ['admin', 'manager'],
        'create': ['admin'],
        'update': ['admin'],
        'partial_update': ['admin', 'manager'],
        'destroy': ['admin'],
    }
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Managers can only see users in their department
        if self.request.user.role == 'manager':
            queryset = queryset.filter(department=self.request.user.department)
        
        # Filter by enrollment status
        is_enrolled = self.request.query_params.get('is_enrolled')
        if is_enrolled is not None:
            if is_enrolled.lower() == 'true':
                queryset = queryset.filter(enrolled_at__isnull=False)
            else:
                queryset = queryset.filter(enrolled_at__isnull=True)
        
        return queryset
    
    @action(detail=False, methods=['get', 'put', 'patch'])
    def me(self, request):
        """Get or update current user's profile."""
        if request.method == 'GET':
            serializer = UserProfileSerializer(request.user)
            return Response(serializer.data)
        
        serializer = UserProfileSerializer(
            request.user,
            data=request.data,
            partial=request.method == 'PATCH'
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """Change current user's password."""
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        
        return Response({'message': 'Password changed successfully.'})
    
    @action(detail=True, methods=['get'])
    def device_logs(self, request, pk=None):
        """Get device logs for a user."""
        user = self.get_object()
        logs = user.device_logs.all()[:50]  # Limit to last 50
        serializer = DeviceLogSerializer(logs, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a user."""
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=['is_active', 'updated_at'])
        return Response({'message': f'User {user.name} has been deactivated.'})
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a user."""
        user = self.get_object()
        user.is_active = True
        user.save(update_fields=['is_active', 'updated_at'])
        return Response({'message': f'User {user.name} has been activated.'})


class DeviceLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing device logs (read-only).
    """
    queryset = DeviceLog.objects.all()
    serializer_class = DeviceLogSerializer
    permission_classes = [IsAuthenticated, IsManager]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['user', 'device_id', 'event_type']
    ordering_fields = ['created_at']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Managers can only see logs for their department
        if self.request.user.role == 'manager':
            queryset = queryset.filter(user__department=self.request.user.department)
        
        return queryset
