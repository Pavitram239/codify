import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.problems.models import Problem, SampleIO, TestCase
from apps.users.models import User


@pytest.fixture
def api_client():
    return APIClient()


def auth_client_for_user(user):
    client = APIClient()
    user.session_id = "test-session-123"
    user.save()
    refresh = RefreshToken.for_user(user)
    refresh["id"] = str(user.id)
    refresh["sessionId"] = "test-session-123"
    token = str(refresh.access_token)
    client.cookies["token"] = token
    return client


@pytest.fixture
def faculty_user(db):
    user = User(
        username="prof_turing",
        email="turing@charusat.edu.in",
        role="faculty",
        subject="Algorithms",
        is_approved=True,
        first_time_login=False,
    )
    user.set_password("pass123")
    user.save()
    return user


@pytest.fixture
def student_user(db):
    user = User(
        username="ada_lovelace",
        student_id="22it101",
        email="22it101@charusat.edu.in",
        role="student",
        branch="cspit-it",
        semester=5,
        batch="a1",
        is_approved=True,
        first_time_login=False,
    )
    user.set_password("pass123")
    user.save()
    return user


@pytest.fixture
def student_user_2(db):
    user = User(
        username="grace_hopper",
        student_id="22ce102",
        email="22ce102@charusat.edu.in",
        role="student",
        branch="cspit-ce",
        semester=5,
        batch="b1",
        is_approved=True,
        first_time_login=False,
    )
    user.set_password("pass123")
    user.save()
    return user


@pytest.fixture
def sample_problem(db, faculty_user, student_user):
    prob = Problem.objects.create(
        title="Two Sum",
        description="Find two numbers that add up to target.",
        difficulty="easy",
        input_format="n integers followed by target",
        output_format="Indices of the two numbers",
        constraints="1 <= n <= 10^4",
        total_marks=30,
        created_by=faculty_user,
    )
    SampleIO.objects.create(problem=prob, input="4\n2 7 11 15\n9", output="0 1", order=0)
    TestCase.objects.create(
        problem=prob,
        inputs="4\n2 7 11 15\n9",
        outputs="0 1",
        marks=10,
        cpu_time_limit=1.0,
        memory_limit=128,
        is_hidden=False,
        order=0,
    )
    TestCase.objects.create(
        problem=prob,
        inputs="3\n3 2 4\n6",
        outputs="1 2",
        marks=20,
        cpu_time_limit=2.0,
        memory_limit=128,
        is_hidden=True,
        order=1,
    )
    prob.assigned_students.add(student_user)
    return prob


