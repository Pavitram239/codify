from django.contrib import admin
from apps.problems.models import Problem, SampleIO, TestCase


class SampleIOInline(admin.TabularInline):
    model = SampleIO
    extra = 1


class TestCaseInline(admin.TabularInline):
    model = TestCase
    extra = 1


@admin.register(Problem)
class ProblemAdmin(admin.ModelAdmin):
    list_display = ("title", "difficulty", "total_marks", "created_by", "created_at")
    list_filter = ("difficulty", "created_at")
    search_fields = ("title", "description")
    inlines = [SampleIOInline, TestCaseInline]
    filter_horizontal = ("assigned_students",)


@admin.register(SampleIO)
class SampleIOAdmin(admin.ModelAdmin):
    list_display = ("problem", "order")


@admin.register(TestCase)
class TestCaseAdmin(admin.ModelAdmin):
    list_display = ("problem", "marks", "is_hidden", "cpu_time_limit", "memory_limit", "order")
    list_filter = ("is_hidden",)
