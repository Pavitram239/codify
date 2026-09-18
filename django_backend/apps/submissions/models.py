import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class Submission(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("completed", "Completed"),
        ("rejected", "Rejected"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    problem = models.ForeignKey(
        "problems.Problem",
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    code = models.TextField()
    language = models.CharField(max_length=50)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default="pending")
    execution_time = models.FloatField(default=0.0)  # ms
    memory_usage = models.FloatField(default=0.0)  # MB
    number_of_test_cases = models.PositiveIntegerField(default=0)
    number_of_test_cases_pass = models.PositiveIntegerField(default=0)
    total_marks = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "submissions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "problem"]),
            models.Index(fields=["problem", "status"]),
        ]

    def __str__(self):
        return f"Submission by {self.user.username} on {self.problem.title} ({self.status})"


class TestCaseResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(
        Submission,
        on_delete=models.CASCADE,
        related_name="test_case_results",
    )
    input = models.TextField()
    output = models.TextField(null=True, blank=True)
    expected_output = models.TextField()
    passed = models.BooleanField(default=False)
    time = models.FloatField(default=0.0)
    memory = models.FloatField(default=0.0)
    is_hidden = models.BooleanField(default=False)
    marks = models.PositiveIntegerField(default=0)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "test_case_results"
        ordering = ["order"]

    def __str__(self):
        status = "Passed" if self.passed else "Failed"
        return f"TestCaseResult for {self.submission.id} (#{self.order}: {status})"
