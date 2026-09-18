from django.urls import path
from apps.code_drafts.views import GetCodeDraftView, SaveCodeDraftView

urlpatterns = [
    path("saveCode", SaveCodeDraftView.as_view(), name="code-draft-save"),
    path("getCode", GetCodeDraftView.as_view(), name="code-draft-get"),
]
