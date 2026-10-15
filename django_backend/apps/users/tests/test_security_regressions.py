from datetime import timedelta
from unittest.mock import patch

import pytest
from celery.exceptions import Retry
from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.contests.models import Contest
from apps.execution.tasks import cleanup_expired_sessions, process_submission_async
from apps.problems.models import Problem, TestCase
from apps.submissions.models import Submission
from apps.users.models import User

pytestmark = pytest.mark.django_db


@pytest.fixture
def users():
    result = {}
    for role, name in [("admin", "admin"), ("faculty", "teacher"), ("faculty", "other_teacher"),
                       ("student", "student"), ("student", "other_student")]:
        result[name] = User.objects.create_user(
            username=name, password="ActualPassword123!", role=role,
            student_id="22it123" if name == "student" else None,
            is_approved=True, first_time_login=False,
        )
    result["student"].faculty = result["teacher"]
    result["student"].save()
    result["other_student"].faculty = result["other_teacher"]
    result["other_student"].save()
    return result


@pytest.fixture
def problem(users):
    problem = Problem.objects.create(title="Private Problem", description="Private",
                                     created_by=users["teacher"], total_marks=10)
    TestCase.objects.create(problem=problem, inputs="secret-input", outputs="42",
                            marks=10, is_hidden=True)
    problem.assigned_students.add(users["student"])
    return problem


@pytest.fixture
def contest(users, problem):
    now = timezone.now()
    contest = Contest.objects.create(name="Private Contest", description="Private",
                                     created_by=users["teacher"],
                                     start_time=now - timedelta(hours=1),
                                     end_time=now + timedelta(hours=1))
    contest.problems.add(problem)
    contest.assigned_students.add(users["student"])
    return contest


def cookie_client(user, enforce_csrf=False):
    client = APIClient(enforce_csrf_checks=enforce_csrf)
    user.session_id = "regression-session"
    user.last_login_time = timezone.now()
    user.save()
    token = RefreshToken.for_user(user)
    token["sessionId"] = user.session_id
    client.cookies["token"] = str(token.access_token)
    return client


@pytest.mark.parametrize("old_password", ["22it123", "actualpassword123!", "ACTUALPASSWORD123!"])
def test_password_change_requires_actual_password(users, old_password):
    response = APIClient().post(reverse("auth-change-password"), {
        "id": "22it123", "oldPassword": old_password, "newPassword": "ReplacementPassword456!",
    }, format="json")
    assert response.status_code == 400
    users["student"].refresh_from_db()
    assert users["student"].check_password("ActualPassword123!")


def test_first_login_password_change_and_revocation(users):
    student = users["student"]
    student.first_time_login = True
    student.save()
    client = cookie_client(student)
    response = APIClient().post(reverse("auth-change-password"), {
        "id": "22it123", "oldPassword": "ActualPassword123!", "newPassword": "ReplacementPassword456!",
    }, format="json")
    assert response.status_code == 200
    student.refresh_from_db()
    assert not student.first_time_login
    assert student.session_id is None
    assert student.check_password("ReplacementPassword456!")
    assert client.get(reverse("auth-current-user")).status_code == 401


def test_weak_new_password_is_rejected(users):
    response = APIClient().post(reverse("auth-change-password"), {
        "id": "22it123", "oldPassword": "ActualPassword123!", "newPassword": "123",
    }, format="json")
    assert response.status_code == 400
    users["student"].refresh_from_db()
    assert users["student"].check_password("ActualPassword123!")


def test_cookie_writes_require_csrf_and_logout_is_post(users):
    client = cookie_client(users["student"], enforce_csrf=True)
    assert client.get(reverse("auth-logout")).status_code == 405
    assert client.post(reverse("auth-logout")).status_code == 403
    token_response = client.get(reverse("auth-csrf"))
    assert "csrftoken" in token_response.cookies
    assert token_response["Cache-Control"] == "no-store"
    assert client.post(reverse("auth-logout"), HTTP_X_CSRFTOKEN=token_response.data["csrfToken"]).status_code == 200


def test_untrusted_origin_is_rejected_with_valid_csrf(users):
    client = cookie_client(users["student"], enforce_csrf=True)
    token = client.get(reverse("auth-csrf")).data["csrfToken"]
    assert client.post(reverse("auth-logout"), HTTP_X_CSRFTOKEN=token,
                       HTTP_ORIGIN="https://attacker.example").status_code == 403
    users["student"].refresh_from_db()
    assert users["student"].session_id is not None


def test_bearer_writes_do_not_require_csrf(users):
    client = cookie_client(users["student"], enforce_csrf=True)
    token = client.cookies["token"].value
    client.cookies.clear()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    assert client.post(reverse("auth-logout")).status_code == 200


