import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class Contest(models.Model):
    STATUS_CHOICES = [
        ("upcoming", "Upcoming"),
        ("ongoing", "Ongoing"),
        ("completed", "Completed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=500)
    description = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_contests",
    )
    assigned_students = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="assigned_contests",
        blank=True,
    )
    problems = models.ManyToManyField(
        "problems.Problem",
        related_name="contests",
        blank=True,
    )
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="upcoming")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "contests"
        ordering = ["-start_time"]

    def __str__(self):
        return f"{self.name} ({self.computed_status})"

    @property
    def computed_status(self):
        now = timezone.now()
        if now < self.start_time:
            return "upcoming"
        elif self.start_time <= now <= self.end_time:
            return "ongoing"
        else:
            return "completed"
