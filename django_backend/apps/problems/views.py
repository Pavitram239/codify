from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.problems.models import Problem, SampleIO, TestCase
from apps.problems.serializers import (
    ProblemDetailSerializer,
    ProblemListSerializer,
    ProblemUpdateSerializer,
    StudentListSerializer,
)
from apps.problems.services.ai_service import AIService, AIServiceError
from apps.users.models import User
from apps.users.permissions import IsAdminOrFaculty


class ProblemListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsAdminOrFaculty()]
        return [IsAuthenticated()]

    def get(self, request):
        user = request.user
        role = user.role

        if role == "admin":
            problems = Problem.objects.all().order_by("-created_at")
        elif role == "faculty":
            problems = Problem.objects.filter(
                Q(created_by=user) | Q(created_by__role="admin")
            ).order_by("-created_at")
        elif role == "student":
            problems = Problem.objects.filter(assigned_students=user).order_by("-created_at")
        else:
            return Response({"message": "Unauthorized access"}, status=status.HTTP_403_FORBIDDEN)

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
        data = request.data
        title = data.get("title")
        description = data.get("description")
        difficulty = str(data.get("difficulty", "easy")).lower()
        input_format = data.get("inputFormat", "")
        output_format = data.get("outputFormat", "")
        constraints = data.get("constraints", "")
        tags = data.get("tags", [])
        sample_io = data.get("sampleIO", [])
        test_cases = data.get("testCases", [])

        if not title or not description:
            return Response(
                {"message": "Title and description are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(test_cases, list):
            return Response(
                {"message": "Invalid testCases format"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate test cases limits
        for i, tc in enumerate(test_cases):
            try:
                cpu = float(tc.get("cpu_time_limit", 1.0))
            except (ValueError, TypeError):
                cpu = 1.0
            try:
                mem = int(tc.get("memory_limit", 128))
            except (ValueError, TypeError):
                mem = 128

            if cpu < 1 or cpu > 15:
                return Response(
                    {"message": f"Test Case {i + 1}: CPU time limit must be between 1 and 15 seconds."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if mem < 1 or mem > 256:
                return Response(
                    {"message": f"Test Case {i + 1}: Memory limit must be between 1 and 256 MB."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        total_marks = sum(int(tc.get("marks", 0)) for tc in test_cases if isinstance(tc, dict) and str(tc.get("marks", "")).isdigit())

        with transaction.atomic():
            problem = Problem.objects.create(
                title=title,
                description=description,
                difficulty=difficulty,
                input_format=input_format,
                output_format=output_format,
                constraints=constraints,
                tags=tags if isinstance(tags, list) else [],
                total_marks=total_marks,
                created_by=request.user,
            )

            for order, sample in enumerate(sample_io):
                SampleIO.objects.create(
                    problem=problem,
                    input=sample.get("input", ""),
                    output=sample.get("output", ""),
                    order=order,
                )

            for order, tc in enumerate(test_cases):
                try:
                    tc_marks = int(tc.get("marks", 0))
                except (ValueError, TypeError):
                    tc_marks = 0
                try:
                    tc_cpu = float(tc.get("cpu_time_limit", 1.0))
                except (ValueError, TypeError):
                    tc_cpu = 1.0
                try:
                    tc_mem = int(tc.get("memory_limit", 128))
                except (ValueError, TypeError):
                    tc_mem = 128

                TestCase.objects.create(
                    problem=problem,
                    inputs=tc.get("inputs", ""),
                    outputs=tc.get("outputs", ""),
                    marks=tc_marks,
                    cpu_time_limit=tc_cpu,
                    memory_limit=tc_mem,
                    is_hidden=bool(tc.get("is_hidden", False)),
                    order=order,
                )

        serializer = ProblemDetailSerializer(problem)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProblemDetailUpdateDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, id):
        return get_object_or_404(
            Problem.objects.prefetch_related("sample_io", "test_cases", "assigned_students").select_related("created_by"),
            id=id,
        )

    def get(self, request, id):
        problem = self.get_object(id)
        user = request.user
        role = user.role

        if role == "admin":
            pass
        elif role == "faculty":
            if problem.created_by_id != user.id:
                return Response(
                    {"message": "You are not allowed to access this problem"},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif role == "student":
            if not problem.assigned_students.filter(id=user.id).exists():
                return Response(
                    {"message": "You are not allowed to access this problem"},
                    status=status.HTTP_403_FORBIDDEN,
                )
        else:
            return Response(
                {"message": "You are not allowed to access this problem"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ProblemDetailSerializer(problem)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, id):
        problem = self.get_object(id)
        user = request.user
        if user.role != "admin" and problem.created_by_id != user.id:
            return Response(
                {"message": "Unauthorized to edit this problem"},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data
        if "title" in data:
            problem.title = data["title"]
        if "description" in data:
            problem.description = data["description"]
        if "difficulty" in data:
            problem.difficulty = data["difficulty"]
        if "inputFormat" in data:
            problem.input_format = data["inputFormat"]
        if "outputFormat" in data:
            problem.output_format = data["outputFormat"]
        if "constraints" in data:
            problem.constraints = data["constraints"]
        if "tags" in data and isinstance(data["tags"], list):
            problem.tags = data["tags"]

        with transaction.atomic():
            if "sampleIO" in data and isinstance(data["sampleIO"], list):
                problem.sample_io.all().delete()
                for order, sample in enumerate(data["sampleIO"]):
                    SampleIO.objects.create(
                        problem=problem,
                        input=sample.get("input", ""),
                        output=sample.get("output", ""),
                        order=order,
                    )

            if "testCases" in data:
                test_cases = data["testCases"]
                if not isinstance(test_cases, list):
                    return Response({"message": "Invalid testCases format"}, status=status.HTTP_400_BAD_REQUEST)

                for i, tc in enumerate(test_cases):
                    cpu = tc.get("cpu_time_limit", 1.0)
                    mem = tc.get("memory_limit", 128)
                    if cpu < 1 or cpu > 15:
                        return Response(
                            {"message": f"Test Case {i + 1}: CPU time limit must be between 1 and 15 seconds."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    if mem < 1 or mem > 256:
                        return Response(
                            {"message": f"Test Case {i + 1}: Memory limit must be between 1 and 256 MB."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                problem.test_cases.all().delete()
                for order, tc in enumerate(test_cases):
                    TestCase.objects.create(
                        problem=problem,
                        inputs=tc.get("inputs", ""),
                        outputs=tc.get("outputs", ""),
                        marks=tc.get("marks", 0),
                        cpu_time_limit=tc.get("cpu_time_limit", 1.0),
                        memory_limit=tc.get("memory_limit", 128),
                        is_hidden=tc.get("is_hidden", False),
                        order=order,
                    )
                problem.total_marks = sum(tc.get("marks", 0) for tc in test_cases)

            problem.save()

        serializer = ProblemDetailSerializer(problem)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, id):
        problem = self.get_object(id)
        user = request.user
        if user.role != "admin" and problem.created_by_id != user.id:
            return Response(
                {"message": "Unauthorized to delete this problem"},
                status=status.HTTP_403_FORBIDDEN,
            )

        problem.delete()
        return Response({"message": "Problem and all related data removed"}, status=status.HTTP_200_OK)


class ProblemForUpdateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrFaculty]

    def get(self, request, id):
        problem = get_object_or_404(Problem, id=id)
        if request.user.role != "admin" and problem.created_by_id != request.user.id:
            return Response(
                {"message": "Unauthorized to view this problem"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ProblemUpdateSerializer(problem)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AssignStudentsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrFaculty]

    def post(self, request, id):
        problem = get_object_or_404(Problem, id=id)
        if (
            request.user.role != "admin"
            and problem.created_by_id != request.user.id
            and problem.created_by.role != "admin"
        ):
            return Response({"message": "Unauthorized to assign students to this problem"}, status=status.HTTP_403_FORBIDDEN)

        student_ids = request.data.get("studentIds", [])
        if not isinstance(student_ids, list):
            return Response({"message": "studentIds must be an array"}, status=status.HTTP_400_BAD_REQUEST)

        students = User.objects.filter(id__in=student_ids, role="student")
        problem.assigned_students.add(*students)

        return Response({"message": "Students assigned successfully"}, status=status.HTTP_200_OK)


class UnassignStudentsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrFaculty]

    def post(self, request, id):
        problem = get_object_or_404(Problem, id=id)
        if (
            request.user.role != "admin"
            and problem.created_by_id != request.user.id
            and problem.created_by.role != "admin"
        ):
            return Response({"message": "Unauthorized to unassign students from this problem"}, status=status.HTTP_403_FORBIDDEN)

        student_ids = request.data.get("studentIds", [])
        if not isinstance(student_ids, list) or len(student_ids) == 0:
            return Response({"message": "No student IDs provided."}, status=status.HTTP_400_BAD_REQUEST)

        students = User.objects.filter(id__in=student_ids)
        problem.assigned_students.remove(*students)

        return Response({"message": "Students unassigned successfully"}, status=status.HTTP_200_OK)


class AssignedStudentsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrFaculty]

    def get(self, request, id):
        problem = get_object_or_404(Problem, id=id)
        if (
            request.user.role != "admin"
            and problem.created_by_id != request.user.id
            and problem.created_by.role != "admin"
        ):
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
    permission_classes = [IsAuthenticated, IsAdminOrFaculty]

    def get(self, request, id):
        problem = get_object_or_404(Problem, id=id)
        if (
            request.user.role != "admin"
            and problem.created_by_id != request.user.id
            and problem.created_by.role != "admin"
        ):
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
    permission_classes = [IsAuthenticated, IsAdminOrFaculty]

    def get(self, request):
        students_qs = User.objects.filter(role="student").order_by("student_id")
        total_students = students_qs.count()

        # Branch-wise aggregation
        branch_counts = (
            User.objects.filter(role="student")
            .values("branch")
            .annotate(count=Count("id"))
        )
        branch_wise_count = [{"_id": item["branch"], "count": item["count"]} for item in branch_counts]

        # Semester, Branch, Batch aggregation
        sbb_counts = (
            User.objects.filter(role="student")
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
    permission_classes = [IsAuthenticated, IsAdminOrFaculty]

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

