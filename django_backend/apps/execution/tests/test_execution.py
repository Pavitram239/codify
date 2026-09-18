from unittest.mock import patch
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.problems.models import Problem, TestCase
from apps.submissions.models import Submission
from apps.users.models import User


def auth_client_for_user(user):
    client = APIClient()
    user.session_id = f"test-session-exec-{user.id}"
    user.save()
    refresh = RefreshToken.for_user(user)
    refresh["id"] = str(user.id)
    refresh["sessionId"] = user.session_id
    token = str(refresh.access_token)
    client.cookies["token"] = token
    return client


@pytest.fixture
def user(db):
    u = User(username="dev_linus", email="linus@example.com", role="student", is_approved=True, first_time_login=False)
    u.set_password("pass123")
    u.save()
    return u


@pytest.fixture
def problem_with_cases(db, user):
    prob = Problem.objects.create(
        title="Multiply",
        description="Multiply two numbers",
        difficulty="easy",
        input_format="a b",
        output_format="a*b",
        total_marks=20,
        created_by=user,
    )
    TestCase.objects.create(
        problem=prob,
        inputs="2 3",
        outputs="6",
        marks=10,
        cpu_time_limit=1.0,
        memory_limit=128,
        is_hidden=False,
        order=0,
    )
    TestCase.objects.create(
        problem=prob,
        inputs="4 5",
        outputs="20",
        marks=10,
        cpu_time_limit=1.0,
        memory_limit=128,
        is_hidden=True,
        order=1,
    )
    return prob


@pytest.mark.django_db
class TestExecutionAPI:

    @patch("apps.execution.views.Judge0Client.execute_test_cases")
    def test_run_code_visible_cases_only_no_submission_saved(
        self, mock_execute, user, problem_with_cases
    ):
        # Mock Judge0 response for 1 visible test case
        mock_execute.return_value = [
            {
                "input": "2 3",
                "expectedOutput": "6",
                "output": "6",
                "error": None,
                "passed": True,
                "time": 0.05,
                "memory": 12000,
                "is_hidden": False,
                "marks": 10,
            }
        ]

        client = auth_client_for_user(user)
        url = reverse("compiler-run-code")
        payload = {
            "code": "a, b = map(int, input().split()); print(a*b)",
            "language": "python",
            "problemId": str(problem_with_cases.id),
            "allTestCases": False,
        }
        res = client.post(url, payload, format="json")

        assert res.status_code == 200
        assert res.data["success"] is True
        assert res.data["allPassed"] is True
        assert len(res.data["testResults"]) == 1
        assert res.data["savedSubmission"] is None

        # Verify only 1 test case was sent to Judge0
        args, kwargs = mock_execute.call_args
        selected_cases = args[2]
        assert len(selected_cases) == 1
        assert selected_cases[0].is_hidden is False

        # Verify no Submission was saved in DB
        assert Submission.objects.filter(user=user, problem=problem_with_cases).count() == 0

    @patch("apps.execution.views.Judge0Client.execute_test_cases")
    def test_submit_code_all_cases_saves_submission_and_masks_hidden(
        self, mock_execute, user, problem_with_cases
    ):
        # Mock Judge0 response for 2 test cases (1 visible, 1 hidden)
        mock_execute.return_value = [
            {
                "input": "2 3",
                "expectedOutput": "6",
                "output": "6",
                "error": None,
                "passed": True,
                "time": 0.04,
                "memory": 11000,
                "is_hidden": False,
                "marks": 10,
            },
            {
                "input": "4 5",
                "expectedOutput": "20",
                "output": "20",
                "error": None,
                "passed": True,
                "time": 0.06,
                "memory": 13000,
                "is_hidden": True,
                "marks": 10,
            },
        ]

        client = auth_client_for_user(user)
        url = reverse("compiler-run-code")
        payload = {
            "code": "a, b = map(int, input().split()); print(a*b)",
            "language": "python",
            "problemId": str(problem_with_cases.id),
            "allTestCases": True,
        }
        res = client.post(url, payload, format="json")

        assert res.status_code == 200
        assert res.data["success"] is True
        assert res.data["allPassed"] is True
        assert res.data["savedSubmission"] is not None
        assert res.data["savedSubmission"]["status"] == "completed"
        assert res.data["savedSubmission"]["totalMarks"] == 20

        # Hidden test case output should be masked in response
        masked_hidden = res.data["testResults"][1]
        assert masked_hidden["input"] == "******"
        assert masked_hidden["output"] == "******"
        assert masked_hidden["expectedOutput"] == "******"

        # Verify Submission was created in DB
        sub = Submission.objects.get(user=user, problem=problem_with_cases)
        assert sub.status == "completed"
        assert sub.total_marks == 20
        assert sub.test_case_results.count() == 2

    def test_unsupported_language_returns_400(self, user, problem_with_cases):
        client = auth_client_for_user(user)
        url = reverse("compiler-run-code")
        payload = {
            "code": "print('hi')",
            "language": "ruby",
            "problemId": str(problem_with_cases.id),
        }
        res = client.post(url, payload, format="json")
        assert res.status_code == 400
        assert "Unsupported programming language" in res.data["message"]

    def test_queue_status_endpoint(self, user):
        client = auth_client_for_user(user)
        url = reverse("compiler-queue-status")
        res = client.get(url)
        assert res.status_code == 200
        assert res.data["success"] is True
        assert "queueStatus" in res.data
