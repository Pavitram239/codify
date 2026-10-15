"""Read-only product audit: all mutations occur in pytest's isolated database."""
import base64
import io
import json
from datetime import timedelta
from pathlib import Path
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import User
from apps.problems.models import Problem, TestCase as ProblemTestCase, SampleIO
from apps.contests.models import Contest
from apps.submissions.models import Submission, TestCaseResult as Result
from apps.execution.services import Judge0Client

pytestmark = pytest.mark.django_db
RESULTS = []


@pytest.fixture(scope="session", autouse=True)
def save_audit_results():
    yield
    Path("/tmp/codify-boundary-results.json").write_text(json.dumps(RESULTS, indent=2, default=str))


@pytest.fixture(autouse=True)
def audit_settings(settings):
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
    settings.CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


@pytest.fixture
def setup_data():
    users = {}
    for key, role in [("admin", "admin"), ("faculty", "faculty"), ("other_faculty", "faculty"), ("student", "student")]:
        users[key] = User.objects.create_user(username="qa_" + key, password="AuditPassword42!", role=role,
            email=key + "@example.test", is_approved=True, first_time_login=False, branch="cspit-it", semester=6, batch="a1")
    users["student"].student_id = "qa22it001"
    users["student"].faculty = users["faculty"]
    users["student"].save()
    problem = Problem.objects.create(title="QA pair sum", description="Add two integers.", created_by=users["faculty"], total_marks=20)
    problem.assigned_students.add(users["student"])
    ProblemTestCase.objects.create(problem=problem, inputs="2 3", outputs="5", marks=10, is_hidden=False)
    ProblemTestCase.objects.create(problem=problem, inputs="private-input", outputs="private-output", marks=10, is_hidden=True)
    SampleIO.objects.create(problem=problem, input="original sample", output="original output")
    now = timezone.now()
    contest = Contest.objects.create(name="QA assessment", description="QA", created_by=users["faculty"], start_time=now-timedelta(hours=1), end_time=now+timedelta(hours=1))
    contest.problems.add(problem)
    contest.assigned_students.add(users["student"])
    return users, problem, contest


def client_for(user):
    client = APIClient()
    client.raise_request_exception = False
    client.force_authenticate(user=user)
    return client


def record(case_id, area, scenario, expected, actual, passed, role="Faculty", steps="", inputs="", source="", bug=""):
    RESULTS.append(dict(id=case_id, area=area, scenario=scenario, role=role, method="Isolated API test", steps=steps,
        inputs=inputs, expected=expected, actual=actual, status="Passed" if passed else "Failed", source=source, bug=bug))


def response_summary(response):
    try:
        body = response.data
    except AttributeError:
        body = "Server error" if response.status_code >= 500 else response.content.decode()[:100]
    return "HTTP " + str(response.status_code) + ": " + json.dumps(body, default=str)[:900]


PROBLEM_CASES = [
    ("API-P01", "Missing title", {"title": ""}, 400, ""),
    ("API-P02", "Whitespace-only title", {"title": "   "}, 400, "BUG-VALIDATION"),
    ("API-P03", "Unknown difficulty", {"difficulty": "impossible"}, 400, "BUG-VALIDATION"),
    ("API-P04", "Non-list test cases", {"testCases": {}}, 400, ""),
    ("API-P05", "Test case is null", {"testCases": [None]}, 400, "BUG-MALFORMED"),
    ("API-P06", "Test case is a string", {"testCases": ["bad"]}, 400, "BUG-MALFORMED"),
    ("API-P07", "Sample item is null", {"sampleIO": [None]}, 400, "BUG-MALFORMED"),
    ("API-P08", "Sample IO is an object", {"sampleIO": {"input": "x"}}, 400, "BUG-MALFORMED"),
    ("API-P09", "Negative marks", {"testCases": [{"marks": -1}]}, 400, "BUG-MARKS"),
    ("API-P10", "Non-numeric marks", {"testCases": [{"marks": "abc"}]}, 400, "BUG-MARKS"),
    ("API-P11", "Fractional marks", {"testCases": [{"marks": 1.5}]}, 400, "BUG-MARKS"),
    ("API-P12", "CPU limit below minimum", {"testCases": [{"marks": 1, "cpu_time_limit": 0}]}, 400, ""),
    ("API-P13", "CPU limit above maximum", {"testCases": [{"marks": 1, "cpu_time_limit": 16}]}, 400, ""),
    ("API-P14", "CPU limit is non-numeric", {"testCases": [{"marks": 1, "cpu_time_limit": "bad"}]}, 400, "BUG-VALIDATION"),
    ("API-P15", "Memory below minimum", {"testCases": [{"marks": 1, "memory_limit": 0}]}, 400, ""),
    ("API-P16", "Memory above maximum", {"testCases": [{"marks": 1, "memory_limit": 257}]}, 400, ""),
    ("API-P17", "String false for hidden flag", {"testCases": [{"marks": 1, "is_hidden": "false"}]}, 400, "BUG-VALIDATION"),
    ("API-P18", "Title exceeds storage length", {"title": "X" * 501}, 400, "BUG-MALFORMED"),
    ("API-P19", "Valid create", {}, 201, ""),
]


