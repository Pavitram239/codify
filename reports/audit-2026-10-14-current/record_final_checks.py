"""Audit-only checks against the disposable browser database."""
import json
from pathlib import Path
from django.urls import reverse
from rest_framework.test import APIClient
from apps.users.models import User

faculty = User.objects.get(username="audit.faculty")
assert faculty.effective_permissions() == {"users.view_assigned", "users.create_assigned"}
client = APIClient()
client.force_authenticate(faculty)
student = User.objects.get(username="audit.student")
response = client.delete(reverse("faculty-remove-user", kwargs={"userId": str(student.pk)}))
assert response.status_code == 403
result = {
    "permissions": sorted(faculty.effective_permissions()),
    "ui_delete_enabled": True,
    "delete_http": response.status_code,
    "student_still_exists": User.objects.filter(pk=student.pk).exists(),
    "meaning": "UI offers forbidden action; backend rejects it. No unauthorized deletion demonstrated.",
}
Path("../reports/audit-2026-10-14-current/evidence/granular-action-check.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result))