def test_browser_login_csrf_flow(users):
    client = APIClient(enforce_csrf_checks=True)
    payload = {"id": "22it123", "password": "ActualPassword123!"}
    assert client.post(reverse("auth-login"), payload, format="json").status_code == 403
    token = client.get(reverse("auth-csrf")).data["csrfToken"]
    response = client.post(reverse("auth-login"), payload, format="json",
                           HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN=settings.CORS_ALLOWED_ORIGINS[0])
    assert response.status_code == 200
    assert "token" in response.cookies
    assert client.post(reverse("auth-logout"), HTTP_X_CSRFTOKEN=token,
                       HTTP_ORIGIN=settings.CORS_ALLOWED_ORIGINS[0]).status_code == 200


def test_expired_session_can_login_without_admin(users):
    student = users["student"]
    student.session_id = "expired-session"
    student.last_login_time = timezone.now() - settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"] - timedelta(seconds=1)
    student.save()
    client = APIClient()
    client.cookies["token"] = "expired-or-invalid-token"
    response = client.post(reverse("auth-login"), {"id": "22it123", "password": "ActualPassword123!"}, format="json")
    assert response.status_code == 200
    student.refresh_from_db()
    assert student.session_id != "expired-session"
    assert client.get(reverse("auth-current-user")).status_code == 200


def test_student_token_without_session_is_rejected(users):
    token = RefreshToken.for_user(users["student"])
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    assert client.get(reverse("auth-current-user")).status_code == 401


@pytest.mark.parametrize("target", ["admin", "other_teacher", "other_student"])
def test_faculty_cannot_delete_outside_own_students(users, target):
    client = APIClient()
    client.force_authenticate(users["teacher"])
    response = client.delete(f'/api/v1/faculty/remove-user/{users[target].id}')
    assert response.status_code == 404
    assert User.objects.filter(id=users[target].id).exists()


@pytest.mark.parametrize("endpoint", ["accept-all-requests", "decline-all-requests", "bulk-register", "get-students-by-faculty"])
def test_faculty_cannot_spoof_faculty_id(users, endpoint):
    client = APIClient()
    client.force_authenticate(users["teacher"])
    response = client.post(f"/api/v1/faculty/{endpoint}", {
        "facultyId": str(users["other_teacher"].id),
        "students": [{"username": "new_student", "id": "22it999", "batch": "a1", "semester": 2}],
    }, format="json")
    assert response.status_code == 403


@pytest.mark.parametrize("action", ["update", "delete", "assign", "unassign", "dashboard", "assigned", "unassigned"])
def test_other_faculty_cannot_manage_or_inspect_contest(users, contest, action):
    client = APIClient()
    client.force_authenticate(users["other_teacher"])
    url = f"/api/v1/contests/{contest.id}"
    if action == "update":
        response = client.put(url, {"name": "stolen"}, format="json")
    elif action == "delete":
        response = client.delete(url)
    elif action in ("assign", "unassign"):
        endpoint = "assignContestToStudents" if action == "assign" else "unassignContestToStudents"
        response = client.post(f"{url}/{endpoint}", {"studentIds": [str(users["other_student"].id)]}, format="json")
    else:
        endpoint = {"dashboard": "dashboard", "assigned": "getAssignedStudents", "unassigned": "unassignedStudents"}[action]
        response = client.get(f"{url}/{endpoint}")
    assert response.status_code == 403
    contest.refresh_from_db()
    assert contest.name == "Private Contest"
    assert not contest.assigned_students.filter(id=users["other_student"].id).exists()


@pytest.mark.parametrize("action", ["create", "update"])
def test_contest_cannot_include_another_facultys_private_problem(users, problem, contest, action):
    client = APIClient()
    client.force_authenticate(users["other_teacher"])
    if action == "create":
        response = client.post("/api/v1/contests/create", {
            "name": "Stolen Problem Contest", "description": "Private problem",
            "start_time": contest.start_time.isoformat(), "end_time": contest.end_time.isoformat(),
            "problems": [str(problem.id)],
        }, format="json")
    else:
        contest.created_by = users["other_teacher"]
        contest.problems.clear()
        contest.save()
        response = client.put(f"/api/v1/contests/{contest.id}", {
            "name": "Stolen Problem Contest", "problems": [str(problem.id)],
        }, format="json")
    assert response.status_code == 403
    assert not Contest.objects.filter(name="Stolen Problem Contest").exists()
    if action == "update":
        assert not contest.problems.exists()


@pytest.mark.parametrize("role", ["other_student", "other_teacher"])
def test_unassigned_execution_is_denied_before_judge(users, problem, role):
    client = APIClient()
    client.force_authenticate(users[role])
    with patch("apps.execution.views.Judge0Client.execute_test_cases") as execute:
        response = client.post(reverse("compiler-run-code"), {
            "code": "print(42)", "language": "python", "problemId": str(problem.id), "allTestCases": True,
        }, format="json")
    assert response.status_code == 403
    execute.assert_not_called()
    assert not Submission.objects.exists()


