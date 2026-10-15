from rest_framework.permissions import BasePermission


def choices(module, action, scopes=("own", "all")):
    return tuple(f"{module}.{action}_{scope}" for scope in scopes)


VIEW_PERMISSIONS = {
    "ProblemListCreateView": {"GET": choices("problems", "view", ("assigned", "shared", "all")), "POST": ("problems.create",)},
    "ProblemDetailUpdateDeleteView": {"GET": choices("problems", "view", ("assigned", "shared", "all")), "PUT": choices("problems", "edit"), "DELETE": choices("problems", "delete")},
    "ProblemForUpdateView": {"GET": choices("problems", "edit")},
    "AIProblemGenerateView": {"POST": ("problems.create",)},
    "ContestListCreateView": {"GET": choices("contests", "view", ("assigned", "shared", "all")), "POST": ("contests.create",)},
    "ContestDetailView": {"GET": choices("contests", "view", ("assigned", "shared", "all")), "PUT": choices("contests", "edit"), "DELETE": choices("contests", "delete")},
    "UserSubmissionsForProblemView": {"GET": ("submissions.view_own",)},
    "AllSubmissionsForUserView": {"GET": ("submissions.view_own",)},
    "AllSubmissionsForProblemView": {"GET": choices("submissions", "review")},
    "SubmissionDetailView": {"GET": ("submissions.view_own", *choices("submissions", "review"))},
    "AllStudentsStatsView": {"GET": choices("users", "view", ("assigned", "all"))},
    "ContestDashboardView": {"GET": choices("submissions", "review")},
    "IssueInitialPasswordView": {"POST": choices("users", "issue_password", ("assigned", "all"))},
}
for name in ("AssignStudentsView", "UnassignStudentsView", "AssignedStudentsView", "UnassignedStudentsView"):
    VIEW_PERMISSIONS[name] = {method: choices("problems", "assign", ("shared", "all")) for method in ("GET", "POST")}
for name in ("AssignContestToStudentsView", "UnassignContestToStudentsView", "GetAssignedStudentsView", "GetUnassignedStudentsView"):
    VIEW_PERMISSIONS[name] = {method: choices("contests", "assign", ("shared", "all")) for method in ("GET", "POST")}
for prefix, scope in (("Admin", "all"), ("Faculty", "assigned")):
    for suffix, module, action in (
        ("PendingUsersView", "users", "approve"), ("AcceptRequestView", "users", "approve"),
        ("DeclineRequestView", "users", "approve"), ("AcceptAllRequestsView", "users", "approve"),
        ("DeclineAllRequestsView", "users", "approve"), ("GetFacultyView", "users", "view"),
        ("GetStudentsView", "users", "view"), ("BulkRegisterView", "users", "create"),
        ("DeleteFacultyView", "users", "delete"), ("RemoveUserView", "users", "delete"),
        ("TerminateSessionView", "sessions", "revoke"), ("ExpireSessionView", "sessions", "revoke"),
        ("UsersSessionsView", "sessions", "view"),
    ):
        codes = (f"{module}.{action}_{scope}",) if scope == "all" else choices(module, action, ("assigned", "all"))
        VIEW_PERMISSIONS[prefix+suffix] = {method: codes for method in ("GET", "POST", "DELETE")}


class ModulePermission(BasePermission):
    """Deny unmapped actions in protected modules; resolve grants per request."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated or not request.user.is_active:
            return False
        method = "GET" if request.method == "HEAD" else request.method
        if method == "OPTIONS":
            return True
        codes = VIEW_PERMISSIONS.get(type(view).__name__, {}).get(method, ())
        return request.user.can(*codes)

VIEW_PERMISSIONS.update({
    "RunCodeView": {"POST": ("execution.run",)},
    "QueueStatusView": {"GET": ("execution.run",)},
    "SaveCodeDraftView": {"POST": ("drafts.save",)},
    "GetCodeDraftView": {"GET": ("drafts.view",)},
})
