from django.urls import path
from apps.users.views_onboarding import IssueInitialPasswordView
from apps.users.views_faculty import (
    FacultyAcceptAllRequestsView,
    FacultyAcceptRequestView,
    FacultyBulkRegisterView,
    FacultyDeclineAllRequestsView,
    FacultyDeclineRequestView,
    FacultyExpireSessionView,
    FacultyGetStudentsView,
    FacultyPendingUsersView,
    FacultyRemoveUserView,
)

urlpatterns = [
    path("issue-initial-password", IssueInitialPasswordView.as_view(), name="faculty-issue-initial-password"),
    path("get-pending-users", FacultyPendingUsersView.as_view(), name="faculty-get-pending-users"),
    path("accept-request", FacultyAcceptRequestView.as_view(), name="faculty-accept-request"),
    path("accept-all-requests", FacultyAcceptAllRequestsView.as_view(), name="faculty-accept-all-requests"),
    path("decline-request", FacultyDeclineRequestView.as_view(), name="faculty-decline-request"),
    path("decline-all-requests", FacultyDeclineAllRequestsView.as_view(), name="faculty-decline-all-requests"),
    path("bulk-register", FacultyBulkRegisterView.as_view(), name="faculty-bulk-register"),
    path("get-students-by-faculty", FacultyGetStudentsView.as_view(), name="faculty-get-students"),
    path("expire-session", FacultyExpireSessionView.as_view(), name="faculty-expire-session"),
    path("remove-user/<str:userId>", FacultyRemoveUserView.as_view(), name="faculty-remove-user"),
]
