from django.db.models import Q
from rest_framework.exceptions import PermissionDenied


def resource_allowed(user, obj, module, action):
    if user.can(f"{module}.{action}_all"):
        return True
    if action == "view":
        if user.can(f"{module}.view_shared") and (obj.created_by_id == user.pk or obj.created_by.role == "admin"):
            return True
        return user.can(f"{module}.view_assigned") and obj.assigned_students.filter(pk=user.pk).exists()
    if action == "assign":
        return user.can(f"{module}.assign_shared") and (obj.created_by_id == user.pk or obj.created_by.role == "admin")
    return user.can(f"{module}.{action}_own") and obj.created_by_id == user.pk


def require_resource(user, obj, module, action):
    if not resource_allowed(user, obj, module, action):
        raise PermissionDenied("You do not have permission for this resource.")


def visible_resources(user, queryset, module):
    if user.can(f"{module}.view_all"):
        return queryset
    query = Q(pk__in=[])
    if user.can(f"{module}.view_shared"):
        query |= Q(created_by=user) | Q(created_by__role="admin")
    if user.can(f"{module}.view_assigned"):
        query |= Q(assigned_students=user)
    return queryset.filter(query).distinct()
