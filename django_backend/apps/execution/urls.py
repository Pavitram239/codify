from django.urls import path
from apps.execution.views import QueueStatusView, RunCodeView

urlpatterns = [
    path("run-code", RunCodeView.as_view(), name="compiler-run-code"),
    path("run-code/", RunCodeView.as_view(), name="compiler-run-code-slash"),
    path("queue-status", QueueStatusView.as_view(), name="compiler-queue-status"),
    path("queue-status/", QueueStatusView.as_view(), name="compiler-queue-status-slash"),
]
