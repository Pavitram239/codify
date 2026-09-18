import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.code_drafts.models import CodeDraft
from apps.problems.models import Problem
from apps.users.models import User


def auth_client_for_user(user):
    client = APIClient()
    user.session_id = f"test-session-drafts-{user.id}"
    user.save()
    refresh = RefreshToken.for_user(user)
    refresh["id"] = str(user.id)
    refresh["sessionId"] = user.session_id
    token = str(refresh.access_token)
    client.cookies["token"] = token
    return client


@pytest.fixture
def user(db):
    u = User(username="coder_sam", email="sam@example.com", role="student", is_approved=True, first_time_login=False)
    u.set_password("pass123")
    u.save()
    return u


@pytest.fixture
def problem(db, user):
    return Problem.objects.create(
        title="Sum of Two",
        description="Add two ints",
        difficulty="easy",
        input_format="a b",
        output_format="sum",
        total_marks=10,
        created_by=user,
    )


@pytest.mark.django_db
class TestCodeDraftsAPI:

    def test_save_and_get_code_draft(self, user, problem):
        client = auth_client_for_user(user)

        # Before saving, get returns 200 with empty code dict
        get_url = reverse("code-draft-get")
        res_empty = client.get(get_url, {"problemId": str(problem.id)})
        assert res_empty.status_code == 200
        assert res_empty.data.get("code") == {}

        # Save code draft
        save_url = reverse("code-draft-save")
        payload = {
            "problemId": str(problem.id),
            "codeByLanguage": {
                "python": "print('hello python')",
                "cpp": "#include <iostream>\nint main(){ return 0; }",
                "java": "public class Solution {}",
            },
        }
        res_save = client.post(save_url, payload, format="json")
        assert res_save.status_code == 200
        assert res_save.data["success"] is True

        # Verify in DB
        draft = CodeDraft.objects.get(user=user, problem=problem)
        assert draft.code_by_language["python"] == "print('hello python')"

        # Fetch code draft
        res_get = client.get(get_url, {"problemId": str(problem.id)})
        assert res_get.status_code == 200
        assert res_get.data["success"] is True
        assert res_get.data["code"]["python"] == "print('hello python')"

    def test_update_existing_code_draft(self, user, problem):
        client = auth_client_for_user(user)
        save_url = reverse("code-draft-save")

        # Initial save
        client.post(save_url, {"problemId": str(problem.id), "codeByLanguage": {"python": "v1"}}, format="json")

        # Update save
        res2 = client.post(save_url, {"problemId": str(problem.id), "codeByLanguage": {"python": "v2"}}, format="json")
        assert res2.status_code == 200

        # Only 1 draft record should exist
        assert CodeDraft.objects.filter(user=user, problem=problem).count() == 1
        draft = CodeDraft.objects.get(user=user, problem=problem)
        assert draft.code_by_language["python"] == "v2"
