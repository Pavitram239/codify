from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Allows access only to users with role 'admin'."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "admin")


class IsFaculty(BasePermission):
    """Allows access only to users with role 'faculty'."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "faculty")


class IsAdminOrFaculty(BasePermission):
    """Allows access to either 'admin' or 'faculty' users."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ["admin", "faculty"]
        )


class IsStudent(BasePermission):
    """Allows access only to users with role 'student'."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "student")
