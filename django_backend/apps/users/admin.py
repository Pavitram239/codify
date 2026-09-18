from django.contrib import admin
from apps.users.models import User

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("username", "role", "email", "is_approved", "first_time_login", "created_at")
    list_filter = ("role", "is_approved", "branch", "semester")
    search_fields = ("username", "email", "student_id")
