import math
from django.core.cache import cache
from django.db import transaction
from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import User
from apps.users.permissions import IsAdmin


class AdminPendingUsersView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        try:
            page = int(request.query_params.get("page", 1))
        except ValueError:
            page = 1

        if page <= 0:
            return Response(
                {"success": False, "message": "Page number must be greater than 0."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        limit = 10
        skip = (page - 1) * limit

        pending_users = User.objects.filter(
            is_approved=False,
            role="faculty"
        ).order_by("created_at")

        total_users = pending_users.count()
        if total_users == 0:
            return Response(
                {
                    "success": True,
                    "message": "No pending users found",
                    "data": [],
                    "totalPages": 0,
                    "totalUsers": 0,
                },
                status=status.HTTP_200_OK,
            )

        users_page = pending_users[skip:skip + limit]
        data = [
            {
                "_id": str(u.id),
                "email": u.email,
                "mobileNo": u.mobile_no,
                "username": u.username,
                "branch": u.branch,
                "semester": u.semester,
                "batch": u.batch,
                "subject": u.subject,
            }
            for u in users_page
        ]

        return Response({
            "success": True,
            "data": data,
            "total": total_users,
            "totalPages": math.ceil(total_users / limit),
            "currentPage": page,
        }, status=status.HTTP_200_OK)


class AdminAcceptRequestView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        user_id = request.data.get("userId")
        if not user_id:
            return Response(
                {"success": False, "message": "User ID is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(id=user_id)
        except (User.DoesNotExist, ValueError):
            return Response(
                {"success": False, "message": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.is_approved:
            return Response(
                {"success": False, "message": "User is already approved"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.role == "faculty":
            email_prefix = user.email.split("@")[0] if user.email else user.username
            user.set_password(email_prefix)

        user.is_approved = True
        user.save()
        cache.delete("faculty_subjects_list")

        return Response({
            "success": True,
            "message": "User request accepted and approved",
            "data": {
                "username": user.username,
                "email": user.email,
                "branch": user.branch,
                "semester": user.semester,
                "batch": user.batch,
            },
        }, status=status.HTTP_200_OK)


class AdminDeclineRequestView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        user_id = request.data.get("userId")
        if not user_id:
            return Response(
                {"success": False, "message": "User ID is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(id=user_id)
        except (User.DoesNotExist, ValueError):
            return Response(
                {"success": False, "message": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        user.delete()
        return Response({
            "success": True,
            "message": "User request declined and user removed successfully",
        }, status=status.HTTP_200_OK)


class AdminAcceptAllRequestsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        pending_users = list(User.objects.filter(is_approved=False, role="faculty"))
        if not pending_users:
            return Response(
                {"success": False, "message": "No pending faculty users to approve"},
                status=status.HTTP_404_NOT_FOUND,
            )

        approved_count = 0
        with transaction.atomic():
            for user in pending_users:
                email_prefix = user.email.split("@")[0] if user.email else user.username
                user.set_password(email_prefix)
                user.is_approved = True
                user.save()
                approved_count += 1

        cache.delete("faculty_subjects_list")

        return Response({
            "success": True,
            "message": f"{approved_count} faculty users have been approved",
        }, status=status.HTTP_200_OK)


class AdminDeclineAllRequestsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        pending_users = User.objects.filter(is_approved=False, role="faculty")
        deleted_count = pending_users.count()
        if deleted_count == 0:
            return Response(
                {"success": False, "message": "No pending users to decline"},
                status=status.HTTP_404_NOT_FOUND,
            )

        pending_users.delete()
        return Response({
            "success": True,
            "message": f"{deleted_count} users have been declined and removed successfully",
        }, status=status.HTTP_200_OK)


class AdminGetFacultyView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        page = int(request.data.get("page") or request.query_params.get("page", 1))
        limit = int(request.data.get("limit") or request.query_params.get("limit", 10))
        skip = (page - 1) * limit

        faculties = User.objects.filter(role="faculty", is_approved=True).order_by("-created_at")
        total_faculty = faculties.count()
        page_faculties = faculties[skip:skip + limit]

        data = [
            {
                "_id": str(u.id),
                "id": u.student_id or str(u.id),
                "username": u.username,
                "branch": u.branch,
                "email": u.email,
                "subject": u.subject,
                "sessionId": u.session_id,
                "lastLoginTime": u.last_login_time,
                "createdAt": u.created_at,
            }
            for u in page_faculties
        ]

        return Response({
            "success": True,
            "message": "Faculty fetched successfully.",
            "facultys": data,
            "totalPages": math.ceil(total_faculty / limit) if limit > 0 else 1,
            "currentPage": page,
            "totalStudents": total_faculty,
        }, status=status.HTTP_200_OK)


class AdminDeleteFacultyView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def delete(self, request):
        faculty_id = request.data.get("facultyId") or request.query_params.get("facultyId")
        if not faculty_id:
            return Response(
                {"success": False, "message": "Faculty ID is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(
            Q(id=faculty_id if len(faculty_id) == 36 or '-' in faculty_id else None) |
            Q(student_id=faculty_id) |
            Q(username=faculty_id)
        ).first()

        if not user:
            return Response(
                {"success": False, "message": "Faculty not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        user.delete()
        cache.delete("faculty_subjects_list")
        return Response({
            "success": True,
            "message": "Faculty deleted successfully",
        }, status=status.HTTP_200_OK)


class AdminTerminateSessionView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        user_id = request.data.get("userId")
        id_or_email = request.data.get("idOrEmail")

        if not user_id and not id_or_email:
            return Response(
                {"success": False, "message": "User ID or ID/Email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = None
        if user_id:
            user = User.objects.filter(
                Q(id=user_id if len(str(user_id)) == 36 or '-' in str(user_id) else None) |
                Q(student_id=str(user_id))
            ).first()
        elif id_or_email:
            clean_val = id_or_email.strip().lower()
            user = User.objects.filter(
                Q(student_id__iexact=clean_val) |
                Q(email__iexact=clean_val) |
                Q(username__iexact=clean_val)
            ).first()

        if not user:
            return Response(
                {"success": False, "message": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        user.session_id = None
        user.save(update_fields=["session_id"])

        return Response(
            {
                "success": True,
                "message": f"Session terminated successfully for {user.username or user.student_id}. The user can now log in.",
                "data": {
                    "userId": str(user.id),
                    "id": user.student_id or str(user.id),
                    "email": user.email,
                    "username": user.username,
                    "hasActiveSession": False,
                },
            },
            status=status.HTTP_200_OK,
        )


class AdminUsersSessionsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        try:
            page = int(request.query_params.get("page", 1))
            limit = int(request.query_params.get("limit", 10))
        except ValueError:
            page = 1
            limit = 10

        search = (request.query_params.get("search") or "").strip()
        role = request.query_params.get("role", "all")
        session_status = request.query_params.get("status", "all")

        skip = (page - 1) * limit
        qs = User.objects.filter(is_approved=True)

        if role and role != "all":
            qs = qs.filter(role=role)

        if session_status == "active":
            qs = qs.filter(session_id__isnull=False).exclude(session_id="")
        elif session_status == "inactive":
            qs = qs.filter(Q(session_id__isnull=True) | Q(session_id=""))

        if search:
            qs = qs.filter(
                Q(student_id__icontains=search) |
                Q(email__icontains=search) |
                Q(username__icontains=search) |
                Q(branch__icontains=search) |
                Q(batch__icontains=search)
            )

        total_users = qs.count()
        active_count = User.objects.filter(
            is_approved=True, session_id__isnull=False
        ).exclude(session_id="").count()

        users_page = qs.order_by("-last_login_time", "-created_at")[skip:skip + limit]

        data = [
            {
                "_id": str(u.id),
                "id": u.student_id or str(u.id),
                "username": u.username,
                "email": u.email,
                "role": u.role,
                "branch": u.branch,
                "semester": u.semester,
                "batch": u.batch,
                "subject": u.subject,
                "hasActiveSession": bool(u.session_id),
                "lastLoginTime": u.last_login_time,
                "createdAt": u.created_at,
            }
            for u in users_page
        ]

        return Response(
            {
                "success": True,
                "users": data,
                "totalUsers": total_users,
                "activeSessionsCount": active_count,
                "totalPages": math.ceil(total_users / limit) if limit > 0 else 1,
                "currentPage": page,
            },
            status=status.HTTP_200_OK,
        )
