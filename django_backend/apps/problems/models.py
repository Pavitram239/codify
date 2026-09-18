import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class Problem(models.Model):
    DIFFICULTY_CHOICES = [
        ("easy", "Easy"),
        ("medium", "Medium"),
        ("hard", "Hard"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=500)
    description = models.TextField()
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default="easy")
    input_format = models.TextField()
    output_format = models.TextField()
    constraints = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_problems",
    )
    total_marks = models.PositiveIntegerField(default=0)
    tags = models.JSONField(default=list, blank=True)
    assigned_students = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="assigned_problems",
        blank=True,
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "problems"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.difficulty})"


class SampleIO(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    problem = models.ForeignKey(
        Problem,
        on_delete=models.CASCADE,
        related_name="sample_io",
    )
    input = models.TextField()
    output = models.TextField()
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "sample_ios"
        ordering = ["order"]

    def __str__(self):
        return f"SampleIO for {self.problem.title} (#{self.order})"


class TestCase(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    problem = models.ForeignKey(
        Problem,
        on_delete=models.CASCADE,
        related_name="test_cases",
    )
    inputs = models.TextField()
    outputs = models.TextField()
    marks = models.PositiveIntegerField(default=0)
    cpu_time_limit = models.FloatField(default=1.0)  # seconds (1 - 15)
    memory_limit = models.PositiveIntegerField(default=128)  # MB (1 - 256)
    is_hidden = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "test_cases"
        ordering = ["order"]

    def __str__(self):
        hidden_str = "Hidden" if self.is_hidden else "Visible"
        return f"TestCase for {self.problem.title} ({hidden_str}, {self.marks} marks)"
