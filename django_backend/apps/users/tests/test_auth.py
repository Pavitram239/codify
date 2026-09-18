import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from apps.users.models import User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def student_user(db):
    user = User(
        username="john_doe",
        student_id="22it001",
        email="22it001@charusat.edu.in",
        role="student",
        branch="cspit-it",
        semester=5,
        batch="a1",
        is_approved=True,
        first_time_login=False,
    )
    user.set_password("secret123")
    user.save()
    return user


@pytest.fixture
def faculty_user(db):
    user = User(
        username="prof_smith",
        email="smith@charusat.edu.in",
        role="faculty",
        subject="Data Structures",
        is_approved=True,
        first_time_login=False,
    )
    user.set_password("faculty123")
    user.save()
    return user


@pytest.mark.django_db
class TestAuthentication:

    def test_student_registration(self, api_client):
        url = reverse("auth-register")
        payload = {
            "username": "new_student",
            "id": "22it099",
            "mobileNo": "9876543210",
            "branch": "cspit-it",
            "semester": 3,
            "batch": "b1",
            "subject": "Algorithms",
            "role": "student",
        }
        res = api_client.post(url, payload, format="json")
        assert res.status_code == 201
        assert res.data["success"] is True

        user = User.objects.get(student_id="22it099")
        assert user.is_approved is False
        assert user.first_time_login is True

    def test_faculty_registration(self, api_client):
        url = reverse("auth-register")
        payload = {
            "username": "prof_jones",
            "email": "jones@charusat.edu.in",
            "subject": "Web Development",
            "role": "faculty",
        }
        res = api_client.post(url, payload, format="json")
        assert res.status_code == 201
        assert res.data["success"] is True

        user = User.objects.get(email="jones@charusat.edu.in")
        assert user.is_approved is False

    def test_login_unapproved_user(self, api_client, student_user):
        student_user.is_approved = False
        student_user.save()

        url = reverse("auth-login")
        res = api_client.post(url, {"id": "22it001", "password": "secret123"}, format="json")
        assert res.status_code == 200
        assert res.data["success"] is False
        assert "not approved" in res.data["message"].lower()

    def test_login_first_time(self, api_client, student_user):
        student_user.first_time_login = True
        student_user.save()

        url = reverse("auth-login")
        res = api_client.post(url, {"id": "22it001", "password": "secret123"}, format="json")
        assert res.status_code == 200
        assert res.data["success"] is True
        assert res.data["firstTimeLogin"] is True
        assert "token" not in res.cookies

    def test_login_success_and_cookie_emission(self, api_client, student_user):
        url = reverse("auth-login")
        res = api_client.post(url, {"id": "22it001", "password": "secret123"}, format="json")

        assert res.status_code == 200
        assert res.data["success"] is True
        assert "token" in res.cookies
        assert res.cookies["token"]["httponly"] is True

        # Check frontend compatibility fields
        user_data = res.data["user"]
        assert "_id" in user_data
        assert user_data["_id"] == str(student_user.id)
        assert user_data["id"] == "22it001"
        assert user_data["role"] == "student"

        # Verify session ID was recorded in DB
        student_user.refresh_from_db()
        assert student_user.session_id is not None

    def test_login_concurrent_session_rejection(self, api_client, student_user):
        # First login succeeds
        url = reverse("auth-login")
        res1 = api_client.post(url, {"id": "22it001", "password": "secret123"}, format="json")
        assert res1.status_code == 200

        # Second login from another client while session is active
        res2 = api_client.post(url, {"id": "22it001", "password": "secret123"}, format="json")
        assert res2.status_code == 400
        assert res2.data["success"] is False
        assert "already logged in" in res2.data["message"].lower()

    def test_get_current_user(self, api_client, student_user):
        # Login first to obtain cookie
        login_url = reverse("auth-login")
        login_res = api_client.post(login_url, {"id": "22it001", "password": "secret123"}, format="json")
        token = login_res.cookies["token"].value

        # Set cookie on client
        api_client.cookies["token"] = token
        current_user_url = reverse("auth-current-user")
        res = api_client.get(current_user_url)

        assert res.status_code == 200
        assert res.data["success"] is True
        assert res.data["user"]["username"] == "john_doe"
        assert res.data["user"]["_id"] == str(student_user.id)

    def test_logout_clears_session_and_cookie(self, api_client, student_user):
        # Login
        login_url = reverse("auth-login")
        login_res = api_client.post(login_url, {"id": "22it001", "password": "secret123"}, format="json")
        api_client.cookies["token"] = login_res.cookies["token"].value

        # Logout
        logout_url = reverse("auth-logout")
        res = api_client.get(logout_url)
        assert res.status_code == 200
        assert res.data["success"] is True

        # Check DB session cleared
        student_user.refresh_from_db()
        assert student_user.session_id is None

        # Subsequent call to get-current-user fails
        current_user_url = reverse("auth-current-user")
        res2 = api_client.get(current_user_url)
        assert res2.status_code == 403 or res2.status_code == 401

    def test_change_password(self, api_client, student_user):
        url = reverse("auth-change-password")
        res = api_client.post(
            url,
            {"oldPassword": "secret123", "newPassword": "newSecret456", "id": "22it001"},
            format="json",
        )
        assert res.status_code == 200
        assert res.data["success"] is True

        student_user.refresh_from_db()
        assert student_user.check_password("newSecret456") is True
        assert student_user.first_time_login is False

    def test_fetch_subjects(self, api_client, faculty_user):
        url = reverse("auth-fetch-subjects")
        res = api_client.get(url)
        assert res.status_code == 200
        assert res.data["success"] is True
        assert len(res.data["subjects"]) >= 1
        subject_item = res.data["subjects"][0]
        assert subject_item["teacher"] == "prof_smith"
        assert subject_item["subject"] == "Data Structures"
