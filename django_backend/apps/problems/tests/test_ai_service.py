import json
from unittest.mock import MagicMock, patch
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.problems.services.ai_service import AIService, AIServiceError
from apps.users.models import User


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
        username="faculty_ai_tester",
        email="faculty_ai@charusat.edu.in",
        role="faculty",
        subject="Data Structures",
        is_approved=True,
        first_time_login=False,
    )
    user.set_password("pass123")
    user.save()
    return user


@pytest.fixture
def student_user(db):
    user = User(
        username="student_ai_tester",
        student_id="22it999",
        email="22it999@charusat.edu.in",
        role="student",
        branch="cspit-it",
        semester=4,
        batch="a2",
        is_approved=True,
        first_time_login=False,
    )
    user.set_password("pass123")
    user.save()
    return user


MOCK_GEMINI_RESPONSE = {
    "candidates": [
        {
            "content": {
                "parts": [
                    {
                        "text": json.dumps({
                            "title": "Subarray Sum Equals K",
                            "description": "Given an array of integers `nums` and an integer `k`, return the total number of subarrays whose sum equals to `k`.",
                            "difficulty": "easy",
                            "inputFormat": "Line 1: N and K\nLine 2: N space-separated integers",
                            "outputFormat": "Single integer representing count of subarrays",
                            "constraints": "1 <= N <= 10^5\n-1000 <= nums[i] <= 1000",
                            "tags": ["Array", "Hash Map", "Prefix Sum"],
                            "sampleIO": [
                                {"input": "3 2\n1 1 1", "output": "2"},
                                {"input": "3 3\n1 2 3", "output": "2"}
                            ],
                            "testCases": [
                                {
                                    "inputs": "3 2\n1 1 1",
                                    "outputs": "2",
                                    "marks": 10,
                                    "cpu_time_limit": 1.0,
                                    "memory_limit": 128,
                                    "is_hidden": False
                                },
                                {
                                    "inputs": "1 0\n0",
                                    "outputs": "1",
                                    "marks": 10,
                                    "cpu_time_limit": 1.0,
                                    "memory_limit": 128,
                                    "is_hidden": True
                                }
                            ]
                        })
                    }
                ]
            }
        }
    ]
}


@pytest.mark.django_db
def test_ai_generate_permission_student_denied(student_user):
    client = auth_client_for_user(student_user)
    url = reverse("problems-ai-generate")
    response = client.post(url, {"topic": "Array", "difficulty": "easy"}, format="json")
    assert response.status_code == 403


@pytest.mark.django_db
def test_ai_generate_unauthenticated_denied():
    client = APIClient()
    url = reverse("problems-ai-generate")
    response = client.post(url, {"topic": "Array", "difficulty": "easy"}, format="json")
    assert response.status_code == 401


@pytest.mark.django_db
def test_ai_generate_missing_topic(faculty_user):
    client = auth_client_for_user(faculty_user)
    url = reverse("problems-ai-generate")
    response = client.post(url, {"mode": "generate", "topic": ""}, format="json")
    assert response.status_code == 400
    assert "topic is required" in response.data.get("message", "")


@pytest.mark.django_db
def test_ai_convert_missing_raw_text(faculty_user):
    client = auth_client_for_user(faculty_user)
    url = reverse("problems-ai-generate")
    response = client.post(url, {"mode": "convert", "rawText": ""}, format="json")
    assert response.status_code == 400
    assert "rawText is required" in response.data.get("message", "")


@pytest.mark.django_db
@patch("apps.problems.services.ai_service.requests.post")
def test_ai_generate_success(mock_post, faculty_user, settings):
    settings.GEMINI_API_KEY = "dummy-test-key"
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = MOCK_GEMINI_RESPONSE
    mock_post.return_value = mock_response

    client = auth_client_for_user(faculty_user)
    url = reverse("problems-ai-generate")
    response = client.post(
        url,
        {"mode": "generate", "topic": "Array", "difficulty": "easy", "prompt": "Focus on prefix sum"},
        format="json"
    )

    assert response.status_code == 200
    assert response.data["success"] is True
    data = response.data["data"]
    assert data["title"] == "Subarray Sum Equals K"
    assert data["difficulty"] == "easy"
    assert len(data["sampleIO"]) == 2
    assert len(data["testCases"]) == 2
    assert data["totalMarks"] == 20


@pytest.mark.django_db
@patch("apps.problems.services.ai_service.requests.post")
def test_ai_convert_success(mock_post, faculty_user, settings):
    settings.GEMINI_API_KEY = "dummy-test-key"
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = MOCK_GEMINI_RESPONSE
    mock_post.return_value = mock_response

    client = auth_client_for_user(faculty_user)
    url = reverse("problems-ai-generate")
    response = client.post(
        url,
        {"mode": "convert", "rawText": "Given an array of integers nums and an integer k...", "difficulty": "easy"},
        format="json"
    )

    assert response.status_code == 200
    assert response.data["success"] is True
    assert response.data["data"]["title"] == "Subarray Sum Equals K"


@pytest.mark.django_db
def test_ai_generate_missing_api_key(faculty_user, settings):
    settings.GEMINI_API_KEY = ""
    client = auth_client_for_user(faculty_user)
    url = reverse("problems-ai-generate")
    response = client.post(url, {"mode": "generate", "topic": "Array"}, format="json")
    assert response.status_code == 400
    assert "GEMINI_API_KEY is not configured" in response.data.get("message", "")
