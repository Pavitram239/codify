import pytest
from rest_framework.test import APIClient
from apps.users.models import User, AccessRole, AccessPermission, AccessAudit
from apps.problems.models import Problem

pytestmark = pytest.mark.django_db


def client(user):
    api = APIClient()
    api.force_authenticate(user)
    return api


def grant(user, *codes):
    user.direct_permissions.add(*AccessPermission.objects.filter(code__in=codes))


@pytest.fixture
def actors():
    admin = User.objects.create_user(username="access-admin", role="admin", is_approved=True)
    user = User.objects.create_user(username="access-user", role="student", is_approved=True)
    user.access_roles.clear()
    other = User.objects.create_user(username="access-other", role="faculty", is_approved=True)
    return admin, user, other


def test_union_and_duplicate_grant_removal(actors):
    _, user, _ = actors
    first = AccessRole.objects.create(name="Reviewer")
    second = AccessRole.objects.create(name="Author")
    permission = AccessPermission.objects.get(code="problems.create")
    first.permissions.add(permission)
    second.permissions.add(AccessPermission.objects.get(code="contests.create"))
    user.access_roles.add(first, second)
    user.direct_permissions.add(permission)
    assert user.can("problems.create") and user.can("contests.create")
    user.direct_permissions.clear()
    assert user.can("problems.create")
    first.permissions.clear()
    assert not user.can("problems.create")
    assert user.can("contests.create")


def test_account_type_alone_does_not_grant_access(actors):
    admin, _, _ = actors
    admin.access_roles.clear()
    assert client(admin).get("/api/v1/access/roles").status_code == 403
    assert client(admin).get("/api/v1/admin/get-pending-users").status_code == 403


def test_direct_grant_enforced_and_revoked_without_relogin(actors):
    _, user, _ = actors
    api = client(user)
    assert api.get("/api/v1/problems/").status_code == 403
    grant(user, "problems.view_all")
    assert api.get("/api/v1/problems/").status_code == 200
    user.direct_permissions.clear()
    assert api.get("/api/v1/problems/").status_code == 403


def test_custom_role_can_create_without_faculty_type(actors):
    _, user, _ = actors
    role = AccessRole.objects.create(name="Problem Author")
    role.permissions.add(AccessPermission.objects.get(code="problems.create"))
    user.access_roles.add(role)
    result = client(user).post("/api/v1/problems/", {"title": "Dynamic problem", "description": "Solve it", "difficulty": "easy"}, format="json")
    assert result.status_code == 201, result.data
    assert Problem.objects.get(title="Dynamic problem").created_by == user


def test_action_and_object_scope_are_independent(actors):
    _, user, other = actors
    own = Problem.objects.create(title="Own", description="Own", created_by=user)
    foreign = Problem.objects.create(title="Foreign", description="Foreign", created_by=other)
    grant(user, "problems.edit_own")
    api = client(user)
    assert api.put(f"/api/v1/problems/{own.pk}", {"title": "Updated"}, format="json").status_code == 200
    assert api.put(f"/api/v1/problems/{foreign.pk}", {"title": "Stolen"}, format="json").status_code == 403
    assert api.delete(f"/api/v1/problems/{own.pk}").status_code == 403
    grant(user, "problems.edit_all")
    assert api.put(f"/api/v1/problems/{foreign.pk}", {"title": "Allowed"}, format="json").status_code == 200


def test_assigned_list_and_detail_do_not_leak(actors):
    _, user, other = actors
    assigned = Problem.objects.create(title="Assigned", description="A", created_by=other)
    foreign = Problem.objects.create(title="Private", description="B", created_by=other)
    assigned.assigned_students.add(user)
    grant(user, "problems.view_assigned")
    api = client(user)
    assert [p["title"] for p in api.get("/api/v1/problems/").data["problems"]] == ["Assigned"]
    assert api.get(f"/api/v1/problems/{foreign.pk}").status_code == 403


def test_access_management_and_audit(actors):
    admin, user, _ = actors
    api = client(admin)
    result = api.post("/api/v1/access/roles", {"name": "Contest helper", "permissions": ["contests.create"]}, format="json")
    assert result.status_code == 201
    role_id = result.data["id"]
    result = api.put(f"/api/v1/access/users/{user.pk}", {"roles": [role_id], "permissions": ["problems.create"]}, format="json")
    assert result.status_code == 200
    assert set(result.data["effectivePermissions"]) == {"contests.create", "problems.create"}
    assert result.data["sources"]["problems.create"] == ["Direct grant"]
    assert AccessAudit.objects.count() == 2
    assert api.get("/api/v1/access/audit").status_code == 200


