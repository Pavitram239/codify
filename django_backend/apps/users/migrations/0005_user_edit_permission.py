from django.db import migrations


def seed(apps, schema_editor):
    Permission = apps.get_model("users", "AccessPermission")
    Role = apps.get_model("users", "AccessRole")
    permission = Permission.objects.using(schema_editor.connection.alias).create(
        code="users.edit_all", module="users", label="Edit all")
    role = Role.objects.using(schema_editor.connection.alias).filter(default_account_type="admin").first()
    if role:
        role.permissions.add(permission)


class Migration(migrations.Migration):
    dependencies = [("users", "0004_seed_dynamic_access")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
