from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.execution.services import Judge0Client, get_language_id
from apps.problems.models import Problem
from apps.submissions.models import Submission, TestCaseResult


class RunCodeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = request.data.get("code")
        language = request.data.get("language")
        problem_id = request.data.get("problemId")
        all_test_cases = request.data.get("allTestCases", False)

        if not code or not language or not problem_id:
            return Response(
                {"success": False, "message": "Invalid input. Missing required fields."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not get_language_id(language):
            return Response(
                {"success": False, "message": "Unsupported programming language."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        problem = get_object_or_404(Problem, id=problem_id)
        all_cases = list(problem.test_cases.all().order_by("order"))

        if not all_cases:
            return Response(
                {"success": False, "message": "No test cases found for the given problem ID."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if all_test_cases:
            selected_cases = all_cases
        else:
            selected_cases = [tc for tc in all_cases if not tc.is_hidden]

        if not selected_cases:
            return Response(
                {"success": False, "message": "No visible test cases available for execution."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            client = Judge0Client()
            test_results = client.execute_test_cases(code, language, selected_cases)
        except Exception as e:
            return Response(
                {
                    "success": False,
                    "message": "An error occurred while processing the code.",
                    "error": str(e),
                    "queueStatus": {"pending": 0, "processing": 0},
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        overall_time = sum(float(t.get("time", 0.0) or 0.0) for t in test_results) * 1000.0  # ms
        avg_mem_raw = (
            sum(float(t.get("memory", 0.0) or 0.0) for t in test_results) / len(test_results)
            if test_results
            else 0.0
        )
        avg_mem_mb = avg_mem_raw / 1024.0  # MB

        number_of_test_case = len(test_results)
        number_of_test_case_pass = sum(1 for t in test_results if t.get("passed"))
        all_passed = (number_of_test_case == number_of_test_case_pass)
        total_marks = sum(t.get("marks", 0) for t in test_results)
        submission_status = "completed" if all_passed else "rejected"

        saved_submission = None
        if all_test_cases:
            with transaction.atomic():
                submission = Submission.objects.create(
                    user=request.user,
                    problem=problem,
                    code=code,
                    language=language,
                    status=submission_status,
                    execution_time=round(overall_time, 2),
                    memory_usage=round(avg_mem_mb, 2),
                    number_of_test_cases=number_of_test_case,
                    number_of_test_cases_pass=number_of_test_case_pass,
                    total_marks=total_marks,
                )
                for order, t in enumerate(test_results):
                    TestCaseResult.objects.create(
                        submission=submission,
                        input=t.get("input", ""),
                        output=t.get("output", ""),
                        expected_output=t.get("expectedOutput", ""),
                        passed=t.get("passed", False),
                        time=t.get("time", 0.0),
                        memory=t.get("memory", 0.0),
                        is_hidden=t.get("is_hidden", False),
                        marks=t.get("marks", 0),
                        order=order,
                    )

                saved_submission = {
                    "_id": str(submission.id),
                    "status": submission.status,
                    "language": submission.language,
                    "totalMarks": submission.total_marks,
                    "numberOfTestCase": submission.number_of_test_cases,
                    "numberOfTestCasePass": submission.number_of_test_cases_pass,
                    "createdAt": submission.created_at,
                    "testCaseResults": [
                        {
                            "input": "******" if t.get("is_hidden") else t.get("input"),
                            "expectedOutput": "******" if t.get("is_hidden") else t.get("expectedOutput"),
                            "output": "******" if t.get("is_hidden") else t.get("output"),
                            "error": t.get("error"),
                            "passed": t.get("passed"),
                            "time": t.get("time"),
                            "memory": t.get("memory"),
                            "marks": t.get("marks"),
                        }
                        for t in test_results
                    ],
                }

        masked_test_results = [
            {
                "input": "******" if t.get("is_hidden") else t.get("input"),
                "expectedOutput": "******" if t.get("is_hidden") else t.get("expectedOutput"),
                "output": "******" if t.get("is_hidden") else t.get("output"),
                "error": t.get("error"),
                "passed": t.get("passed"),
                "time": t.get("time"),
                "memory": t.get("memory"),
                "marks": t.get("marks"),
            }
            for t in test_results
        ]

        return Response(
            {
                "success": True,
                "testResults": masked_test_results,
                "overallTime": f"{overall_time:.2f}",
                "averageMemory": f"{avg_mem_mb:.2f}",
                "allPassed": all_passed,
                "savedSubmission": saved_submission,
                "queueStatus": {"pending": 0, "processing": 0},
            },
            status=status.HTTP_200_OK,
        )


class QueueStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "success": True,
                "queueStatus": {"pending": 0, "processing": 0},
                "activeUsers": 1,
            },
            status=status.HTTP_200_OK,
        )
