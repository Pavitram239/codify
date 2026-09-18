from django.urls import path
from apps.contests.views import (
    AssignContestToStudentsView,
    ContestDashboardView,
    ContestDetailView,
    ContestListCreateView,
    GetAssignedStudentsView,
    GetUnassignedStudentsView,
    UnassignContestToStudentsView,
)

urlpatterns = [
    path("create", ContestListCreateView.as_view(), name="contest-create"),
    path("create/", ContestListCreateView.as_view(), name="contest-create-slash"),
    path("", ContestListCreateView.as_view(), name="contest-list-create"),
    path("<uuid:pk>", ContestDetailView.as_view(), name="contest-detail"),
    path("<uuid:pk>/", ContestDetailView.as_view(), name="contest-detail-slash"),
    path("<uuid:pk>/assignContestToStudents", AssignContestToStudentsView.as_view(), name="contest-assign-students"),
    path("<uuid:pk>/assignContestToStudents/", AssignContestToStudentsView.as_view(), name="contest-assign-students-slash"),
    path("<uuid:pk>/getAssignedStudents", GetAssignedStudentsView.as_view(), name="contest-get-assigned-students"),
    path("<uuid:pk>/getAssignedStudents/", GetAssignedStudentsView.as_view(), name="contest-get-assigned-students-slash"),
    path("<uuid:pk>/unassignedStudents", GetUnassignedStudentsView.as_view(), name="contest-get-unassigned-students"),
    path("<uuid:pk>/unassignedStudents/", GetUnassignedStudentsView.as_view(), name="contest-get-unassigned-students-slash"),
    path("<uuid:pk>/unassignContestToStudents", UnassignContestToStudentsView.as_view(), name="contest-unassign-students"),
    path("<uuid:pk>/unassignContestToStudents/", UnassignContestToStudentsView.as_view(), name="contest-unassign-students-slash"),
    path("<uuid:pk>/dashboard", ContestDashboardView.as_view(), name="contest-dashboard"),
    path("<uuid:pk>/dashboard/", ContestDashboardView.as_view(), name="contest-dashboard-slash"),
]
