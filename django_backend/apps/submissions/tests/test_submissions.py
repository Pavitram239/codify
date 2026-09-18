import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.problems.models import Problem
from apps.submissions.models import Submission, TestCaseResult
from apps.users.models import User


def auth_client_for_user(user):
    client = APIClient()
    user.session_id = f"test-session-{user.id}"
    user.save()
    refresh = RefreshToken.for_user(user)
    refresh["id"] = str(user.id)
    refresh["sessionId"] = user.session_id
    token = str(refresh.access_token)
    client.cookies["token"] = token
    return client


@pytest.fixture
def admin_user(db):
    u = User(
        username="admin_boss",
        email="admin@charusat.edu.in",
        role="admin",
        is_approved=True,
        first_time_login=False,
    )
    u.set_password("pass123")
    u.save()
    return u


@pytest.fixture
def faculty_user(db):
    u = User(
        username="prof_knuth",
        email="knuth@charusat.edu.in",
        role="faculty",
        is_approved=True,
        first_time_login=False,
    )
    u.set_password("pass123")
    u.save()
    return u


@pytest.fixture
def student_user(db):
    u = User(
        username="student_alice",
        student_id="22it201",
        email="22it201@charusat.edu.in",
        role="student",
        branch="cspit-it",
        semester=5,
        batch="a1",
        is_approved=True,
        first_time_login=False,
    )
    u.set_password("pass123")
    u.save()
    return u


@pytest.fixture
def student_user_2(db):
    u = User(
        username="student_bob",
        student_id="22it202",
        email="22it202@charusat.edu.in",
        role="student",
        branch="cspit-it",
        semester=5,
        batch="a2",
        is_approved=True,
        first_time_login=False,
    )
    u.set_password("pass123")
    u.save()
    return u


@pytest.fixture
def problem(db, faculty_user):
    return Problem.objects.create(
        title="Fibonacci Number",
        description="Compute F(n)",
        difficulty="easy",
        input_format="n",
        output_format="F(n)",
        total_marks=20,
        created_by=faculty_user,
    )


@pytest.fixture
def submission(db, student_user, problem):
    sub = Submission.objects.create(
        user=student_user,
        problem=problem,
        code="def fib(n): return n if n < 2 else fib(n-1)+fib(n-2)",
        language="python",
        status="completed",
        execution_time=12.5,
        memory_usage=14.2,
        number_of_test_cases=2,
        number_of_test_cases_pass=2,
        total_marks=20,
    )
    TestCaseResult.objects.create(
        submission=sub,
        input="5",
        output="5",
        expected_output="5",
        passed=True,
        time=0.01,
        memory=10,
        is_hidden=False,
        marks=10,
        order=0,
    )
    TestCaseResult.objects.create(
        submission=sub,
        input="10",
        output="55",
        expected_output="55",
        passed=True,
        time=0.05,
        memory=14,
        is_hidden=True,
        marks=10,
        order=1,
    )
    return sub


@pytest.mark.django_db
class TestSubmissionsAPI:

    def test_user_submissions_for_problem(self, student_user, problem, submission):
        client = auth_client_for_user(student_user)
        url = reverse("submissions-user-problem")
        res = client.get(url, {"problem_id": str(problem.id)})

        assert res.status_code == 200
        assert res.data["message"] == "Submissions fetched successfully."
        assert len(res.data["data"]) == 1
        assert res.data["data"][0]["_id"] == str(submission.id)
        assert res.data["data"][0]["status"] == "completed"

    def test_user_submissions_for_problem_missing_param(self, student_user):
        client = auth_client_for_user(student_user)
        url = reverse("submissions-user-problem")
        res = client.get(url)
        assert res.status_code == 400

    def test_all_submissions_for_problem_faculty_highest_marks(
        self, faculty_user, student_user, problem, submission
    ):
        # Create a second lower marks submission for same student
        Submission.objects.create(
            user=student_user,
            problem=problem,
            code="pass",
            language="python",
            status="rejected",
            total_marks=5,
        )

        client = auth_client_for_user(faculty_user)
        url = reverse("submissions-for-problem")
        res = client.get(url, {"problem_id": str(problem.id)})

        assert res.status_code == 200
        assert res.data["message"] == "Submissions retrieved successfully"
        # Should only have 1 submission for student_user (the one with 20 marks)
        assert len(res.data["submissions"]) == 1
        assert res.data["submissions"][0]["totalMarks"] == 20
        assert res.data["submissions"][0]["user_id"]["username"] == "student_alice"

    def test_all_submissions_for_problem_student_forbidden(self, student_user, problem):
        client = auth_client_for_user(student_user)
        url = reverse("submissions-for-problem")
        res = client.get(url, {"problem_id": str(problem.id)})
        assert res.status_code == 403

    def test_user_submission_history_pagination(self, student_user, problem, submission):
        client = auth_client_for_user(student_user)
        url = reverse("submissions-user-history")
        res = client.get(url, {"page": 1, "limit": 10})

        assert res.status_code == 200
        assert res.data["message"] == "Submissions retrieved successfully"
        assert res.data["totalSubmissions"] == 1
        assert res.data["totalPages"] == 1
        assert len(res.data["submissions"]) == 1
        assert res.data["submissions"][0]["problem_id"]["title"] == "Fibonacci Number"

    def test_submission_detail_student_masked_hidden_tests(self, student_user, submission):
        client = auth_client_for_user(student_user)
        url = reverse("submissions-detail", kwargs={"id": submission.id})
        res = client.get(url)

        assert res.status_code == 200
        test_cases = res.data["testCaseResults"]
        assert len(test_cases) == 2

        # Visible test case should be unmasked
        visible_tc = next(tc for tc in test_cases if not tc["is_hidden"])
        assert visible_tc["input"] == "5"
        assert visible_tc["output"] == "5"
        assert visible_tc["expectedOutput"] == "5"

        # Hidden test case should be masked
        hidden_tc = next(tc for tc in test_cases if tc["is_hidden"])
        assert hidden_tc["input"] == "****"
        assert hidden_tc["output"] == "****"
        assert hidden_tc["expectedOutput"] == "****"

    def test_submission_detail_other_student_forbidden(self, student_user_2, submission):
        client = auth_client_for_user(student_user_2)
        url = reverse("submissions-detail", kwargs={"id": submission.id})
        res = client.get(url)
        assert res.status_code == 403

    def test_submission_detail_faculty_unmasked(self, faculty_user, submission):
        client = auth_client_for_user(faculty_user)
        url = reverse("submissions-detail", kwargs={"id": submission.id})
        res = client.get(url)

        assert res.status_code == 200
        test_cases = res.data["testCaseResults"]
        hidden_tc = next(tc for tc in test_cases if tc["is_hidden"])
        # Faculty should see actual input/output
        assert hidden_tc["input"] == "10"
        assert hidden_tc["output"] == "55"
        assert hidden_tc["expectedOutput"] == "55"

    def test_submission_detail_faculty_cannot_view_admin(self, faculty_user, admin_user, problem):
        admin_sub = Submission.objects.create(
            user=admin_user,
            problem=problem,
            code="...",
            language="python",
            status="completed",
        )
        client = auth_client_for_user(faculty_user)
        url = reverse("submissions-detail", kwargs={"id": admin_sub.id})
        res = client.get(url)
        assert res.status_code == 403