@pytest.mark.parametrize("phase", ["upcoming", "completed"])
@pytest.mark.parametrize("endpoint", ["execute", "detail", "draft"])
def test_contest_windows_protect_execution_and_reads(users, problem, contest, phase, endpoint):
    now = timezone.now()
    if phase == "upcoming":
        contest.start_time, contest.end_time = now + timedelta(hours=1), now + timedelta(hours=2)
    else:
        contest.start_time, contest.end_time = now - timedelta(hours=2), now - timedelta(hours=1)
    contest.save()
    client = APIClient()
    client.force_authenticate(users["student"])
    if endpoint == "execute":
        with patch("apps.execution.views.Judge0Client.execute_test_cases") as execute:
            response = client.post(reverse("compiler-run-code"), {
                "code": "print(42)", "language": "python", "problemId": str(problem.id), "allTestCases": True,
            }, format="json")
            execute.assert_not_called()
    elif endpoint == "detail":
        response = client.get(f"/api/v1/problems/{problem.id}")
    else:
        response = client.get(reverse("code-draft-get"), {"problemId": str(problem.id)})
    assert response.status_code == 403


def test_hidden_stderr_is_masked_in_both_responses(users, problem, contest):
    client = APIClient()
    client.force_authenticate(users["student"])
    with patch("apps.execution.views.Judge0Client.execute_test_cases", return_value=[{
        "input": "secret-input", "expectedOutput": "42", "output": "secret-input",
        "error": "secret-input", "passed": False, "is_hidden": True, "marks": 0,
    }]):
        response = client.post(reverse("compiler-run-code"), {
            "code": "import sys; sys.stderr.write(input())", "language": "python",
            "problemId": str(problem.id), "allTestCases": True,
        }, format="json")
    assert response.status_code == 200
    assert b"secret-input" not in response.content
    assert response.data["testResults"][0]["error"] == "Hidden test case failed."
    assert response.data["savedSubmission"]["testCaseResults"][0]["error"] == "Hidden test case failed."


def test_judge_exception_does_not_disclose_test_data(users, problem):
    client = APIClient()
    client.force_authenticate(users["student"])
    with patch("apps.execution.views.Judge0Client.execute_test_cases", side_effect=RuntimeError("secret-input")):
        response = client.post(reverse("compiler-run-code"), {
            "code": "print(42)", "language": "python", "problemId": str(problem.id), "allTestCases": True,
        }, format="json")
    assert response.status_code == 500
    assert b"secret-input" not in response.content


def test_celery_uses_real_judge_result_contract(users, problem):
    submission = Submission.objects.create(user=users["student"], problem=problem,
                                           code="print(42)", language="python")
    with patch("apps.execution.services.Judge0Client.submit_one", return_value={"token": "judge-token"}), \
         patch("apps.execution.services.Judge0Client.fetch_result", return_value={
             "stdout": "NDI=", "time": "0.1", "memory": 2048, "error": None, "status": {"id": 3},
         }):
        result = process_submission_async(str(submission.id))
    assert result["status"] == "completed"
    submission.refresh_from_db()
    assert submission.total_marks == 10
    assert submission.execution_time == 100
    assert submission.memory_usage == 2
    assert submission.test_case_results.get().is_hidden


def test_celery_retry_does_not_prematurely_reject(users, problem):
    submission = Submission.objects.create(user=users["student"], problem=problem,
                                           code="print(42)", language="python")
    with patch("apps.execution.services.Judge0Client.execute_test_cases", side_effect=RuntimeError("offline")), \
         patch.object(process_submission_async, "retry", side_effect=Retry()):
        with pytest.raises(Retry):
            process_submission_async(str(submission.id))
    submission.refresh_from_db()
    assert submission.status == "pending"


def test_contest_ranking_ignores_out_of_window_and_unassigned_submissions(users, problem, contest):
    for user, at, marks, status in [
        (users["student"], contest.start_time - timedelta(seconds=1), 100, "completed"),
        (users["student"], contest.end_time + timedelta(seconds=1), 100, "completed"),
        (users["other_student"], timezone.now(), 100, "completed"),
        (users["student"], timezone.now(), 100, "pending"),
        (users["student"], timezone.now(), 5, "rejected"),
        (users["student"], timezone.now(), 10, "completed"),
    ]:
        Submission.objects.create(user=user, problem=problem, code="print(42)", language="python",
                                  created_at=at, total_marks=marks, status=status)
    client = APIClient()
    client.force_authenticate(users["teacher"])
    response = client.get(f"/api/v1/contests/{contest.id}/dashboard")
    assert response.status_code == 200
    assert len(response.data["rankings"]) == 1
    assert response.data["rankings"][0]["totalMarks"] == 10
    assert response.data["rankings"][0]["submissionCount"] == 2


def test_session_cleanup_matches_token_lifetime(users):
    expired = users["student"]
    expired.session_id = "expired"
    expired.last_login_time = timezone.now() - settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"] - timedelta(seconds=1)
    expired.save()
    active = users["other_student"]
    active.session_id = "active"
    active.last_login_time = timezone.now()
    active.save()
    assert cleanup_expired_sessions()["cleaned_sessions"] == 1
    expired.refresh_from_db()
    active.refresh_from_db()
    assert expired.session_id is None
    assert active.session_id == "active"
