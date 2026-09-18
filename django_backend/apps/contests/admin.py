from django.contrib import admin
from apps.contests.models import Contest


@admin.register(Contest)
class ContestAdmin(admin.ModelAdmin):
    list_display = ("name", "created_by", "start_time", "end_time", "status", "computed_status_display")
    list_filter = ("status", "start_time")
    search_fields = ("name", "description")
    filter_horizontal = ("assigned_students", "problems")

    @admin.display(description="Computed Status")
    def computed_status_display(self, obj):
        return obj.computed_status
