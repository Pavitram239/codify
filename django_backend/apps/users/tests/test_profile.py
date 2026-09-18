import io
import pytest
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import User


@pytest.fixture
def user(db):
    u = User(
        username="test_user",
        email="test_user@example.com",
        role="student",
        is_approved=True,
        first_time_login=False,
    )
    u.set_password("pass123")
    u.save()
    return u


@pytest.fixture
def other_user(db):
    u = User(
        username="other_user",
        email="other_user@example.com",
        role="student",
        is_approved=True,
        first_time_login=False,
    )
    u.set_password("pass123")
    u.save()
    return u


def auth_client_for_user(user):
    client = APIClient()
    user.session_id = "test-session-profile"
    user.save()
    refresh = RefreshToken.for_user(user)
    refresh["id"] = str(user.id)
    refresh["sessionId"] = "test-session-profile"
    token = str(refresh.access_token)
    client.cookies["token"] = token
    return client


def generate_test_image():
    file = io.BytesIO()
    image = Image.new("RGB", (100, 100), color="blue")
    image.save(file, "JPEG")
    file.seek(0)
    return SimpleUploadedFile("avatar.jpg", file.read(), content_type="image/jpeg")


@pytest.mark.django_db
class TestUserProfile:

    def test_update_profile_success(self, user):
        client = auth_client_for_user(user)
        url = reverse("user-update")
        payload = {
            "username": "updated_user",
            "name": "Jane Doe",
            "bio": "Software Engineer & Competitive Programmer",
            "gender": "Female",
            "location": "New York, USA",
            "skills": "Python, Django, React",
            "github": "https://github.com/janedoe",
            "linkedIn": "https://linkedin.com/in/janedoe",
        }
        res = client.put(url, payload, format="json")
        assert res.status_code == 200
        assert res.data["success"] is True
        assert res.data["message"] == "Profile updated successfully"
        assert res.data["user"]["username"] == "updated_user"
        assert res.data["user"]["profile"]["name"] == "Jane Doe"
        assert res.data["user"]["profile"]["bio"] == "Software Engineer & Competitive Programmer"

        user.refresh_from_db()
        assert user.username == "updated_user"
        assert user.profile_name == "Jane Doe"

    def test_update_profile_empty_name_or_username(self, user):
        client = auth_client_for_user(user)
        url = reverse("user-update")
        res = client.put(url, {"username": "", "name": "Jane"}, format="json")
        assert res.status_code == 400
        assert res.data["success"] is False

        res2 = client.put(url, {"username": "valid_user", "name": ""}, format="json")
        assert res2.status_code == 400
        assert res2.data["success"] is False

    def test_update_profile_duplicate_username(self, user, other_user):
        client = auth_client_for_user(user)
        url = reverse("user-update")
        res = client.put(url, {"username": "other_user", "name": "Valid Name"}, format="json")
        assert res.status_code == 400
        assert res.data["success"] is False
        assert "already taken" in res.data["message"]

    def test_upload_and_get_avatar(self, user):
        client = auth_client_for_user(user)

        # Before upload, GET avatar returns 404
        get_url = reverse("user-get-avatar")
        res_empty = client.get(get_url)
        assert res_empty.status_code == 404

        # Upload avatar
        upload_url = reverse("user-upload-avatar")
        avatar_file = generate_test_image()
        res_upload = client.post(upload_url, {"avatar": avatar_file}, format="multipart")
        assert res_upload.status_code == 200
        assert res_upload.data["message"] == "Avatar uploaded successfully."

        user.refresh_from_db()
        assert user.profile_avatar is not None

        # GET avatar returns the image file stream
        res_get = client.get(get_url)
        assert res_get.status_code == 200
        assert "image" in res_get["Content-Type"]

    def test_remove_avatar(self, user):
        client = auth_client_for_user(user)

        # Upload avatar first
        upload_url = reverse("user-upload-avatar")
        client.post(upload_url, {"avatar": generate_test_image()}, format="multipart")

        user.refresh_from_db()
        assert user.profile_avatar is not None

        # Remove avatar
        remove_url = reverse("user-remove-avatar")
        res = client.delete(remove_url)
        assert res.status_code == 200
        assert res.data["message"] == "Avatar removed successfully."

        user.refresh_from_db()
        assert not user.profile_avatar

        # GET avatar after delete returns 404
        get_url = reverse("user-get-avatar")
        res_get = client.get(get_url)
        assert res_get.status_code == 404
