from apps.users.access_policy import VIEW_PERMISSIONS
from apps.users.access_policy import ModulePermission
import math
import secrets
from django.db import transaction
from django.db.models import Q
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from uuid import UUID
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import User
from apps.users.onboarding import prepare_initial_password
from apps.users.pagination import pagination_params


def require_faculty_scope(request, faculty_id):
    codes = VIEW_PERMISSIONS[type(request.parser_context["view"]).__name__][request.method]
    all_codes = [code for code in codes if code.endswith("_all")]
    if not request.user.can(*all_codes) and str(request.user.id) != str(faculty_id):
        raise PermissionDenied("You can only manage your own students.")


def managed_student(request, identifier):
    students = User.objects.filter(role="student")
    if not request.user.can("sessions.revoke_all" if request.method == "POST" else "users.delete_all"):
        students = students.filter(faculty=request.user)
    query = Q(student_id=identifier) | Q(username=identifier)
    try:
        query |= Q(id=UUID(str(identifier)))
    except (ValueError, TypeError, AttributeError):
        pass
    return students.filter(query).first()


class FacultyPendingUsersView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def get(self, request):
        faculty_id = request.query_params.get("facultyId")
        if not faculty_id:
            return Response(
                {"success": False, "message": "Faculty ID is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        require_faculty_scope(request, faculty_id)
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
            role="student",
            faculty__id=faculty_id if len(faculty_id) == 36 or '-' in faculty_id else None
        ).order_by("created_at")

        total_users = pending_users.count()
        if total_users == 0:
            return Response(
                {
                    "success": True,
                    "message": "No pending users found for this faculty",
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
                "id": u.student_id or str(u.id),
                "username": u.username,
                "mobileNo": u.mobile_no,
                "email": u.email,
                "branch": u.branch,
                "semester": u.semester,
                "batch": u.batch,
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


class FacultyAcceptRequestView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def post(self, request):
        user_id = request.data.get("userId")
        faculty_id = request.data.get("facultyId")

        if not user_id or not faculty_id:
            return Response(
                {"success": False, "message": "User ID and Faculty ID are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        require_faculty_scope(request, faculty_id)
        try:
            query = User.objects.filter(role="student")
            if not request.user.can("users.approve_all"):
                query = query.filter(faculty=request.user)
            user = query.get(id=user_id)
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

        if not user.faculty or str(user.faculty.id) != str(faculty_id):
            return Response(
                {"success": False, "message": "This student is not associated with the given faculty"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email_domain = "@charusat.edu.in"
        ident = (user.student_id or user.username).lower()
        user.email = f"{ident}{email_domain}"
        credential = prepare_initial_password(user)
        user.is_approved = True
        user.save()

        return Response({
            "success": True,
            "message": "User request accepted and approved",
            "temporaryPasswords": [credential] if credential else [],
            "data": {
                "id": user.student_id or str(user.id),
                "username": user.username,
                "email": user.email,
                "branch": user.branch,
                "semester": user.semester,
                "batch": user.batch,
            },
        }, status=status.HTTP_200_OK)


class FacultyDeclineRequestView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def post(self, request):
        user_id = request.data.get("userId")
        faculty_id = request.data.get("facultyId")

        if not user_id or not faculty_id:
            return Response(
                {"success": False, "message": "User ID and Faculty ID are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        require_faculty_scope(request, faculty_id)
        try:
            query = User.objects.filter(role="student")
            if not request.user.can("users.approve_all"):
                query = query.filter(faculty=request.user)
            user = query.get(id=user_id)
        except (User.DoesNotExist, ValueError):
            return Response(
                {"success": False, "message": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not user.faculty or str(user.faculty.id) != str(faculty_id):
            return Response(
                {"success": False, "message": "This student is not associated with the given faculty"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.delete()
        return Response({
            "success": True,
            "message": "User request declined and user removed successfully",
        }, status=status.HTTP_200_OK)


class FacultyAcceptAllRequestsView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def post(self, request):
        faculty_id = request.data.get("facultyId")
        if not faculty_id:
            return Response(
                {"success": False, "message": "Faculty ID is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        require_faculty_scope(request, faculty_id)
        pending_users = list(User.objects.filter(
            is_approved=False,
            role="student",
            faculty__id=faculty_id if len(faculty_id) == 36 or '-' in faculty_id else None
        ))

        if not pending_users:
            return Response(
                {"success": False, "message": "No pending users to approve for this faculty"},
                status=status.HTTP_404_NOT_FOUND,
            )

        approved_count = 0
        credentials = []
        with transaction.atomic():
            email_domain = "@charusat.edu.in"
            for user in pending_users:
                ident = (user.student_id or user.username).lower()
                user.email = f"{ident}{email_domain}"
                credential = prepare_initial_password(user)
                if credential:
                    credentials.append(credential)
                user.is_approved = True
                user.save()
                approved_count += 1

        return Response({
            "success": True,
            "message": f"{approved_count} users have been approved.",
            "temporaryPasswords": credentials,
        }, status=status.HTTP_200_OK)


class FacultyDeclineAllRequestsView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def post(self, request):
        faculty_id = request.data.get("facultyId")
        if not faculty_id:
            return Response(
                {"success": False, "message": "Faculty ID is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        require_faculty_scope(request, faculty_id)
        pending_users = User.objects.filter(
            is_approved=False,
            role="student",
            faculty__id=faculty_id if len(faculty_id) == 36 or '-' in faculty_id else None
        )

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


class FacultyBulkRegisterView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def post(self, request):
        faculty_id = request.data.get("facultyId")
        students = request.data.get("students")

        if not faculty_id:
            return Response({"message": "Faculty ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not students or not isinstance(students, list) or len(students) == 0:
            return Response({"message": "Invalid or missing students data."}, status=status.HTTP_400_BAD_REQUEST)

        require_faculty_scope(request, faculty_id)
        try:
            faculty = User.objects.get(id=faculty_id)
        except (User.DoesNotExist, ValueError):
            return Response({"message": "Faculty not found or invalid."}, status=status.HTTP_404_NOT_FOUND)

        results = {"success": [], "errors": []}

        for row_index, student in enumerate(students):
            username = student.get("username")
            sid = student.get("id")
            batch = student.get("batch")
            semester = student.get("semester")

            if not username or not sid or not batch or not semester:
                results["errors"].append({"id": sid, "rowIndex": row_index, "message": "Incomplete student data."})
                continue

            sid_str = str(sid).lower()
            if "cse" in sid_str:
                branch_code = "cse"
            elif "it" in sid_str:
                branch_code = "it"
            elif "ce" in sid_str:
                branch_code = "ce"
            elif "aiml" in sid_str or "ai" in sid_str:
                branch_code = "aiml"
            elif "ec" in sid_str:
                branch_code = "ec"
            elif "ee" in sid_str:
                branch_code = "ee"
            elif "me" in sid_str:
                branch_code = "me"
            elif "cl" in sid_str or "civil" in sid_str:
                branch_code = "cl"
            elif faculty.branch:
                branch_code = faculty.branch.replace("cspit-", "")
            else:
                branch_code = "ce"

            branch = f"cspit-{branch_code}"

            if User.objects.filter(Q(student_id__iexact=str(sid)) | Q(username__iexact=username)).exists():
                results["errors"].append({"id": sid, "rowIndex": row_index, "message": "User already exists."})
                continue

            try:
                initial_password = secrets.token_urlsafe(24)
                new_user = User.objects.create_user(
                    password=initial_password,
                    username=username,
                    student_id=str(sid),
                    email=f"{sid_str}@charusat.edu.in",
                    batch=batch,
                    semester=int(semester),
                    role="student",
                    is_approved=True,
                    faculty=faculty,
                    branch=branch,
                )
                credential = {"username": new_user.username, "temporaryPassword": initial_password}
                results["success"].append({"id": sid, "rowIndex": row_index, "message": "User registered successfully.", **credential})
            except Exception as e:
                results["errors"].append({"id": sid, "rowIndex": row_index, "message": f"Error registering user: {str(e)}"})

        return Response({"message": "Bulk registration completed.", "results": results}, status=status.HTTP_200_OK)


class FacultyGetStudentsView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def post(self, request):
        faculty_id = request.data.get("facultyId")
        if not faculty_id:
            return Response({"success": False, "message": "Faculty ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        require_faculty_scope(request, faculty_id)
        page, limit = pagination_params(request.data)
        skip = (page - 1) * limit

        students = User.objects.filter(
            faculty__id=faculty_id if len(faculty_id) == 36 or '-' in faculty_id else None,
            role="student",
            is_approved=True,
        ).order_by("student_id")

        total_students = students.count()
        page_students = students[skip:skip + limit]

        data = [
            {
                "_id": str(u.id),
                "username": u.username,
                "batch": u.batch,
                "branch": u.branch,
                "semester": u.semester,
                "id": u.student_id or str(u.id),
                "createdAt": u.created_at,
                "firstTimeLogin": u.first_time_login,
            }
            for u in page_students
        ]

        return Response({
            "success": True,
            "message": "Students fetched successfully.",
            "students": data,
            "totalPages": math.ceil(total_students / limit) if limit > 0 else 1,
            "currentPage": page,
            "totalStudents": total_students,
        }, status=status.HTTP_200_OK)


class FacultyExpireSessionView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def post(self, request):
        user_id = request.data.get("userId")
        if not user_id:
            return Response({"success": False, "message": "User ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        user = managed_student(request, user_id)

        if not user:
            return Response(
                {"success": False, "message": "User not found or already logged out."},
                status=status.HTTP_404_NOT_FOUND,
            )

        user.session_id = None
        user.save(update_fields=["session_id"])

        return Response({
            "success": True,
            "message": "Session expired successfully. User has been logged out.",
        }, status=status.HTTP_200_OK)


class FacultyRemoveUserView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def delete(self, request, userId):
        if not userId:
            return Response({"success": False, "message": "Missing User ID."}, status=status.HTTP_400_BAD_REQUEST)

        user = managed_student(request, userId)

        if not user:
            return Response({"success": False, "message": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        student_name = user.student_id or user.username
        user.delete()

        return Response({
            "success": True,
            "message": f"User with ID {student_name} and all related data have been successfully removed.",
        }, status=status.HTTP_200_OK)
