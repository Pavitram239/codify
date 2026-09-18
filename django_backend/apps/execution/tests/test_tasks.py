from unittest.mock import patch
from datetime import timedelta
import pytest
from django.utils import timezone
from apps.users.models import User
from apps.problems.models import Problem, TestCase
from apps.submissions.models import Submission
from apps.execution.tasks import cleanup_expired_sessions, process_submission_async


@pytest.fixture
def student_user(db):
    user = User.objects.create(
        username="celery_student",
        student_id="22it777",
        role="student",
        is_approved=True,
    )
    user.set_password("StudentPass123!")
    user.save()
    return user


@pytest.fixture
def sample_problem(db, student_user):
    prob = Problem.objects.create(
        title="Celery Problem",
        description="Celery test problem",
        difficulty="easy",
        total_marks=100,
        created_by=student_user,
    )
    TestCase.objects.create(
        problem=prob,
        inputs="1 2",
        outputs="3",
        marks=100,
        order=1,
    )
    return prob


@pytest.mark.django_db
def test_process_submission_async(student_user, sample_problem):
    sub = Submission.objects.create(
        problem=sample_problem,
        user=student_user,
        code="a, b = map(int, input().split()); print(a + b)",
        language="python",
        status="pending",
    )

    mock_results = [
        {
            "order": 1,
            "input": "1 2",
            "output": "3",
            "expectedOutput": "3",
            "passed": True,
            "marks": 100,
            "time": 0.05,
            "memory": 10.0,
            "isHidden": False,
        }
    ]

    with patch("apps.execution.services.Judge0Client.execute_test_cases", return_value=(mock_results, 100, 1, 1, 0.05, 10.0)):
        result = process_submission_async(str(sub.id))

    assert result["status"] == "completed"
    assert result["total_marks"] == 100
    assert result["passed"] == 1

    sub.refresh_from_db()
    assert sub.status == "completed"
    assert sub.total_marks == 100
    assert sub.number_of_test_cases_pass == 1
    assert sub.test_case_results.count() == 1


@pytest.mark.django_db
def test_cleanup_expired_sessions(student_user):
    student_user.session_id = "old-session-id"
    student_user.last_login_time = timezone.now() - timedelta(days=10)
    student_user.save()

    active_user = User.objects.create(
        username="active_student",
        session_id="active-session-id",
        last_login_time=timezone.now() - timedelta(hours=2),
    )

    res = cleanup_expired_sessions()
    assert res["cleaned_sessions"] == 1

    student_user.refresh_from_db()
    assert student_user.session_id is None

    active_user.refresh_from_db()
    assert active_user.session_id == "active-session-id"