@pytest.mark.parametrize("path", ["roles", "permissions", "users", "audit"])
def test_access_management_denied_without_permission(actors, path):
    _, user, _ = actors
    assert client(user).get(f"/api/v1/access/{path}").status_code == 403


def test_last_manager_cannot_remove_own_access(actors):
    admin, _, _ = actors
    result = client(admin).put(f"/api/v1/access/users/{admin.pk}", {"roles": [], "permissions": []}, format="json")
    assert result.status_code == 400
    assert admin.can("access.manage")
    assert AccessAudit.objects.count() == 0


def test_last_manager_role_cannot_lose_management(actors):
    admin, _, _ = actors
    role = admin.access_roles.get()
    result = client(admin).put(f"/api/v1/access/roles/{role.pk}", {"name": role.name, "permissions": []}, format="json")
    assert result.status_code == 400
    assert admin.can("access.manage")


def test_invalid_grants_are_atomic(actors):
    admin, user, _ = actors
    grant(user, "problems.create")
    result = client(admin).put(f"/api/v1/access/users/{user.pk}", {"roles": [], "permissions": ["invented.permission"]}, format="json")
    assert result.status_code == 400
    assert user.can("problems.create")


def test_new_accounts_receive_configured_default_role(actors):
    _, _, _ = actors
    role = AccessRole.objects.get(default_account_type="student")
    role.permissions.clear()
    role.permissions.add(AccessPermission.objects.get(code="contests.create"))
    user = User.objects.create_user(username="new-student", role="student")
    assert user.effective_permissions() == {"contests.create"}


def test_profile_cannot_change_grants(actors):
    _, user, _ = actors
    result = client(user).put("/api/v1/user/update", {"permissions": ["access.manage"], "access_roles": [1], "role": "admin"}, format="json")
    user.refresh_from_db()
    assert not user.can("access.manage")
    assert user.role == "student"


def test_inactive_user_has_no_effective_access(actors):
    admin, _, _ = actors
    admin.is_active = False
    admin.save(update_fields=["is_active"])
    assert not admin.effective_permissions()
    assert client(admin).get("/api/v1/problems/").status_code == 403


def test_contest_assignment_does_not_require_edit_permission(actors):
    from django.utils import timezone
    from datetime import timedelta
    from apps.contests.models import Contest
    _, user, other = actors
    contest = Contest.objects.create(name="Assignment", description="A", created_by=user,
        start_time=timezone.now(), end_time=timezone.now()+timedelta(hours=1))
    student = User.objects.create_user(username="participant", role="student")
    grant(user, "contests.assign_shared")
    result = client(user).post(f"/api/v1/contests/{contest.pk}/assignContestToStudents", {"studentIds": [str(student.pk)]}, format="json")
    assert result.status_code == 200, result.data
    assert contest.assigned_students.filter(pk=student.pk).exists()
    assert client(user).put(f"/api/v1/contests/{contest.pk}", {"name": "No edit"}, format="json").status_code == 403


def test_execution_permission_does_not_bypass_problem_access(actors):
    _, user, other = actors
    problem = Problem.objects.create(title="Unassigned", description="A", created_by=other)
    grant(user, "execution.run")
    result = client(user).post("/api/v1/compiler/run-code", {"problemId": str(problem.pk), "language": "python", "code": "print(1)"}, format="json")
    assert result.status_code == 403


def test_last_manager_cannot_be_deleted(actors):
    from rest_framework.exceptions import PermissionDenied
    admin, _, _ = actors
    from django.db import transaction
    with pytest.raises(PermissionDenied), transaction.atomic():
        admin.delete()
    assert User.objects.filter(pk=admin.pk).exists()


def test_catalog_matches_migration():
    from apps.users.access_catalog import CATALOG
    assert set(AccessPermission.objects.values_list("code", flat=True)) == set(CATALOG)


def test_create_user_with_roles_and_direct_permissions(actors):
    admin, _, _ = actors
    role = AccessRole.objects.create(name="Teaching Assistant")
    role.permissions.add(AccessPermission.objects.get(code="problems.create"))
    response = client(admin).post("/api/v1/access/users", {
        "username": "new.author", "fullName": "New Author", "email": "author@example.edu",
        "accountType": "faculty", "roles": [role.pk], "permissions": ["contests.create"],
    }, format="json")
    assert response.status_code == 201, response.data
    created = User.objects.get(username="new.author")
    assert created.profile_name == "New Author"
    assert created.effective_permissions() == {"problems.create", "contests.create"}
    credentials = response.data["temporaryPasswords"]
    assert len(credentials) == 1 and created.check_password(credentials[0]["temporaryPassword"])
    assert created.first_time_login and created.is_approved
    assert response["Cache-Control"] == "no-store"
    assert "temporaryPassword" not in str(AccessAudit.objects.get(action="user.create").after)