@pytest.mark.parametrize("case_id,scenario,override,expected,bug", PROBLEM_CASES, ids=[c[0] for c in PROBLEM_CASES])
def test_problem_create_boundaries(setup_data, case_id, scenario, override, expected, bug):
    users, _, _ = setup_data
    payload = {"title": "QA new problem", "description": "Add integers", "difficulty": "easy", "inputFormat": "Integers", "outputFormat": "Sum", "sampleIO": [{"input": "2 3", "output": "5"}], "testCases": [{"inputs": "2 3", "outputs": "5", "marks": 10, "cpu_time_limit": 1, "memory_limit": 128, "is_hidden": False}]}
    payload.update(override)
    response = client_for(users["faculty"]).post(reverse("problems-list-create"), payload, format="json")
    record(case_id, "Problem authoring", scenario, f"HTTP {expected}; invalid input does not create a problem" if expected==400 else "HTTP 201 with persisted problem", response_summary(response), response.status_code==expected,
        steps="POST /api/v1/problems/ as the problem owner", inputs=json.dumps(override)[:700], source="apps/problems/views.py:ProblemListCreateView", bug=bug)
    assert response.status_code == expected


UPDATE_CASES = [
    ("API-U01", "Blank title during edit", {"title": ""}, "BUG-VALIDATION"),
    ("API-U02", "CPU limit is a string during edit", {"testCases": [{"marks": 10, "cpu_time_limit": "bad", "memory_limit": 128}]}, "BUG-MALFORMED"),
    ("API-U03", "Null test case during edit", {"testCases": [None]}, "BUG-MALFORMED"),
    ("API-U04", "Negative marks during edit", {"testCases": [{"marks": -1, "cpu_time_limit": 1, "memory_limit": 128}]}, "BUG-MARKS"),
]


@pytest.mark.parametrize("case_id,scenario,payload,bug", UPDATE_CASES, ids=[c[0] for c in UPDATE_CASES])
def test_problem_update_boundaries(setup_data, case_id, scenario, payload, bug):
    users, problem, _ = setup_data
    response = client_for(users["faculty"]).put(reverse("problems-detail-update-delete", args=[problem.id]), payload, format="json")
    record(case_id, "Problem authoring", scenario, "HTTP 400; original problem is unchanged", response_summary(response), response.status_code==400,
        steps="PUT /api/v1/problems/{owned problem UUID}", inputs=json.dumps(payload), source="apps/problems/views.py:ProblemDetailUpdateDeleteView", bug=bug)
    assert response.status_code == 400


