from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from apps.users.resource_access import require_resource


def require_problem_access(user, problem, at=None):
    require_resource(user, problem, "problems", "view")
    if not user.can("problems.view_all", "problems.view_shared"):
        contests = problem.contests.filter(assigned_students=user)
        at = at or timezone.now()
        if contests.exists() and not contests.filter(start_time__lte=at, end_time__gte=at).exists():
            raise PermissionDenied("This contest problem is only available during the contest.")
