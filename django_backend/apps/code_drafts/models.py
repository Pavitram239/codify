import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


def default_code_by_language():
    return {
        "java": "",
        "python": "",
        "cpp": "",
    }


class CodeDraft(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="code_drafts",
    )
    problem = models.ForeignKey(
        "problems.Problem",
        on_delete=models.CASCADE,
        related_name="code_drafts",
    )
    code_by_language = models.JSONField(default=default_code_by_language, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "code_drafts"
        constraints = [
            models.UniqueConstraint(fields=["user", "problem"], name="unique_user_problem_draft")
        ]

    def __str__(self):
        return f"CodeDraft for {self.user.username} on {self.problem.title}"