def test_rejected_problem_update_is_atomic(setup_data):
    users, problem, _ = setup_data
    response = client_for(users["faculty"]).put(reverse("problems-detail-update-delete", args=[problem.id]), {
        "sampleIO": [{"input": "replacement", "output": "replacement"}], "testCases": [{"marks": 10, "cpu_time_limit": 99, "memory_limit": 128}]}, format="json")
    actual = list(problem.sample_io.values_list("input", flat=True))
    passed = response.status_code == 400 and actual == ["original sample"]
    record("API-U05", "Problem authoring", "Rejected edit must preserve original sample IO", "HTTP 400 and original sample retained", f"HTTP {response.status_code}; samples after rejected edit: {actual}", passed,
        steps="PUT valid replacement sampleIO together with CPU limit 99; GET problem afterwards", source="apps/problems/views.py:ProblemDetailUpdateDeleteView.put", bug="BUG-PARTIAL-UPDATE")
    assert passed


CONTEST_CASES = [
    ("API-C01", "Edit only end time to before the existing start", {"end_time": "2000-01-01T00:00:00Z"}, "BUG-CONTEST-TIME"),
    ("API-C02", "Edit only start time to after the existing end", {"start_time": "2099-01-01T00:00:00Z"}, "BUG-CONTEST-TIME"),
]


@pytest.mark.parametrize("case_id,scenario,payload,bug", CONTEST_CASES, ids=[c[0] for c in CONTEST_CASES])
def test_partial_contest_dates(setup_data, case_id, scenario, payload, bug):
    users, _, contest = setup_data
    response = client_for(users["faculty"]).put(reverse("contest-detail", args=[contest.id]), payload, format="json")
    record(case_id, "Assessment scheduling", scenario, "HTTP 400; opening remains before closing", response_summary(response), response.status_code==400,
        steps="PUT only one date field for an existing assessment", inputs=json.dumps(payload), source="apps/contests/serializers.py:ContestCreateUpdateSerializer.validate", bug=bug)
    assert response.status_code == 400


def test_unknown_contest_problem_rejected(setup_data):
    users, _, _ = setup_data
    now=timezone.now()
    response = client_for(users["faculty"]).post(reverse("contest-create"), {"name":"QA missing problem", "description":"QA", "problems":[str(uuid4())], "start_time":now.isoformat(), "end_time":(now+timedelta(hours=1)).isoformat()}, format="json")
    record("API-C03", "Assessment scheduling", "Unknown problem IDs in assessment creation", "HTTP 400 identifying missing problem", response_summary(response), response.status_code==400,
        steps="POST /api/v1/contests/create with a non-existent problem UUID", source="apps/contests/views.py:resolve_contest_problems", bug="BUG-CONTEST-PROBLEMS")
    assert response.status_code==400


@pytest.mark.parametrize("operation", ["delete", "unassign"], ids=["API-C04", "API-C05"])
def test_shared_problem_assignment_survives_other_contest_removal(setup_data, operation):
    users, problem, contest = setup_data
    other = Contest.objects.create(name="Remaining assessment", description="QA", created_by=users["faculty"], start_time=contest.start_time, end_time=contest.end_time)
    other.problems.add(problem); other.assigned_students.add(users["student"])
    client = client_for(users["faculty"])
    if operation=="delete": client.delete(reverse("contest-detail", args=[contest.id]))
    else: client.post(reverse("contest-unassign-students", args=[contest.id]), {"studentIds":[str(users["student"].id)]}, format="json")
    retained = problem.assigned_students.filter(id=users["student"].id).exists()
    student_access = client_for(users["student"]).get(reverse("problems-detail-update-delete", args=[problem.id])).status_code
    passed=retained and student_access==200
    record("API-C04" if operation=="delete" else "API-C05", "Assessment assignment", "Removing one assessment preserves access through another", "Student retains problem access in the remaining active assessment", f"Remaining contest assignment=True; problem assignment={retained}; problem GET HTTP {student_access}", passed,
        steps="Assign the same student and problem to two active contests; delete/unassign the first; open the problem in the second", source="apps/contests/views.py:ContestDetailView.delete / UnassignContestToStudentsView", bug="BUG-SHARED-ASSIGNMENT")
    assert passed