@pytest.mark.django_db
class TestProblemsAPI:

    def test_create_problem_faculty(self, faculty_user):
        client = auth_client_for_user(faculty_user)
        url = reverse("problems-list-create")
        payload = {
            "title": "Reverse String",
            "description": "Reverse a given string in place.",
            "difficulty": "easy",
            "inputFormat": "A string s",
            "outputFormat": "Reversed string",
            "constraints": "1 <= s.length <= 10^5",
            "tags": ["strings", "pointers"],
            "sampleIO": [{"input": "hello", "output": "olleh"}],
            "testCases": [
                {
                    "inputs": "hello",
                    "outputs": "olleh",
                    "marks": 25,
                    "cpu_time_limit": 1.5,
                    "memory_limit": 64,
                    "is_hidden": False,
                },
                {
                    "inputs": "world",
                    "outputs": "dlrow",
                    "marks": 25,
                    "cpu_time_limit": 1.5,
                    "memory_limit": 64,
                    "is_hidden": True,
                },
            ],
        }
        res = client.post(url, payload, format="json")
        assert res.status_code == 201
        assert res.data["title"] == "Reverse String"
        assert res.data["totalMarks"] == 50

        # Verify DB
        prob = Problem.objects.get(title="Reverse String")
        assert prob.sample_io.count() == 1
        assert prob.test_cases.count() == 2

    def test_create_problem_student_forbidden(self, student_user):
        client = auth_client_for_user(student_user)
        url = reverse("problems-list-create")
        res = client.post(url, {"title": "Hack", "description": "test"}, format="json")
        assert res.status_code == 403

    def test_list_problems_student_assigned_only(self, student_user, sample_problem):
        # sample_problem is assigned to student_user
        # create another unassigned problem
        Problem.objects.create(
            title="Unassigned Problem",
            description="...",
            difficulty="hard",
            input_format="...",
            output_format="...",
            total_marks=50,
            created_by=sample_problem.created_by,
        )

        client = auth_client_for_user(student_user)
        url = reverse("problems-list-create")
        res = client.get(url)
        assert res.status_code == 200
        assert res.data["success"] is True
        assert res.data["totalProblems"] == 1
        assert res.data["problems"][0]["title"] == "Two Sum"

    def test_get_problem_detail_assigned_student(self, student_user, sample_problem):
        client = auth_client_for_user(student_user)
        url = reverse("problems-detail-update-delete", kwargs={"id": sample_problem.id})
        res = client.get(url)
        assert res.status_code == 200
        assert res.data["title"] == "Two Sum"
        # Only visible test cases (is_hidden=False) are exposed
        assert len(res.data["testCases"]) == 1
        assert res.data["testCases"][0]["is_hidden"] is False

    def test_get_problem_detail_unassigned_student_forbidden(self, student_user_2, sample_problem):
        client = auth_client_for_user(student_user_2)
        url = reverse("problems-detail-update-delete", kwargs={"id": sample_problem.id})
        res = client.get(url)
        assert res.status_code == 403

    def test_get_problem_for_update_faculty(self, faculty_user, sample_problem):
        client = auth_client_for_user(faculty_user)
        url = reverse("problems-for-update", kwargs={"id": sample_problem.id})
        res = client.get(url)
        assert res.status_code == 200
        # Includes all test cases (both visible and hidden)
        assert len(res.data["testCases"]) == 2

    def test_update_problem_faculty(self, faculty_user, sample_problem):
        client = auth_client_for_user(faculty_user)
        url = reverse("problems-detail-update-delete", kwargs={"id": sample_problem.id})
        payload = {
            "title": "Two Sum Updated",
            "difficulty": "medium",
            "testCases": [
                {
                    "inputs": "1 2\n3",
                    "outputs": "0 1",
                    "marks": 50,
                    "cpu_time_limit": 1.0,
                    "memory_limit": 128,
                    "is_hidden": False,
                }
            ],
        }
        res = client.put(url, payload, format="json")
        assert res.status_code == 200
        sample_problem.refresh_from_db()
        assert sample_problem.title == "Two Sum Updated"
        assert sample_problem.difficulty == "medium"
        assert sample_problem.total_marks == 50
        assert sample_problem.test_cases.count() == 1

    def test_assign_and_unassign_students(self, faculty_user, student_user_2, sample_problem):
        client = auth_client_for_user(faculty_user)

        # Assign student 2
        assign_url = reverse("problems-assign", kwargs={"id": sample_problem.id})
        res = client.post(assign_url, {"studentIds": [str(student_user_2.id)]}, format="json")
        assert res.status_code == 200
        assert sample_problem.assigned_students.filter(id=student_user_2.id).exists()

        # Unassign student 2
        unassign_url = reverse("problems-unassign", kwargs={"id": sample_problem.id})
        res2 = client.post(unassign_url, {"studentIds": [str(student_user_2.id)]}, format="json")
        assert res2.status_code == 200
        assert not sample_problem.assigned_students.filter(id=student_user_2.id).exists()

    def test_filtered_students_queries(self, faculty_user, student_user, student_user_2, sample_problem):
        client = auth_client_for_user(faculty_user)

        # student_user is assigned, student_user_2 is unassigned
        assigned_url = reverse("problems-assigned-students", kwargs={"id": sample_problem.id})
        res = client.get(assigned_url, {"branch": "cspit-it"})
        assert res.status_code == 200
        assert len(res.data["assignedStudents"]) == 1
        assert res.data["assignedStudents"][0]["username"] == "ada_lovelace"

        unassigned_url = reverse("problems-unassigned-students", kwargs={"id": sample_problem.id})
        res2 = client.get(unassigned_url, {"branch": "cspit-ce"})
        assert res2.status_code == 200
        assert len(res2.data["unassignedStudents"]) == 1
        assert res2.data["unassignedStudents"][0]["username"] == "grace_hopper"

    def test_students_stats_endpoint(self, faculty_user, student_user, student_user_2):
        client = auth_client_for_user(faculty_user)
        url = reverse("problems-get-students")
        res = client.get(url)
        assert res.status_code == 200
        assert res.data["totalStudents"] == 2
        assert len(res.data["branchWiseCount"]) >= 2
        assert "5" in res.data["semesterBranchBatchWiseCount"]

    def test_delete_problem(self, faculty_user, sample_problem):
        client = auth_client_for_user(faculty_user)
        url = reverse("problems-detail-update-delete", kwargs={"id": sample_problem.id})
        res = client.delete(url)
        assert res.status_code == 200
        assert not Problem.objects.filter(id=sample_problem.id).exists()
