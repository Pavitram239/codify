import pytest
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from apps.users.models import User
from apps.problems.models import Problem, TestCase
from apps.contests.models import Contest
from apps.submissions.models import Submission


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    user = User.objects.create(
        username="admin_user",
        role="admin",
        is_approved=True,
        is_staff=True,
    )
    user.set_password("AdminPass123!")
    user.save()
    return user


@pytest.fixture
def faculty_user(db):
    user = User.objects.create(
        username="faculty_user",
        email="faculty@charusat.edu.in",
        role="faculty",
        is_approved=True,
    )
    user.set_password("FacultyPass123!")
    user.save()
    return user


@pytest.fixture
def student_user(db):
    user = User.objects.create(
        username="student_user",
        student_id="22it001",
        role="student",
        branch="cspit-it",
        semester=6,
        batch="a1",
        is_approved=True,
    )
    user.set_password("StudentPass123!")
    user.save()
    return user


@pytest.fixture
def sample_problem(db, faculty_user):
    prob = Problem.objects.create(
        title="Contest Problem 1",
        description="Contest problem description",
        difficulty="medium",
        input_format="Integer",
        output_format="Integer",
        constraints="N < 100",
        tags=["math"],
        total_marks=50,
        created_by=faculty_user,
    )
    TestCase.objects.create(
        problem=prob,
        inputs="5",
        outputs="25",
        marks=50,
        order=1,
    )
    return prob


@pytest.mark.django_db
def test_create_contest_and_status(api_client, faculty_user, sample_problem):
    api_client.force_authenticate(user=faculty_user)
    now = timezone.now()

    payload = {
        "name": "Weekly Contest #1",
        "description": "Our first weekly contest",
        "start_time": (now + timedelta(hours=1)).isoformat(),
        "end_time": (now + timedelta(hours=3)).isoformat(),
        "problems": [str(sample_problem.id)],
    }

    res = api_client.post("/api/v1/contests/create", data=payload, format="json")
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Weekly Contest #1"
    assert data["status"] == "upcoming"
    assert len(data["problems"]) == 1
    assert data["problems"][0]["title"] == "Contest Problem 1"


@pytest.mark.django_db
def test_create_contest_invalid_dates(api_client, faculty_user):
    api_client.force_authenticate(user=faculty_user)
    now = timezone.now()

    payload = {
        "name": "Invalid Contest",
        "description": "End before start",
        "start_time": (now + timedelta(hours=3)).isoformat(),
        "end_time": (now + timedelta(hours=1)).isoformat(),
        "problems": [],
    }

    res = api_client.post("/api/v1/contests/create", data=payload, format="json")
    assert res.status_code == 400


@pytest.mark.django_db
def test_get_contests_role_filtering(api_client, admin_user, faculty_user, student_user, sample_problem):
    now = timezone.now()
    contest1 = Contest.objects.create(
        name="Faculty Contest",
        description="By faculty user",
        created_by=faculty_user,
        start_time=now - timedelta(hours=1),
        end_time=now + timedelta(hours=1),
    )
    contest1.problems.add(sample_problem)
    contest1.assigned_students.add(student_user)

    # Faculty 2 contest
    faculty2 = User.objects.create(username="fac2", role="faculty", is_approved=True)
    Contest.objects.create(
        name="Other Contest",
        description="By another faculty",
        created_by=faculty2,
        start_time=now + timedelta(hours=1),
        end_time=now + timedelta(hours=2),
    )

    # Admin sees all
    api_client.force_authenticate(user=admin_user)
    res = api_client.get("/api/v1/contests/")
    assert res.status_code == 200
    assert len(res.json()) == 2

    # Faculty sees only their own
    api_client.force_authenticate(user=faculty_user)
    res = api_client.get("/api/v1/contests/")
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["name"] == "Faculty Contest"

    # Student sees only assigned
    api_client.force_authenticate(user=student_user)
    res = api_client.get("/api/v1/contests/")
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["name"] == "Faculty Contest"


@pytest.mark.django_db
def test_assign_and_unassign_cascade(api_client, faculty_user, student_user, sample_problem):
    api_client.force_authenticate(user=faculty_user)
    now = timezone.now()

    contest = Contest.objects.create(
        name="Cascade Contest",
        description="Cascade test",
        created_by=faculty_user,
        start_time=now,
        end_time=now + timedelta(hours=2),
    )
    contest.problems.add(sample_problem)

    # Initially student is not assigned to contest or problem
    assert not contest.assigned_students.filter(id=student_user.id).exists()
    assert not sample_problem.assigned_students.filter(id=student_user.id).exists()

    # Assign student to contest
    res = api_client.post(
        f"/api/v1/contests/{contest.id}/assignContestToStudents",
        data={"studentIds": [str(student_user.id)]},
        format="json"
    )
    assert res.status_code == 200
    assert contest.assigned_students.filter(id=student_user.id).exists()
    # Verified cascade to problem!
    assert sample_problem.assigned_students.filter(id=student_user.id).exists()

    # Unassign student from contest
    res = api_client.post(
        f"/api/v1/contests/{contest.id}/unassignContestToStudents",
        data={"studentIds": [str(student_user.id)]},
        format="json"
    )
    assert res.status_code == 200
    assert not contest.assigned_students.filter(id=student_user.id).exists()
    # Verified cascade removal from problem!
    assert not sample_problem.assigned_students.filter(id=student_user.id).exists()


@pytest.mark.django_db
def test_delete_contest_cascade(api_client, faculty_user, student_user, sample_problem):
    api_client.force_authenticate(user=faculty_user)
    now = timezone.now()

    contest = Contest.objects.create(
        name="Delete Contest",
        description="Delete test",
        created_by=faculty_user,
        start_time=now,
        end_time=now + timedelta(hours=2),
    )
    contest.problems.add(sample_problem)
    contest.assigned_students.add(student_user)
    sample_problem.assigned_students.add(student_user)

    res = api_client.delete(f"/api/v1/contests/{contest.id}")
    assert res.status_code == 204
    assert not Contest.objects.filter(id=contest.id).exists()
    # Check problem unassigned
    assert not sample_problem.assigned_students.filter(id=student_user.id).exists()


@pytest.mark.django_db
def test_contest_dashboard(api_client, faculty_user, student_user, sample_problem):
    api_client.force_authenticate(user=faculty_user)
    now = timezone.now()

    contest = Contest.objects.create(
        name="Dashboard Contest",
        description="Dashboard test",
        created_by=faculty_user,
        start_time=now,
        end_time=now + timedelta(hours=2),
    )
    contest.problems.add(sample_problem)
    contest.assigned_students.add(student_user)

    # Create submission for student
    Submission.objects.create(
        problem=sample_problem,
        user=student_user,
        code="print(5)",
        language="python",
        status="completed",
        number_of_test_cases_pass=1,
        number_of_test_cases=1,
        total_marks=50,
    )

    res = api_client.get(f"/api/v1/contests/{contest.id}/dashboard")
    assert res.status_code == 200
    data = res.json()
    assert data["contestName"] == "Dashboard Contest"
    assert len(data["problemNames"]) == 1
    assert len(data["rankings"]) == 1
    assert data["rankings"][0]["username"] == "student_user"
    assert data["rankings"][0]["totalMarks"] == 50
    assert data["rankings"][0]["rank"] == 1