@pytest.mark.parametrize("endpoint", ["detail", "roster"], ids=["API-S01", "API-S02"])
def test_other_faculty_cannot_read_private_submission(setup_data, endpoint):
    users, problem, _ = setup_data
    sub=Submission.objects.create(user=users["student"], problem=problem, code="private student code", language="python", status="completed", total_marks=20)
    Result.objects.create(submission=sub, input="private-hidden-input", output="private-hidden-output", expected_output="private-hidden-output", is_hidden=True, passed=True, marks=10)
    client=client_for(users["other_faculty"])
    response=client.get(reverse("submissions-detail", args=[sub.id])) if endpoint=="detail" else client.get(reverse("submissions-for-problem"), {"problem_id":str(problem.id)})
    record("API-S01" if endpoint=="detail" else "API-S02", "Submission privacy", "Other faculty cannot read private problem submissions", "HTTP 403 without code, scores or hidden case data", response_summary(response), response.status_code==403,
        steps="Faculty B requests Faculty A's private problem submission/detail endpoint", source="apps/submissions/views.py:SubmissionDetailView / AllSubmissionsForProblemView", bug="BUG-SUBMISSION-ACCESS")
    assert response.status_code==403


@pytest.mark.parametrize("role", ["faculty", "admin"], ids=["API-A01", "API-A02"])
def test_staff_password_change_revokes_old_token(setup_data, role):
    users, _, _=setup_data; user=users[role]
    token=RefreshToken.for_user(user); token["sessionId"]="old-session"
    client=APIClient(); client.cookies["token"]=str(token.access_token)
    response=client.post(reverse("auth-change-password"), {"oldPassword":"AuditPassword42!", "newPassword":"ChangedAuditPassword99!"}, format="json")
    protected=client.get(reverse("auth-current-user"))
    passed=response.status_code==200 and protected.status_code==401
    record("API-A01" if role=="faculty" else "API-A02", "Authentication and sessions", "Password change revokes an existing staff token", "Password changed; old JWT gets HTTP 401", f"Password change HTTP {response.status_code}; old JWT current-user HTTP {protected.status_code}", passed,
        role=role.title(), steps="Retain a staff access token, change password, replay the retained token", source="apps/users/authentication.py / views.py:ChangePasswordView", bug="BUG-STAFF-REVOKE")
    assert passed


def test_inactive_login_rejected(setup_data):
    users, _, _=setup_data; users["faculty"].is_active=False; users["faculty"].save()
    response=APIClient().post(reverse("auth-login"), {"id":users["faculty"].username,"password":"AuditPassword42!"}, format="json")
    passed=response.status_code in [400,401,403] and not response.data.get("success")
    record("API-A03", "Authentication and sessions", "Inactive account cannot obtain a successful login", "HTTP 400/401/403, no access token", f"HTTP {response.status_code}; success={response.data.get('success')}; token issued={'token' in response.data}", passed,
        steps="Deactivate a faculty test user and submit its valid credentials", source="apps/users/views.py:LoginView", bug="BUG-INACTIVE-LOGIN")
    assert passed


def test_duplicate_profile_email_rejected(setup_data):
    users, _, _=setup_data
    response=client_for(users["faculty"]).put(reverse("user-update"), {"username":users["faculty"].username,"name":"QA name","email":users["other_faculty"].email}, format="json")
    record("API-PR01", "Profile", "Profile update cannot reuse another login email", "HTTP 400; email remains unique for login", response_summary(response), response.status_code==400,
        steps="PUT profile with another faculty account's email", source="apps/users/views.py:UpdateUserView", bug="BUG-DUPLICATE-EMAIL")
    assert response.status_code==400


def test_text_avatar_rejected(setup_data):
    users, _, _=setup_data
    response=client_for(users["faculty"]).post(reverse("user-upload-avatar"), {"avatar":SimpleUploadedFile("not-image.txt", b"not image data", content_type="text/plain")}, format="multipart")
    record("API-PR02", "Profile", "Non-image avatar is rejected", "HTTP 400; no replacement of existing avatar", response_summary(response), response.status_code==400,
        steps="POST /api/v1/user/upload-avatar with a text/plain file", source="apps/users/views.py:UploadAvatarView", bug="BUG-AVATAR-VALIDATION")
    assert response.status_code==400


