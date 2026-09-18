import pytest
from rest_framework.test import APIClient
from apps.users.models import User


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


@pytest.mark.django_db
def test_admin_pending_and_accept_request(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)

    # Create unapproved faculty
    pending_fac = User.objects.create(
        username="pending_fac",
        email="pendingfac@charusat.edu.in",
        role="faculty",
        is_approved=False,
    )

    res = api_client.get("/api/v1/admin/get-pending-users")
    assert res.status_code == 200
    assert res.json()["success"] is True
    assert len(res.json()["data"]) == 1

    # Accept request
    accept_res = api_client.post(
        "/api/v1/admin/accept-request",
        data={"userId": str(pending_fac.id)},
        format="json"
    )
    assert accept_res.status_code == 200
    assert accept_res.json()["success"] is True

    pending_fac.refresh_from_db()
    assert pending_fac.is_approved is True
    assert pending_fac.check_password("pendingfac")


@pytest.mark.django_db
def test_admin_decline_and_accept_all(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)

    # 1 to decline
    user_to_decline = User.objects.create(
        username="fac_to_decline",
        email="decline@charusat.edu.in",
        role="faculty",
        is_approved=False,
    )

    res = api_client.post(
        "/api/v1/admin/decline-request",
        data={"userId": str(user_to_decline.id)},
        format="json"
    )
    assert res.status_code == 200
    assert not User.objects.filter(id=user_to_decline.id).exists()

    # Create 2 unapproved faculty for accept-all
    User.objects.create(username="fac1", email="fac1@charusat.edu.in", role="faculty", is_approved=False)
    User.objects.create(username="fac2", email="fac2@charusat.edu.in", role="faculty", is_approved=False)

    res_all = api_client.post("/api/v1/admin/accept-all-requests")
    assert res_all.status_code == 200
    assert res_all.json()["success"] is True
    assert User.objects.filter(role="faculty", is_approved=True).count() >= 2


@pytest.mark.django_db
def test_admin_get_faculty_and_delete(api_client, admin_user, faculty_user):
    api_client.force_authenticate(user=admin_user)

    res = api_client.post("/api/v1/admin/get-faculty-by-admin", data={"page": 1, "limit": 10}, format="json")
    assert res.status_code == 200
    assert res.json()["success"] is True
    assert len(res.json()["facultys"]) >= 1

    del_res = api_client.delete(
        "/api/v1/admin/deleteFaculty",
        data={"facultyId": str(faculty_user.id)},
        format="json"
    )
    assert del_res.status_code == 200
    assert not User.objects.filter(id=faculty_user.id).exists()


@pytest.mark.django_db
def test_faculty_pending_and_accept(api_client, faculty_user):
    api_client.force_authenticate(user=faculty_user)

    student = User.objects.create(
        username="newstudent",
        student_id="22IT045",
        role="student",
        faculty=faculty_user,
        is_approved=False,
    )

    res = api_client.get(f"/api/v1/faculty/get-pending-users?facultyId={faculty_user.id}")
    assert res.status_code == 200
    assert res.json()["success"] is True

    accept_res = api_client.post(
        "/api/v1/faculty/accept-request",
        data={"userId": str(student.id), "facultyId": str(faculty_user.id)},
        format="json"
    )
    assert accept_res.status_code == 200
    assert accept_res.json()["success"] is True

    student.refresh_from_db()
    assert student.is_approved is True
    assert student.email == "22it045@charusat.edu.in"
    assert student.check_password("22IT045")


@pytest.mark.django_db
def test_faculty_bulk_register_and_expire_session(api_client, faculty_user):
    api_client.force_authenticate(user=faculty_user)

    bulk_data = {
        "facultyId": str(faculty_user.id),
        "students": [
            {"username": "Student IT", "id": "22IT099", "batch": "a1", "semester": 6},
            {"username": "Student CE", "id": "22CE050", "batch": "b1", "semester": 6},
        ]
    }

    res = api_client.post("/api/v1/faculty/bulk-register", data=bulk_data, format="json")
    assert res.status_code == 200
    results = res.json()["results"]
    assert len(results["success"]) == 2

    # Check that users were created with right branch and password
    it_student = User.objects.get(student_id="22IT099")
    assert it_student.branch == "cspit-it"
    assert it_student.check_password("22IT099")

    ce_student = User.objects.get(student_id="22CE050")
    assert ce_student.branch == "cspit-ce"

    # Test get students by faculty
    get_res = api_client.post(
        "/api/v1/faculty/get-students-by-faculty",
        data={"facultyId": str(faculty_user.id)},
        format="json"
    )
    assert get_res.status_code == 200
    assert len(get_res.json()["students"]) >= 2

    # Test expire session
    it_student.session_id = "test-session-123"
    it_student.save()

    expire_res = api_client.post(
        "/api/v1/faculty/expire-session",
        data={"userId": str(it_student.id)},
        format="json"
    )
    assert expire_res.status_code == 200
    it_student.refresh_from_db()
    assert it_student.session_id is None

    # Test remove user
    del_res = api_client.delete(f"/api/v1/faculty/remove-user/{it_student.id}")
    assert del_res.status_code == 200
    assert not User.objects.filter(id=it_student.id).exists()
