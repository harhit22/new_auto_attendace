"""
Custom permissions for role-based access control.
"""
from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """
    Permission check for admin users only.
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'admin'
        )


class IsManager(permissions.BasePermission):
    """
    Permission check for manager or admin users.
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['admin', 'manager']
        )


class IsEmployee(permissions.BasePermission):
    """
    Permission check for any authenticated employee.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Permission check for object owner or admin.
    """
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        # Check if obj has a user field
        if hasattr(obj, 'user'):
            return obj.user == request.user
        if hasattr(obj, 'user_id'):
            return obj.user_id == request.user.id
        return obj == request.user


class IsSameDepartmentOrAdmin(permissions.BasePermission):
    """
    Permission for users in the same department or admin.
    """
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        if request.user.role == 'manager':
            # Managers can access users in their department
            if hasattr(obj, 'department_id'):
                return obj.department_id == request.user.department_id
            if hasattr(obj, 'user') and hasattr(obj.user, 'department_id'):
                return obj.user.department_id == request.user.department_id
        return False


class ReadOnly(permissions.BasePermission):
    """
    Read-only permission (safe methods only).
    """
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS


class RoleBasedPermission(permissions.BasePermission):
    """
    Flexible role-based permission using view attributes.
    
    Usage in view:
        permission_classes = [RoleBasedPermission]
        required_roles = ['admin', 'manager']  # For all actions
        # OR
        role_permissions = {
            'list': ['admin', 'manager'],
            'create': ['admin'],
            'retrieve': ['admin', 'manager', 'employee'],
        }
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Check view-level required_roles
        required_roles = getattr(view, 'required_roles', None)
        if required_roles:
            return request.user.role in required_roles
        
        # Check action-specific role_permissions
        role_permissions = getattr(view, 'role_permissions', None)
        if role_permissions:
            action = getattr(view, 'action', None)
            if action and action in role_permissions:
                return request.user.role in role_permissions[action]
        
        # Default: allow authenticated users
        return True