def test_png_avatar_has_png_content_type(setup_data):
    users, _, _=setup_data; client=client_for(users["faculty"])
    buffer=io.BytesIO(); Image.new("RGB",(8,8),"blue").save(buffer,format="PNG")
    upload=client.post(reverse("user-upload-avatar"), {"avatar":SimpleUploadedFile("qa.png",buffer.getvalue(), content_type="image/png")}, format="multipart")
    response=client.get(reverse("user-get-avatar")); actual=response.get("Content-Type")
    passed=upload.status_code==200 and actual=="image/png"
    record("API-PR03", "Profile", "PNG avatar is served with matching MIME type", "HTTP 200; Content-Type image/png", f"Upload HTTP {upload.status_code}; download Content-Type {actual}", passed,
        steps="Upload a valid PNG then GET /api/v1/user/profile/upload-avatar", source="apps/users/views.py:GetAvatarView", bug="BUG-AVATAR-MIME")
    assert passed


@pytest.mark.parametrize("field,value", [("birthday","not-a-date"),("linkedIn","javascript:alert(1)")], ids=["API-PR04","API-PR05"])
def test_profile_field_validation(setup_data,field,value):
    users, _, _=setup_data
    response=client_for(users["faculty"]).put(reverse("user-update"), {"username":users["faculty"].username,"name":"QA name",field:value}, format="json")
    record("API-PR04" if field=="birthday" else "API-PR05", "Profile", "Invalid profile date or URL is rejected", "HTTP 400 with field validation", response_summary(response), response.status_code==400,
        steps="PUT /api/v1/user/update", inputs=f"{field}={value}", source="apps/users/serializers.py:UpdateProfileSerializer", bug="BUG-PROFILE-VALIDATION")
    assert response.status_code==400


@pytest.mark.parametrize("name,data", [("admin-get-pending-users",{"limit":0}),("admin-get-faculty-by-admin",{"page":"bad"}),("admin-users-sessions",{"page":-1}),("submissions-user-history",{"page":0})], ids=["API-PG01","API-PG02","API-PG03","API-PG04"])
def test_pagination_does_not_crash(setup_data,name,data):
    users, _, _=setup_data; client=client_for(users["admin"])
    response=client.post(reverse(name),data,format="json") if name=="admin-get-faculty-by-admin" else client.get(reverse(name),data)
    passed=response.status_code in [200,400]
    index=["admin-get-pending-users","admin-get-faculty-by-admin","admin-users-sessions","submissions-user-history"].index(name)+1
    record(f"API-PG0{index}", "Pagination and filters", "Invalid pagination never causes server error", "HTTP 400 validation or safe bounded HTTP 200", response_summary(response), passed,
        role="Admin", steps=f"Request {name} with malformed pagination", inputs=json.dumps(data), source="apps/users/views_admin.py / apps/submissions/views.py", bug="BUG-PAGINATION")
    assert passed


@pytest.mark.parametrize("identifier", ["not-a-uuid", 12, None], ids=["API-AS01","API-AS02","API-AS03"])
def test_invalid_assignment_identifier_rejected(setup_data,identifier):
    users, _, contest=setup_data
    response=client_for(users["faculty"]).post(reverse("contest-assign-students", args=[contest.id]), {"studentIds":[identifier]}, format="json")
    index=["not-a-uuid",12,None].index(identifier)+1
    record(f"API-AS0{index}", "Assessment assignment", "Malformed student assignment IDs are validated", "HTTP 400, no assignment made", response_summary(response), response.status_code==400,
        steps="POST assessment student assignment", inputs=json.dumps({"studentIds":[identifier]}), source="apps/contests/views.py:AssignContestToStudentsView", bug="BUG-ASSIGN-ID")
    assert response.status_code==400


