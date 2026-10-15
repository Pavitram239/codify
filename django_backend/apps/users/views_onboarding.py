from apps.users.access_policy import ModulePermission
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from apps.users.models import User
from apps.users.onboarding import prepare_initial_password
from rest_framework import serializers


class IssueInitialPasswordView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def post(self, request):
        user_id = serializers.UUIDField().run_validation(request.data.get("userId"))
        user = get_object_or_404(User, pk=user_id)
        if not request.user.can("users.issue_password_all") and (user.role != "student" or user.faculty_id != request.user.pk):
            raise PermissionDenied("You can only issue passwords to your own students.")
        if not user.first_time_login:
            raise ValidationError("This account has already completed first login.")
        user.set_unusable_password()
        credential = prepare_initial_password(user)
        user.session_id = None
        user.save(update_fields=["password", "session_id"])
        response = Response({"success": True, "temporaryPasswords": [credential]})
        response["Cache-Control"] = "no-store"
        return response
