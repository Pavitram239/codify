from apps.users.resource_access import resource_allowed, visible_resources
from apps.users.access_policy import ModulePermission
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.problems.models import Problem, SampleIO, TestCase
from apps.problems.access import require_problem_access
from apps.problems.serializers import (
    ProblemDetailSerializer,
    ProblemListSerializer,
    ProblemUpdateSerializer,
    ProblemWriteSerializer,
    StudentListSerializer,
)
from apps.problems.services.ai_service import AIService, AIServiceError
from apps.users.models import User


class ProblemListCreateView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), ModulePermission()]
        return [IsAuthenticated(), ModulePermission()]

    def get(self, request):
        user = request.user
        problems = visible_resources(user, Problem.objects.all(), "problems").order_by("-created_at")

        serializer = ProblemListSerializer(problems, many=True)
        return Response(
            {
                "problems": serializer.data,
                "totalProblems": len(serializer.data),
                "success": True,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = ProblemWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        problem = serializer.save(created_by=request.user)

        serializer = ProblemDetailSerializer(problem)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProblemDetailUpdateDeleteView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def get_object(self, id):
        return get_object_or_404(
            Problem.objects.prefetch_related("sample_io", "test_cases", "assigned_students").select_related("created_by"),
            id=id,
        )

    def get(self, request, id):
        problem = self.get_object(id)
        require_problem_access(request.user, problem)

        serializer = ProblemDetailSerializer(problem)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, id):
        problem = self.get_object(id)
        user = request.user
        if not resource_allowed(user, problem, "problems", "edit" if request.method == "PUT" else "delete"):
            return Response(
                {"message": "Unauthorized to edit this problem"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ProblemWriteSerializer(problem, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        problem = serializer.save()

        serializer = ProblemDetailSerializer(problem)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, id):
        problem = self.get_object(id)
        user = request.user
        if not resource_allowed(user, problem, "problems", "edit" if request.method == "PUT" else "delete"):
            return Response(
                {"message": "Unauthorized to delete this problem"},
                status=status.HTTP_403_FORBIDDEN,
            )

        problem.delete()
        return Response({"message": "Problem and all related data removed"}, status=status.HTTP_200_OK)


class ProblemForUpdateView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def get(self, request, id):
        problem = get_object_or_404(Problem, id=id)
        if not resource_allowed(request.user, problem, "problems", "edit"):
            return Response(
                {"message": "Unauthorized to view this problem"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ProblemUpdateSerializer(problem)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AssignStudentsView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def post(self, request, id):
        problem = get_object_or_404(Problem, id=id)
        if not resource_allowed(request.user, problem, "problems", "assign"):
            return Response({"message": "Unauthorized to assign students to this problem"}, status=status.HTTP_403_FORBIDDEN)

        student_ids = request.data.get("studentIds", [])
        if not isinstance(student_ids, list):
            return Response({"message": "studentIds must be an array"}, status=status.HTTP_400_BAD_REQUEST)

        students = User.objects.filter(id__in=student_ids, role="student")
        problem.assigned_students.add(*students)

        return Response({"message": "Students assigned successfully"}, status=status.HTTP_200_OK)


class UnassignStudentsView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def post(self, request, id):
        problem = get_object_or_404(Problem, id=id)
        if not resource_allowed(request.user, problem, "problems", "assign"):
            return Response({"message": "Unauthorized to unassign students from this problem"}, status=status.HTTP_403_FORBIDDEN)

        student_ids = request.data.get("studentIds", [])
        if not isinstance(student_ids, list) or len(student_ids) == 0:
            return Response({"message": "No student IDs provided."}, status=status.HTTP_400_BAD_REQUEST)

        students = User.objects.filter(id__in=student_ids)
        problem.assigned_students.remove(*students)

        return Response({"message": "Students unassigned successfully"}, status=status.HTTP_200_OK)


class AssignedStudentsView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def get(self, request, id):
        problem = get_object_or_404(Problem, id=id)
        if not resource_allowed(request.user, problem, "problems", "assign"):
            return Response({"message": "Unauthorized to view students for this problem"}, status=status.HTTP_403_FORBIDDEN)

        qs = problem.assigned_students.filter(role="student")
        branch = request.query_params.get("branch")
        semester = request.query_params.get("semester")
        batch = request.query_params.get("batch")

        if branch and branch != "ALL":
            qs = qs.filter(branch__iexact=branch)
        if semester and semester != "ALL":
            qs = qs.filter(semester=semester)
        if batch and batch != "ALL":
            qs = qs.filter(batch__iexact=batch)

        serializer = StudentListSerializer(qs, many=True)
        return Response(
            {
                "message": "Problem and assigned students fetched successfully",
                "assignedStudents": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class UnassignedStudentsView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def get(self, request, id):
        problem = get_object_or_404(Problem, id=id)
        if not resource_allowed(request.user, problem, "problems", "assign"):
            return Response({"message": "Unauthorized to view students for this problem"}, status=status.HTTP_403_FORBIDDEN)

        qs = User.objects.filter(role="student").exclude(id__in=problem.assigned_students.all())
        branch = request.query_params.get("branch")
        semester = request.query_params.get("semester")
        batch = request.query_params.get("batch")

        if branch and branch != "ALL":
            qs = qs.filter(branch__iexact=branch)
        if semester and semester != "ALL":
            qs = qs.filter(semester=semester)
        if batch and batch != "ALL":
            qs = qs.filter(batch__iexact=batch)

        serializer = StudentListSerializer(qs, many=True)
        return Response(
            {
                "message": "Problem and unassigned students fetched successfully",
                "unassignedStudents": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class AllStudentsStatsView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def get(self, request):
        students_qs = User.objects.filter(role="student").order_by("student_id")
        if not request.user.can("users.view_all"):
            students_qs = students_qs.filter(faculty=request.user)
        total_students = students_qs.count()

        # Branch-wise aggregation
        branch_counts = (
            students_qs
            .values("branch")
            .annotate(count=Count("id"))
        )
        branch_wise_count = [{"_id": item["branch"], "count": item["count"]} for item in branch_counts]

        # Semester, Branch, Batch aggregation
        sbb_counts = (
            students_qs
            .values("semester", "branch", "batch")
            .annotate(count=Count("id"))
            .order_by("semester", "branch", "batch")
        )

        semester_branch_batch_res = {}
        for item in sbb_counts:
            sem = str(item["semester"])
            br = item["branch"]
            ba = item["batch"]
            cnt = item["count"]

            if sem not in semester_branch_batch_res:
                semester_branch_batch_res[sem] = {}
            if br not in semester_branch_batch_res[sem]:
                semester_branch_batch_res[sem][br] = {}
            semester_branch_batch_res[sem][br][ba] = cnt

        serializer = StudentListSerializer(students_qs, many=True)
        return Response(
            {
                "totalStudents": total_students,
                "branchWiseCount": branch_wise_count,
                "semesterBranchBatchWiseCount": semester_branch_batch_res,
                "students": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class AIProblemGenerateView(APIView):
    """
    Endpoint for Faculty/Admin to generate a new coding problem using AI
    or convert raw competitive programming text (LeetCode/HackerRank) into
    the platform's structured schema.
    """
    permission_classes = [IsAuthenticated, ModulePermission]

    def post(self, request):
        mode = request.data.get("mode", "generate").strip().lower()
        difficulty = request.data.get("difficulty", "easy").strip().lower()

        try:
            if mode == "convert":
                raw_text = request.data.get("rawText", "").strip()
                if not raw_text:
                    return Response(
                        {"success": False, "message": "rawText is required for convert mode."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                problem_data = AIService.convert_problem(raw_text=raw_text, difficulty=difficulty)
            else:
                topic = request.data.get("topic", "").strip()
                if not topic:
                    return Response(
                        {"success": False, "message": "topic is required for problem generation."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                custom_prompt = request.data.get("prompt", "").strip() or None
                problem_data = AIService.generate_problem(
                    topic=topic,
                    difficulty=difficulty,
                    custom_prompt=custom_prompt,
                )

            return Response(
                {
                    "success": True,
                    "message": "Problem generated successfully",
                    "data": problem_data,
                },
                status=status.HTTP_200_OK,
            )

        except AIServiceError as e:
            return Response(
                {"success": False, "message": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {"success": False, "message": f"Unexpected error during generation: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

