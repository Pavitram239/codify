from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.users.models import User, AccessRole


@receiver(post_save, sender=User)
def assign_initial_role(sender, instance, created, raw=False, **kwargs):
    if created and not raw:
        role = AccessRole.objects.filter(default_account_type=instance.role).first()
        if role:
            instance.access_roles.add(role)


from django.db.models.signals import pre_delete
from django.db.models import Q
from rest_framework.exceptions import PermissionDenied


@receiver(pre_delete, sender=User)
def protect_last_access_manager(sender, instance, **kwargs):
    if instance.is_active and instance.can("access.manage"):
        list(AccessRole.objects.select_for_update().order_by("pk").values_list("pk", flat=True))
        list(User.objects.select_for_update().order_by("pk").values_list("pk", flat=True))
        if not User.objects.filter(is_active=True, is_approved=True).exclude(pk=instance.pk).filter(
            Q(direct_permissions__code="access.manage") | Q(access_roles__permissions__code="access.manage")
        ).exists():
            raise PermissionDenied("The last active access manager cannot be deleted.")
