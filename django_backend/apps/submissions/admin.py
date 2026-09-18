from django.contrib import admin
from apps.submissions.models import Submission, TestCaseResult


class TestCaseResultInline(admin.TabularInline):
    model = TestCaseResult
    extra = 0
    readonly_fields = ("input", "output", "expected_output", "passed", "time", "memory", "is_hidden", "marks", "order")


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ("user", "problem", "language", "status", "total_marks", "execution_time", "memory_usage", "created_at")
    list_filter = ("status", "language", "created_at")
    search_fields = ("user__username", "problem__title")
    inlines = [TestCaseResultInline]


@admin.register(TestCaseResult)
class TestCaseResultAdmin(admin.ModelAdmin):
    list_display = ("submission", "order", "passed", "marks", "time", "memory", "is_hidden")
    list_filter = ("passed", "is_hidden")
