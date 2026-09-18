import math
from django.db import transaction
from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import User
from apps.users.permissions import IsAdminOrFaculty, IsFaculty


class FacultyPendingUsersView(APIView):
    permission_classes = [IsAuthenticated, IsFaculty]

    def get(self, request):
        faculty_id = request.query_params.get("facultyId")
        if not faculty_id:
            return Response(
                {"success": False, "message": "Faculty ID is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
    permission_classes = [IsAuthenticated, IsFaculty]

    def post(self, request):
        user_id = request.data.get("userId")
        faculty_id = request.data.get("facultyId")

        if not user_id or not faculty_id:
            return Response(
                {"success": False, "message": "User ID and Faculty ID are required"},
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

        if not user.faculty or str(user.faculty.id) != str(faculty_id):
            return Response(
                {"success": False, "message": "This student is not associated with the given faculty"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email_domain = "@charusat.edu.in"
        ident = (user.student_id or user.username).lower()
        user.email = f"{ident}{email_domain}"
        user.set_password(user.student_id or user.username)
        user.is_approved = True
        user.save()

        return Response({
            "success": True,
            "message": "User request accepted and approved",
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
    permission_classes = [IsAuthenticated, IsFaculty]

    def post(self, request):
        user_id = request.data.get("userId")
        faculty_id = request.data.get("facultyId")

        if not user_id or not faculty_id:
            return Response(
                {"success": False, "message": "User ID and Faculty ID are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(id=user_id)
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
    permission_classes = [IsAuthenticated, IsFaculty]

    def post(self, request):
        faculty_id = request.data.get("facultyId")
        if not faculty_id:
            return Response(
                {"success": False, "message": "Faculty ID is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
        with transaction.atomic():
            email_domain = "@charusat.edu.in"
            for user in pending_users:
                ident = (user.student_id or user.username).lower()
                user.email = f"{ident}{email_domain}"
                user.set_password(user.student_id or user.username)
                user.is_approved = True
                user.save()
                approved_count += 1

        return Response({
            "success": True,
            "message": f"{approved_count} users have been approved.",
        }, status=status.HTTP_200_OK)


class FacultyDeclineAllRequestsView(APIView):
    permission_classes = [IsAuthenticated, IsFaculty]

    def post(self, request):
        faculty_id = request.data.get("facultyId")
        if not faculty_id:
            return Response(
                {"success": False, "message": "Faculty ID is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
    permission_classes = [IsAuthenticated, IsFaculty]

    def post(self, request):
        faculty_id = request.data.get("facultyId")
        students = request.data.get("students")

        if not faculty_id:
            return Response({"message": "Faculty ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not students or not isinstance(students, list) or len(students) == 0:
            return Response({"message": "Invalid or missing students data."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            faculty = User.objects.get(id=faculty_id, role="faculty")
        except (User.DoesNotExist, ValueError):
            return Response({"message": "Faculty not found or invalid."}, status=status.HTTP_404_NOT_FOUND)

        results = {"success": [], "errors": []}

        for student in students:
            username = student.get("username")
            sid = student.get("id")
            batch = student.get("batch")
            semester = student.get("semester")

            if not username or not sid or not batch or not semester:
                results["errors"].append({"id": sid, "message": "Incomplete student data."})
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
                results["errors"].append({"id": sid, "message": "User already exists."})
                continue

            try:
                new_user = User.objects.create(
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
                new_user.set_password(str(sid))
                new_user.save()
                results["success"].append({"id": sid, "message": "User registered successfully."})
            except Exception as e:
                results["errors"].append({"id": sid, "message": f"Error registering user: {str(e)}"})

        return Response({"message": "Bulk registration completed.", "results": results}, status=status.HTTP_200_OK)


class FacultyGetStudentsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrFaculty]

    def post(self, request):
        faculty_id = request.data.get("facultyId")
        if not faculty_id:
            return Response({"success": False, "message": "Faculty ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        page = int(request.data.get("page", 1))
        limit = int(request.data.get("limit", 10))
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
    permission_classes = [IsAuthenticated, IsAdminOrFaculty]

    def post(self, request):
        user_id = request.data.get("userId")
        if not user_id:
            return Response({"success": False, "message": "User ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(
            Q(id=user_id if len(user_id) == 36 or '-' in user_id else None) |
            Q(student_id=user_id) |
            Q(username=user_id)
        ).first()

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
    permission_classes = [IsAuthenticated, IsFaculty]

    def delete(self, request, userId):
        if not userId:
            return Response({"success": False, "message": "Missing User ID."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(
            Q(id=userId if len(userId) == 36 or '-' in userId else None) |
            Q(student_id=userId) |
            Q(username=userId)
        ).first()

        if not user:
            return Response({"success": False, "message": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        student_name = user.student_id or user.username
        user.delete()

        return Response({
            "success": True,
            "message": f"User with ID {student_name} and all related data have been successfully removed.",
        }, status=status.HTTP_200_OK)
