from django.urls import path
from apps.users.views_admin import (
    AdminAcceptAllRequestsView,
    AdminAcceptRequestView,
    AdminDeclineAllRequestsView,
    AdminDeclineRequestView,
    AdminDeleteFacultyView,
    AdminGetFacultyView,
    AdminPendingUsersView,
    AdminTerminateSessionView,
    AdminUsersSessionsView,
)

urlpatterns = [
    path("get-pending-users", AdminPendingUsersView.as_view(), name="admin-get-pending-users"),
    path("accept-request", AdminAcceptRequestView.as_view(), name="admin-accept-request"),
    path("accept-all-requests", AdminAcceptAllRequestsView.as_view(), name="admin-accept-all-requests"),
    path("decline-request", AdminDeclineRequestView.as_view(), name="admin-decline-request"),
    path("decline-all-requests", AdminDeclineAllRequestsView.as_view(), name="admin-decline-all-requests"),
    path("get-faculty-by-admin", AdminGetFacultyView.as_view(), name="admin-get-faculty-by-admin"),
    path("deleteFaculty", AdminDeleteFacultyView.as_view(), name="admin-delete-faculty"),
    path("terminate-session", AdminTerminateSessionView.as_view(), name="admin-terminate-session"),
    path("users-sessions", AdminUsersSessionsView.as_view(), name="admin-users-sessions"),
]
