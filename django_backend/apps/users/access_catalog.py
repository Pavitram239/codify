"""Stable action identifiers; grants are configured in the database."""
CATALOG = {}
for module in ("problems", "contests"):
    for action in ("view_assigned", "view_shared", "view_all", "create", "edit_own", "edit_all", "delete_own", "delete_all", "assign_shared", "assign_all"):
        CATALOG[f"{module}.{action}"] = (module, action.replace("_", " ").capitalize())
for module, actions in {
    "submissions": ["view_own", "review_own", "review_all"],
    "execution": ["run"], "drafts": ["view", "save"],
    "users": ["edit_all", "view_assigned", "view_all", "create_assigned", "create_all", "approve_assigned", "approve_all", "delete_assigned", "delete_all", "issue_password_assigned", "issue_password_all"],
    "sessions": ["view_all", "revoke_assigned", "revoke_all"],
    "access": ["manage"],
}.items():
    for action in actions:
        CATALOG[f"{module}.{action}"] = (module, action.replace("_", " ").capitalize())
DEFAULTS = {
    "student": {"problems.view_assigned", "contests.view_assigned", "submissions.view_own", "execution.run", "drafts.view", "drafts.save"},
    "faculty": {"execution.run", "drafts.view", "drafts.save", "submissions.view_own", "submissions.review_own", "sessions.revoke_assigned"},
    "admin": set(CATALOG),
}
for module in ("problems", "contests"):
    DEFAULTS["faculty"].update(f"{module}.{action}" for action in ("view_shared", "create", "edit_own", "delete_own", "assign_shared"))
DEFAULTS["faculty"].update(f"users.{action}_assigned" for action in ("view", "create", "approve", "delete", "issue_password"))
