from apps.users.resource_access import require_resource, visible_resources
from apps.users.access_policy import ModulePermission
import math
from uuid import UUID
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from zoneinfo import ZoneInfo
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.contests.models import Contest
from apps.contests.serializers import (
    ContestCreateUpdateSerializer,
    ContestSerializer,
)
from apps.problems.models import Problem
from apps.problems.access import require_problem_access
from apps.problems.serializers import StudentListSerializer
from apps.submissions.models import Submission
from apps.users.models import User
from apps.users.pagination import pagination_params


def require_contest_access(user, contest, write=False, action=None):
    require_resource(user, contest, "contests", action or ("edit" if write else "assign"))


def resolve_contest_problems(user, identifiers):
    problems = []
    for identifier in identifiers:
        try:
            problem = Problem.objects.filter(id=UUID(identifier)).first()
        except (ValueError, TypeError, AttributeError):
            problem = Problem.objects.filter(title=identifier).first()
        if problem is None:
            raise ValidationError({"problems": "One or more selected problems do not exist."})
        require_problem_access(user, problem)
        if problem not in problems:
            problems.append(problem)
    return problems


def resolve_students(identifiers):
    students = []
    for identifier in identifiers:
        if not isinstance(identifier, str) or not identifier:
            raise ValidationError({"studentIds": "Each student ID must be a valid UUID or institutional ID."})
        try:
            student = User.objects.filter(id=UUID(identifier), role="student").first()
        except ValueError:
            student = User.objects.filter(student_id=identifier, role="student").first()
        if student is None:
            raise ValidationError({"studentIds": "One or more selected students do not exist."})
        if student not in students:
            students.append(student)
    return students


def remove_unshared_assignments(contest, students):
    for problem in contest.problems.all():
        remaining_ids = set(Contest.objects.filter(problems=problem).exclude(pk=contest.pk)
                            .values_list("assigned_students", flat=True))
        problem.assigned_students.remove(*(s for s in students if s.pk not in remaining_ids))


class ContestListCreateView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def get(self, request):
        user = request.user
        contests = visible_resources(user, Contest.objects.all(), "contests").prefetch_related("problems", "assigned_students").select_related("created_by")

        serializer = ContestSerializer(contests, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):

        serializer = ContestCreateUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        problem_ids = data.get("problems", [])
        problems = resolve_contest_problems(request.user, problem_ids)

        contest = Contest.objects.create(
            name=data["name"],
            description=data["description"],
            created_by=request.user,
            start_time=data["start_time"],
            end_time=data["end_time"],
        )

        if problem_ids:
            contest.problems.set(problems)

        return Response(ContestSerializer(contest).data, status=status.HTTP_201_CREATED)


class ContestDetailView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def get_contest(self, pk):
        return get_object_or_404(
            Contest.objects.prefetch_related("problems", "assigned_students").select_related("created_by"),
            id=pk
        )

    def get(self, request, pk):
        contest = self.get_contest(pk)
        user = request.user
        require_resource(user, contest, "contests", "view")

        return Response(ContestSerializer(contest).data, status=status.HTTP_200_OK)

    def put(self, request, pk):

        contest = self.get_contest(pk)
        require_contest_access(request.user, contest, write=True)
        serializer = ContestCreateUpdateSerializer(contest, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        problems = resolve_contest_problems(request.user, data["problems"]) if "problems" in data else None
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
            contest.problems.set(problems)

        return Response(ContestSerializer(contest).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):

        contest = self.get_contest(pk)
        require_contest_access(request.user, contest, action="delete")
        with transaction.atomic():
            assigned_students = list(contest.assigned_students.all())
            if assigned_students:
                remove_unshared_assignments(contest, assigned_students)
            contest.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class AssignContestToStudentsView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def post(self, request, pk):
        student_ids = request.data.get("studentIds", [])
        if not isinstance(student_ids, list) or not student_ids:
            return Response(
                {"error": "Contest ID and valid student IDs are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        contest = get_object_or_404(Contest.objects.prefetch_related("problems", "assigned_students"), id=pk)
        require_contest_access(request.user, contest, action="assign")

        students = resolve_students(student_ids)

        with transaction.atomic():
            contest.assigned_students.add(*students)
            for problem in contest.problems.all():
                problem.assigned_students.add(*students)

        return Response({
            "message": "Contest assigned to students successfully.",
            "contest": ContestSerializer(contest).data,
        }, status=status.HTTP_200_OK)


class UnassignContestToStudentsView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def post(self, request, pk):
        student_ids = request.data.get("studentIds", [])
        if not isinstance(student_ids, list) or not student_ids:
            return Response(
                {"error": "Contest ID and valid student IDs are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        contest = get_object_or_404(Contest.objects.prefetch_related("problems", "assigned_students"), id=pk)
        require_contest_access(request.user, contest, action="assign")

        students = resolve_students(student_ids)

        with transaction.atomic():
            contest.assigned_students.remove(*students)
            remove_unshared_assignments(contest, students)

        return Response({
            "message": "Students unassigned from contest successfully.",
            "contest": ContestSerializer(contest).data,
        }, status=status.HTTP_200_OK)


class GetAssignedStudentsView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def get(self, request, pk):
        contest = get_object_or_404(Contest, id=pk)
        require_contest_access(request.user, contest)

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
    permission_classes = [IsAuthenticated, ModulePermission]

    def get(self, request, pk):
        contest = get_object_or_404(Contest, id=pk)
        require_contest_access(request.user, contest)

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
    permission_classes = [IsAuthenticated, ModulePermission]

    def get(self, request, pk):
        contest = get_object_or_404(Contest.objects.prefetch_related("problems"), id=pk)
        if not (request.user.can("submissions.review_all") or (request.user.can("submissions.review_own") and contest.created_by_id == request.user.pk)):
            raise PermissionDenied("You can only review your own contests.")

        page, limit = pagination_params(request.query_params)
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
            user__role="student",
            user__in=contest.assigned_students.all(),
            created_at__gte=contest.start_time,
            created_at__lte=contest.end_time,
            status__in=["completed", "rejected"],
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
                "lastSubmissionDate": timezone.localtime(student["lastSubmissionTime"], ZoneInfo("Asia/Kolkata")).strftime("%m/%d/%Y"),
                "lastSubmissionTime": timezone.localtime(student["lastSubmissionTime"], ZoneInfo("Asia/Kolkata")).strftime("%I:%M:%S %p"),
                "submissionTimezone": "Asia/Kolkata",
            })

        rankings.sort(key=lambda s: (-s["totalMarks"], s["studentId"]))
        for index, student in enumerate(rankings):
            student["rank"] = index + 1

        reverse = (sort_order != "asc")
        if sort_by == "totalMarks":
            rankings.sort(key=lambda s: (s["totalMarks"], s["studentId"]), reverse=reverse)
        elif sort_by == "studentId":
            rankings.sort(key=lambda s: s["studentId"], reverse=reverse)
        else:
            rankings.sort(key=lambda s: s["totalMarks"], reverse=reverse)

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
