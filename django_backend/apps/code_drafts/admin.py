from django.contrib import admin
from apps.code_drafts.models import CodeDraft


@admin.register(CodeDraft)
class CodeDraftAdmin(admin.ModelAdmin):
    list_display = ("user", "problem", "updated_at")
    search_fields = ("user__username", "problem__title")
