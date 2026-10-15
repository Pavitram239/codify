from apps.users.access_policy import ModulePermission
import math
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.submissions.models import Submission
from apps.submissions.serializers import (
    ProblemSubmissionSerializer,
    SubmissionDetailSerializer,
    UserProblemSubmissionSerializer,
    UserSubmissionHistorySerializer,
)
from apps.problems.models import Problem
from rest_framework.exceptions import PermissionDenied


def require_submission_owner(user, problem):
    if not (user.can("submissions.review_all") or (user.can("submissions.review_own") and problem.created_by_id == user.id)):
        raise PermissionDenied("You can only inspect submissions for your own problems.")


class UserSubmissionsForProblemView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def get(self, request):
        problem_id = request.query_params.get("problem_id")
        if not problem_id:
            return Response(
                {"message": "Problem ID is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        submissions = (
            Submission.objects.filter(user=request.user, problem_id=problem_id)
            .select_related("problem")
            .order_by("-created_at")
        )

        if not submissions.exists():
            return Response(
                {
                    "message": "No submissions found for the given user and problem.",
                    "data": [],
                },
                status=status.HTTP_200_OK,
            )

        serializer = UserProblemSubmissionSerializer(submissions, many=True)
        return Response(
            {
                "message": "Submissions fetched successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class AllSubmissionsForProblemView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def get(self, request):
        problem_id = request.query_params.get("problem_id")
        if not problem_id:
            return Response(
                {"message": "Problem ID is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        problem = get_object_or_404(Problem, id=problem_id)
        require_submission_owner(request.user, problem)
        submissions = (
            Submission.objects.filter(problem_id=problem_id, user__role="student")
            .select_related("user")
            .order_by("created_at")
        )

        if not submissions.exists():
            return Response(
                {
                    "message": "No submissions found for the given problem ID.",
                    "submissions": [],
                },
                status=status.HTTP_200_OK,
            )

        # Store highest marks submission for each student
        highest_marks_map = {}
        for sub in submissions:
            user_id = str(sub.user_id)
            if user_id not in highest_marks_map or sub.total_marks > highest_marks_map[user_id].total_marks:
                highest_marks_map[user_id] = sub

        highest_subs = list(highest_marks_map.values())
        serializer = ProblemSubmissionSerializer(highest_subs, many=True)

        return Response(
            {
                "message": "Submissions retrieved successfully",
                "submissions": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class AllSubmissionsForUserView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def get(self, request):
        try:
            page = int(request.query_params.get("page", 1))
            limit = int(request.query_params.get("limit", 10))
        except ValueError:
            page = 1
            limit = 10

        if page < 1:
            page = 1
        if limit < 1:
            limit = 10

        submissions_qs = (
            Submission.objects.filter(user=request.user)
            .select_related("problem")
            .order_by("-created_at")
        )

        total_submissions = submissions_qs.count()
        offset = (page - 1) * limit
        submissions_page = submissions_qs[offset : offset + limit]

        serializer = UserSubmissionHistorySerializer(submissions_page, many=True)
        total_pages = math.ceil(total_submissions / limit) if limit > 0 else 1

        return Response(
            {
                "message": "Submissions retrieved successfully",
                "submissions": serializer.data,
                "totalSubmissions": total_submissions,
                "totalPages": total_pages,
                "currentPage": page,
            },
            status=status.HTTP_200_OK,
        )


class SubmissionDetailView(APIView):
    permission_classes = [IsAuthenticated, ModulePermission]

    def get(self, request, id):
        submission = get_object_or_404(
            Submission.objects.select_related("user", "problem").prefetch_related("test_case_results"),
            id=id,
        )

        own = submission.user_id == request.user.pk and request.user.can("submissions.view_own")
        review = request.user.can("submissions.review_all") or (request.user.can("submissions.review_own") and submission.problem.created_by_id == request.user.pk)
        if not own and not review:
            raise PermissionDenied("You do not have access to this submission.")
        mask_hidden = not review
        serializer = SubmissionDetailSerializer(submission, context={"mask_hidden": mask_hidden})

        return Response(serializer.data, status=status.HTTP_200_OK)
