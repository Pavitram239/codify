from django.urls import path
from apps.problems.views import (
    AIProblemGenerateView,
    AllStudentsStatsView,
    AssignedStudentsView,
    AssignStudentsView,
    ProblemDetailUpdateDeleteView,
    ProblemForUpdateView,
    ProblemListCreateView,
    UnassignedStudentsView,
    UnassignStudentsView,
)

urlpatterns = [
    # AI Generation
    path("ai-generate", AIProblemGenerateView.as_view(), name="problems-ai-generate"),
    path("ai-generate/", AIProblemGenerateView.as_view(), name="problems-ai-generate-slash"),
    # Stats & Aggregate
    path("getStudents", AllStudentsStatsView.as_view(), name="problems-get-students"),
    path("getStudents/", AllStudentsStatsView.as_view(), name="problems-get-students-slash"),
    path("getProblemByIdForUpdate/<uuid:id>", ProblemForUpdateView.as_view(), name="problems-for-update"),
    path("getProblemByIdForUpdate/<uuid:id>/", ProblemForUpdateView.as_view(), name="problems-for-update-slash"),

    # Assignment routes
    path("<uuid:id>/assign", AssignStudentsView.as_view(), name="problems-assign"),
    path("<uuid:id>/assign/", AssignStudentsView.as_view(), name="problems-assign-slash"),
    path("<uuid:id>/unassign-students", UnassignStudentsView.as_view(), name="problems-unassign"),
    path("<uuid:id>/unassign-students/", UnassignStudentsView.as_view(), name="problems-unassign-slash"),
    path("<uuid:id>/students", AssignedStudentsView.as_view(), name="problems-assigned-students"),
    path("<uuid:id>/students/", AssignedStudentsView.as_view(), name="problems-assigned-students-slash"),
    path("<uuid:id>/unassignStudent", UnassignedStudentsView.as_view(), name="problems-unassigned-students"),
    path("<uuid:id>/unassignStudent/", UnassignedStudentsView.as_view(), name="problems-unassigned-students-slash"),

    # List & Create
    path("", ProblemListCreateView.as_view(), name="problems-list-create"),

    # Detail, Update & Delete
    path("<uuid:id>", ProblemDetailUpdateDeleteView.as_view(), name="problems-detail-update-delete"),
    path("<uuid:id>/", ProblemDetailUpdateDeleteView.as_view(), name="problems-detail-update-delete-slash"),
]
