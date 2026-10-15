from django.db import migrations


def seed(apps, schema_editor):
    # Frozen catalog: future additions require their own migration.
    Permission = apps.get_model("users", "AccessPermission")
    Role = apps.get_model("users", "AccessRole")
    User = apps.get_model("users", "User")
    catalog = {}
    for module in ("problems", "contests"):
        for action in ("view_assigned", "view_shared", "view_all", "create", "edit_own", "edit_all", "delete_own", "delete_all", "assign_shared", "assign_all"):
            catalog[f"{module}.{action}"] = (module, action.replace("_", " ").capitalize())
    for module, actions in {
        "submissions": ["view_own", "review_own", "review_all"],
        "execution": ["run"], "drafts": ["view", "save"],
        "users": ["view_assigned", "view_all", "create_assigned", "create_all", "approve_assigned", "approve_all", "delete_assigned", "delete_all", "issue_password_assigned", "issue_password_all"],
        "sessions": ["view_all", "revoke_assigned", "revoke_all"], "access": ["manage"],
    }.items():
        for action in actions:
            catalog[f"{module}.{action}"] = (module, action.replace("_", " ").capitalize())
    alias = schema_editor.connection.alias
    permissions = {}
    for code, (module, label) in catalog.items():
        permissions[code] = Permission.objects.using(alias).create(code=code, module=module, label=label)
    defaults = {
        "student": {"problems.view_assigned", "contests.view_assigned", "submissions.view_own", "execution.run", "drafts.view", "drafts.save"},
        "faculty": {"execution.run", "drafts.view", "drafts.save", "submissions.view_own", "submissions.review_own", "sessions.revoke_assigned"},
        "admin": set(catalog),
    }
    for module in ("problems", "contests"):
        defaults["faculty"].update(f"{module}.{action}" for action in ("view_shared", "create", "edit_own", "delete_own", "assign_shared"))
    defaults["faculty"].update(f"users.{action}_assigned" for action in ("view", "create", "approve", "delete", "issue_password"))
    for account_type, codes in defaults.items():
        role = Role.objects.using(alias).create(name=account_type.capitalize(), default_account_type=account_type)
        role.permissions.set([permissions[code] for code in codes])
        for user in User.objects.using(alias).filter(role=account_type).iterator():
            user.access_roles.add(role)


class Migration(migrations.Migration):
    dependencies = [("users", "0003_accesspermission_accessaudit_user_direct_permissions_and_more")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