def test_create_user_without_explicit_roles_uses_onboarding_default(actors):
    admin, _, _ = actors
    response = client(admin).post("/api/v1/access/users", {"username": "default.author", "accountType": "faculty"}, format="json")
    assert response.status_code == 201
    assert User.objects.get(username="default.author").access_roles.get().default_account_type == "faculty"


def test_explicit_empty_roles_create_user_without_grants(actors):
    admin, _, _ = actors
    response = client(admin).post("/api/v1/access/users", {"username": "no.access", "roles": [], "permissions": []}, format="json")
    assert response.status_code == 201
    assert not User.objects.get(username="no.access").effective_permissions()


@pytest.mark.parametrize("payload", [
    {"username": "ACCESS-ADMIN"}, {"username": "different", "email": "taken@example.edu"},
    {"username": "different", "roles": [99999]}, {"username": "different", "permissions": ["not.real"]},
])
def test_invalid_user_creation_is_atomic(actors, payload):
    admin, _, _ = actors
    admin.email = "taken@example.edu"
    admin.save(update_fields=["email"])
    before = User.objects.count()
    response = client(admin).post("/api/v1/access/users", payload, format="json")
    assert response.status_code == 400
    assert User.objects.count() == before
    assert not AccessAudit.objects.filter(action="user.create").exists()


def test_edit_user_details_preserves_access_grants(actors):
    admin, user, _ = actors
    grant(user, "problems.create")
    response = client(admin).patch(f"/api/v1/access/users/{user.pk}", {
        "fullName": "Updated Name", "mobileNo": "1234567890", "permissions": ["access.manage"], "roles": [],
    }, format="json")
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.profile_name == "Updated Name"
    assert user.mobile_no == "1234567890"
    assert user.effective_permissions() == {"problems.create"}


@pytest.mark.parametrize("field", ["isActive", "isApproved"])
def test_last_manager_cannot_be_disabled(actors, field):
    admin, _, _ = actors
    response = client(admin).patch(f"/api/v1/access/users/{admin.pk}", {field: False}, format="json")
    assert response.status_code == 400
    admin.refresh_from_db()
    assert admin.is_active and admin.is_approved


def test_managed_user_deletion_is_audited(actors):
    admin, user, _ = actors
    identifier = user.pk
    response = client(admin).delete(f"/api/v1/access/users/{identifier}")
    assert response.status_code == 204
    assert not User.objects.filter(pk=identifier).exists()
    assert AccessAudit.objects.filter(action="user.delete", target=str(identifier)).exists()


def test_access_manager_needs_identity_permissions(actors):
    _, user, _ = actors
    grant(user, "access.manage")
    api = client(user)
    assert api.get("/api/v1/access/users").status_code == 200
    assert api.post("/api/v1/access/users", {"username": "denied"}, format="json").status_code == 403
    assert api.patch(f"/api/v1/access/users/{user.pk}", {"fullName": "Denied"}, format="json").status_code == 403
    assert api.delete(f"/api/v1/access/users/{user.pk}").status_code == 403


def test_user_search_and_filters(actors):
    admin, user, other = actors
    other.profile_name = "Searchable Teacher"
    other.save(update_fields=["profile_name"])
    user.is_active = False
    user.save(update_fields=["is_active"])
    api = client(admin)
    result = api.get("/api/v1/access/users", {"search": "Searchable"})
    assert result.data["count"] == 1
    assert result.data["results"][0]["id"] == str(other.pk)
    result = api.get("/api/v1/access/users", {"status": "inactive"})
    assert result.data["count"] == 1
    role = other.access_roles.get()
    result = api.get("/api/v1/access/users", {"role": role.pk})
    assert result.data["count"] == 1
    role_result = api.get("/api/v1/access/roles")
    assert next(r for r in role_result.data if r["id"] == role.pk)["userCount"] == 1


def test_unapproval_invalidates_existing_token(actors):
    from rest_framework_simplejwt.tokens import RefreshToken
    admin, _, teacher = actors
    token = str(RefreshToken.for_user(teacher).access_token)
    response = client(admin).patch(f"/api/v1/access/users/{teacher.pk}", {"isApproved": False}, format="json")
    assert response.status_code == 200
    api = APIClient()
    api.credentials(HTTP_AUTHORIZATION="Bearer " + token)
    assert api.get("/api/v1/problems/").status_code == 401
