"""Disposable UI fixtures in the audit SQLite database, never the running app DB."""
from apps.users.models import User, AccessRole
teacher = User.objects.get(username="audit.faculty")
teacher.direct_permissions.clear()
teacher.access_roles.set(AccessRole.objects.filter(default_account_type="faculty"))
admin = User.objects.get(username="audit.admin")
for name, role, mentor in [("nav.pendingfaculty", "faculty", None), ("nav.pendingstudent", "student", admin), ("nav.teacherstudent", "student", teacher)]:
    User.objects.get_or_create(username=name, defaults={"role": role, "email": name + "@example.test", "is_approved": False, "faculty": mentor, "student_id": name if role == "student" else None})
print("Disposable sidebar preview ready")
