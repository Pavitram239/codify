from django.urls import path
from apps.submissions.views import (
    AllSubmissionsForProblemView,
    AllSubmissionsForUserView,
    SubmissionDetailView,
    UserSubmissionsForProblemView,
)

urlpatterns = [
    # Problem-wide submissions for faculty/admin
    path("problem", AllSubmissionsForProblemView.as_view(), name="submissions-for-problem"),
    path("problem/", AllSubmissionsForProblemView.as_view(), name="submissions-for-problem-slash"),

    # Authenticated user submission history (paginated)
    path("user/submissions", AllSubmissionsForUserView.as_view(), name="submissions-user-history"),
    path("user/submissions/", AllSubmissionsForUserView.as_view(), name="submissions-user-history-slash"),

    # Authenticated user submissions for a specific problem query (?problem_id=...)
    path("", UserSubmissionsForProblemView.as_view(), name="submissions-user-problem"),

    # Submission detail by UUID
    path("<uuid:id>", SubmissionDetailView.as_view(), name="submissions-detail"),
    path("<uuid:id>/", SubmissionDetailView.as_view(), name="submissions-detail-slash"),
]
