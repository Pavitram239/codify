import math
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.contests.models import Contest
from apps.contests.serializers import (
    ContestCreateUpdateSerializer,
    ContestSerializer,
)
from apps.problems.models import Problem
from apps.problems.serializers import StudentListSerializer
from apps.submissions.models import Submission
from apps.users.models import User
from apps.users.permissions import IsAdmin, IsAdminOrFaculty


class ContestListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        role = user.role

        if role == "admin":
            contests = Contest.objects.all().prefetch_related("problems", "assigned_students").select_related("created_by")
        elif role == "faculty":
            contests = Contest.objects.filter(
                Q(created_by=user) | Q(created_by__role="admin")
            ).prefetch_related("problems", "assigned_students").select_related("created_by")
        elif role == "student":
            contests = Contest.objects.filter(assigned_students=user).prefetch_related("problems", "assigned_students").select_related("created_by")
        else:
            return Response({"error": "Unauthorized access"}, status=status.HTTP_403_FORBIDDEN)

        serializer = ContestSerializer(contests, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        if not (request.user.role in ["admin", "faculty"] or request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        serializer = ContestCreateUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        problem_ids = data.get("problems", [])

        contest = Contest.objects.create(
            name=data["name"],
            description=data["description"],
            created_by=request.user,
            start_time=data["start_time"],
            end_time=data["end_time"],
        )

        if problem_ids:
            problems = Problem.objects.filter(
                Q(id__in=[p for p in problem_ids if len(p) == 36 or '-' in p]) |
                Q(title__in=problem_ids)
            )
            contest.problems.set(problems)

        return Response(ContestSerializer(contest).data, status=status.HTTP_201_CREATED)


class ContestDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_contest(self, pk):
        return get_object_or_404(
            Contest.objects.prefetch_related("problems", "assigned_students").select_related("created_by"),
            id=pk
        )

    def get(self, request, pk):
        contest = self.get_contest(pk)
        user = request.user
        role = user.role

        if role == "admin" or user.is_staff or user.is_superuser:
            pass
        elif role == "faculty" and (contest.created_by_id == user.id or getattr(contest.created_by, "role", None) == "admin"):
            pass
        elif role == "student" and contest.assigned_students.filter(id=user.id).exists():
            pass
        else:
            return Response({"error": "You do not have access to this contest."}, status=status.HTTP_403_FORBIDDEN)

        return Response(ContestSerializer(contest).data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        if not (request.user.role in ["admin", "faculty"] or request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        contest = self.get_contest(pk)
        serializer = ContestCreateUpdateSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        if "name" in data:
            contest.name = data["name"]
        if "description" in data:
            contest.description = data["description"]
        if "start_time" in data:
            contest.start_time = data["start_time"]
        if "end_time" in data:
            contest.end_time = data["end_time"]
        contest.save()

        if "problems" in data:
            problem_ids = data["problems"]
            problems = Problem.objects.filter(
                Q(id__in=[p for p in problem_ids if len(p) == 36 or '-' in p]) |
                Q(title__in=problem_ids)
            )
            contest.problems.set(problems)

        return Response(ContestSerializer(contest).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        if not (request.user.role in ["admin", "faculty"] or request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        contest = self.get_contest(pk)

        with transaction.atomic():
            assigned_students = list(contest.assigned_students.all())
            if assigned_students:
                for problem in contest.problems.all():
                    problem.assigned_students.remove(*assigned_students)
            contest.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class AssignContestToStudentsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrFaculty]

    def post(self, request, pk):
        student_ids = request.data.get("studentIds", [])
        if not isinstance(student_ids, list) or not student_ids:
            return Response(
                {"error": "Contest ID and valid student IDs are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        contest = get_object_or_404(Contest.objects.prefetch_related("problems", "assigned_students"), id=pk)

        students = list(User.objects.filter(
            Q(id__in=[s for s in student_ids if len(s) == 36 or '-' in s]) |
            Q(student_id__in=student_ids),
            role="student"
        ))

        with transaction.atomic():
            contest.assigned_students.add(*students)
            for problem in contest.problems.all():
                problem.assigned_students.add(*students)

        return Response({
            "message": "Contest assigned to students successfully.",
            "contest": ContestSerializer(contest).data,
        }, status=status.HTTP_200_OK)


class UnassignContestToStudentsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrFaculty]

    def post(self, request, pk):
        student_ids = request.data.get("studentIds", [])
        if not isinstance(student_ids, list) or not student_ids:
            return Response(
                {"error": "Contest ID and valid student IDs are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        contest = get_object_or_404(Contest.objects.prefetch_related("problems", "assigned_students"), id=pk)

        students = list(User.objects.filter(
            Q(id__in=[s for s in student_ids if len(s) == 36 or '-' in s]) |
            Q(student_id__in=student_ids)
        ))

        with transaction.atomic():
            contest.assigned_students.remove(*students)
            for problem in contest.problems.all():
                problem.assigned_students.remove(*students)

        return Response({
            "message": "Students unassigned from contest successfully.",
            "contest": ContestSerializer(contest).data,
        }, status=status.HTTP_200_OK)


class GetAssignedStudentsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrFaculty]

    def get(self, request, pk):
        contest = get_object_or_404(Contest, id=pk)

        branch = request.query_params.get("branch")
        semester = request.query_params.get("semester")
        batch = request.query_params.get("batch")

        students = contest.assigned_students.filter(role="student")

        if branch and branch != "ALL":
            students = students.filter(branch=branch)
        if semester and semester != "ALL":
            try:
                students = students.filter(semester=int(semester))
            except ValueError:
                pass
        if batch and batch != "ALL":
            students = students.filter(batch=batch)

        serializer = StudentListSerializer(students, many=True)
        return Response({"assignedStudents": serializer.data}, status=status.HTTP_200_OK)


class GetUnassignedStudentsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrFaculty]

    def get(self, request, pk):
        contest = get_object_or_404(Contest, id=pk)

        branch = request.query_params.get("branch")
        semester = request.query_params.get("semester")
        batch = request.query_params.get("batch")

        assigned_ids = contest.assigned_students.values_list("id", flat=True)
        students = User.objects.filter(role="student").exclude(id__in=assigned_ids)

        if branch and branch != "ALL":
            students = students.filter(branch=branch)
        if semester and semester != "ALL":
            try:
                students = students.filter(semester=int(semester))
            except ValueError:
                pass
        if batch and batch != "ALL":
            students = students.filter(batch=batch)

        serializer = StudentListSerializer(students, many=True)
        return Response({"unassignedStudents": serializer.data}, status=status.HTTP_200_OK)


class ContestDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrFaculty]

    def get(self, request, pk):
        contest = get_object_or_404(Contest.objects.prefetch_related("problems"), id=pk)

        page = int(request.query_params.get("page", 1))
        limit = int(request.query_params.get("limit", 10))
        sort_by = request.query_params.get("sortBy", "totalMarks")
        sort_order = request.query_params.get("sortOrder", "desc")
        branch = request.query_params.get("branch", "ALL")
        semester = request.query_params.get("semester", "ALL")
        batch = request.query_params.get("batch", "ALL")

        problems = list(contest.problems.all())
        problem_names = [
            {
                "id": str(p.id),
                "name": p.title,
                "maxMarks": p.total_marks,
            }
            for p in problems
        ]
        problem_ids = [p.id for p in problems]

        submissions = Submission.objects.filter(
            problem_id__in=problem_ids,
            user__role="student"
        ).select_related("user", "problem")

        if branch != "ALL":
            submissions = submissions.filter(user__branch=branch)
        if semester != "ALL":
            try:
                submissions = submissions.filter(user__semester=int(semester))
            except ValueError:
                pass
        if batch != "ALL":
            submissions = submissions.filter(user__batch=batch)

        student_scores = {}
        for sub in submissions:
            user = sub.user
            uid_str = str(user.id)
            if uid_str not in student_scores:
                student_scores[uid_str] = {
                    "studentId": user.student_id or str(user.id),
                    "username": user.username,
                    "branch": user.branch,
                    "semester": user.semester,
                    "batch": user.batch,
                    "totalMarks": 0,
                    "lastSubmissionTime": sub.created_at,
                    "problemMarks": [0] * len(problem_names),
                    "submissionCount": 0,
                }

            entry = student_scores[uid_str]
            try:
                p_idx = problem_ids.index(sub.problem_id)
                entry["problemMarks"][p_idx] = max(entry["problemMarks"][p_idx], sub.total_marks)
            except ValueError:
                pass

            entry["totalMarks"] = sum(entry["problemMarks"])
            entry["submissionCount"] += 1
            if sub.created_at > entry["lastSubmissionTime"]:
                entry["lastSubmissionTime"] = sub.created_at

        rankings = []
        for student in student_scores.values():
            rankings.append({
                **student,
                "lastSubmissionDate": student["lastSubmissionTime"].strftime("%m/%d/%Y"),
                "lastSubmissionTime": student["lastSubmissionTime"].strftime("%I:%M:%S %p"),
            })

        reverse = (sort_order != "asc")
        if sort_by == "totalMarks":
            rankings.sort(key=lambda s: (s["totalMarks"], s["studentId"]), reverse=reverse)
        elif sort_by == "studentId":
            rankings.sort(key=lambda s: s["studentId"], reverse=reverse)
        else:
            rankings.sort(key=lambda s: s["totalMarks"], reverse=reverse)

        for index, s in enumerate(rankings):
            s["rank"] = index + 1

        total_students = len(rankings)
        total_pages = math.ceil(total_students / limit) if limit > 0 else 1
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_rankings = rankings[start_idx:end_idx]

        return Response({
            "contestName": contest.name,
            "problemNames": problem_names,
            "rankings": paginated_rankings,
            "pagination": {
                "currentPage": page,
                "totalPages": total_pages,
                "totalStudents": total_students,
                "limit": limit,
            },
            "sortOptions": {
                "current": sort_by,
                "order": sort_order,
            },
        }, status=status.HTTP_200_OK)