@pytest.mark.parametrize("status_id", [6,7,8,11,12,13], ids=["API-E06","API-E07","API-E08","API-E11","API-E12","API-E13"])
def test_nonaccepted_judge_status_never_awards_marks(setup_data,status_id):
    _,problem,_=setup_data
    test_case=ProblemTestCase.objects.create(problem=problem,inputs="",outputs="",marks=10)
    client=Judge0Client()
    response=Mock(); response.raise_for_status.return_value=None; response.json.return_value={"status":{"id":status_id,"description":"Non-accepted execution"},"stdout":None,"stderr":None,"compile_output":None,"message":"Sandbox failure"}
    with patch("apps.execution.services.requests.get",return_value=response): result=client.fetch_result("fake-token")
    with patch.object(client,"submit_one",return_value={"token":"fake-token"}), patch.object(client,"fetch_result",return_value=result): actual=client.execute_test_cases("pass","python",[test_case])[0]
    passed=not actual["passed"] and actual["marks"]==0
    record(f"API-E{status_id:02}", "Code execution and grading", "Judge0 failure status with empty expected output cannot pass", "passed=False; marks=0 for every status other than accepted", json.dumps({"judge_status":status_id,"passed":actual["passed"],"marks":actual["marks"],"error":actual["error"]}),passed,
        steps="Return a non-accepted Judge0 status with empty stdout and an empty expected output", source="apps/execution/services.py:fetch_result / execute_test_cases",bug="BUG-JUDGE-STATUS")
    assert passed


@pytest.mark.parametrize("role,name", [("student","admin-get-pending-users"),("student","faculty-get-students"),("faculty","admin-users-sessions")], ids=["API-R01","API-R02","API-R03"])
def test_role_restriction_controls(setup_data,role,name):
    users, _, _=setup_data; response=client_for(users[role]).get(reverse(name))
    index=[("student","admin-get-pending-users"),("student","faculty-get-students"),("faculty","admin-users-sessions")].index((role,name))+1
    record(f"API-R0{index}","Role permissions","Student/faculty cannot open higher-privilege API", "HTTP 403",response_summary(response),response.status_code==403,role=role.title(),steps=f"GET {name}",source="apps/users/permissions.py")
    assert response.status_code==403


@pytest.mark.parametrize("sort_by,sort_order", [("totalMarks","asc"),("studentId","asc")], ids=["API-LB01","API-LB02"])
def test_rank_is_independent_of_display_sort(setup_data,sort_by,sort_order):
    users,problem,contest=setup_data
    lower=User.objects.create_user(username="qa_lower_score",role="student",student_id="aaa001",is_approved=True,first_time_login=False,faculty=users["faculty"])
    contest.assigned_students.add(lower)
    Submission.objects.create(user=users["student"],problem=problem,code="pass",language="python",status="completed",total_marks=20)
    Submission.objects.create(user=lower,problem=problem,code="pass",language="python",status="rejected",total_marks=5)
    response=client_for(users["faculty"]).get(reverse("contest-dashboard",args=[contest.id]),{"sortBy":sort_by,"sortOrder":sort_order})
    rows=response.data.get("rankings",[])
    best=next((row for row in rows if row["totalMarks"]==20),{})
    passed=response.status_code==200 and best.get("rank")==1
    record("API-LB01" if sort_by=="totalMarks" else "API-LB02","Rankings and exports","Highest score retains rank 1 when display sorting changes","20-mark student rank=1 regardless of ascending score/ID display order",json.dumps([{k:r.get(k) for k in ["rank","studentId","totalMarks"]} for r in rows]),passed,
        steps="Create assigned students scoring 20 and 5; request leaderboard sorted ascending by score or student ID",inputs=f"sortBy={sort_by}; sortOrder={sort_order}",source="apps/contests/views.py:ContestDashboardView",bug="BUG-RANK-SORT")
    assert passed


@pytest.mark.parametrize("role", ["faculty","student"], ids=["API-A04","API-A05"])
def test_initial_password_is_not_public_identifier(setup_data,role):
    users,_,_=setup_data
    if role=="faculty":
        user=User.objects.create_user(username="qa_pending_faculty",email="publicname@example.test",role="faculty",is_approved=False,first_time_login=True)
        response=client_for(users["admin"]).post(reverse("admin-accept-request"),{"userId":str(user.id)},format="json")
        predictable="publicname"
    else:
        user=User.objects.create_user(username="qa_pending_student",student_id="qa22it999",role="student",is_approved=False,first_time_login=True,faculty=users["faculty"])
        response=client_for(users["faculty"]).post(reverse("faculty-accept-request"),{"userId":str(user.id),"facultyId":str(users["faculty"].id)},format="json")
        predictable="qa22it999"
    user.refresh_from_db(); insecure=user.check_password(predictable)
    record("API-A04" if role=="faculty" else "API-A05","Authentication and sessions","First-login password cannot be derived from public ID/email","Approval requires an unpredictable one-time invitation credential",f"Approval HTTP {response.status_code}; stored password matches public identifier={insecure}",not insecure,
        role=role.title(),steps="Approve a new account; check whether its password equals the student ID or faculty email prefix",source="apps/users/views_admin.py / views_faculty.py:accept request",bug="BUG-PREDICTABLE-PASSWORD")
    assert not insecure


def test_expired_cookie_can_log_out(setup_data):
    users,_,_=setup_data; token=RefreshToken.for_user(users["faculty"]).access_token
    token["exp"]=int(timezone.now().timestamp())-30
    client=APIClient(); client.cookies["token"]=str(token)
    response=client.post(reverse("auth-logout"),{},format="json")
    passed=response.status_code==200 and response.cookies.get("token") is not None
    record("API-A06","Authentication and sessions","Invalid or expired cookies do not prevent logout","HTTP 200 and token cookie cleared",f"Logout with expired JWT HTTP {response.status_code}; cookie cleared={'token' in response.cookies}",passed,
        steps="Place an expired test JWT in the token cookie and POST logout",source="apps/users/views.py:LogoutView / authentication.py",bug="BUG-SESSION-RECOVERY")
    assert passed


def test_compiler_language_type_validation(setup_data):
    users,problem,_=setup_data
    response=client_for(users["faculty"]).post(reverse("compiler-run-code"),{"code":"pass","language":["python"],"problemId":str(problem.id)},format="json")
    record("API-E01","Code execution and grading","Malformed execution language is validated before execution","HTTP 400 validation; no Judge0 request",response_summary(response),response.status_code==400,
        steps="POST compiler/run-code with a list instead of a language string",source="apps/execution/views.py:RunCodeView / services.py:get_language_id",bug="BUG-COMPILER-VALIDATION")
    assert response.status_code==400


def test_draft_code_values_must_be_strings(setup_data):
    users,problem,_=setup_data
    response=client_for(users["faculty"]).post(reverse("code-draft-save"),{"problemId":str(problem.id),"codeByLanguage":{"python":{"not":"source text"}}},format="json")
    record("API-D01","Code drafts","Code draft entries must contain text source","HTTP 400 for non-string source values",response_summary(response),response.status_code==400,
        steps="POST compile/saveCode with an object as the Python source",source="apps/code_drafts/serializers.py:CodeDraftSaveSerializer",bug="BUG-DRAFT-VALIDATION")
    assert response.status_code==400


def test_ranking_time_matches_ist_display(setup_data):
    from datetime import datetime, timezone as datetime_timezone
    from zoneinfo import ZoneInfo
    users,problem,contest=setup_data
    submitted=datetime(2026,10,14,0,30,tzinfo=datetime_timezone.utc)
    contest.start_time=submitted-timedelta(hours=1);contest.end_time=submitted+timedelta(hours=1);contest.save()
    Submission.objects.create(user=users["student"],problem=problem,code="pass",language="python",status="completed",total_marks=20,created_at=submitted)
    response=client_for(users["faculty"]).get(reverse("contest-dashboard",args=[contest.id]))
    actual=response.data["rankings"][0]["lastSubmissionTime"];expected=submitted.astimezone(ZoneInfo("Asia/Kolkata")).strftime("%I:%M:%S %p")
    record("API-LB03","Rankings and exports","Assessment ranking time matches the application's IST display","06:00:00 AM IST for a 00:30 UTC submission",f"API displays {actual} without a timezone; IST equivalent is {expected}",actual==expected,
        steps="Create a 00:30 UTC submission within an active window and request its assessment dashboard",source="apps/contests/views.py:ContestDashboardView datetime formatting",bug="BUG-RANK-TIMEZONE")
    assert actual==expected
