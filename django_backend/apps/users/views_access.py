from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.users.onboarding import prepare_initial_password
from apps.users.models import User, AccessRole, AccessPermission, AccessAudit


class CanManageAccess(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.can("access.manage")


class RoleInput(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    permissions = serializers.ListField(child=serializers.CharField(), allow_empty=True)


class UserAccessInput(serializers.Serializer):
    roles = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=True)
    permissions = serializers.ListField(child=serializers.CharField(), allow_empty=True)


def validated_permissions(codes):
    permissions = list(AccessPermission.objects.filter(code__in=codes))
    if {p.code for p in permissions} != set(codes):
        raise ValidationError({"permissions": "Unknown permission identifier."})
    return permissions


class UserDetailsInput(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    fullName = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    mobileNo = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    accountType = serializers.ChoiceField(choices=User.ROLE_CHOICES, default="faculty")
    studentId = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    branch = serializers.ChoiceField(choices=User.BRANCH_CHOICES, default="cspit-it")
    semester = serializers.IntegerField(min_value=1, max_value=12, default=1)
    batch = serializers.CharField(max_length=20, default="a1")
    subject = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    facultyId = serializers.UUIDField(required=False, allow_null=True, default=None)
    isActive = serializers.BooleanField(default=True)
    isApproved = serializers.BooleanField(default=True)
    roles = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False)
    permissions = serializers.ListField(child=serializers.CharField(), required=False)


def validate_identity(data, user=None):
    exclude = {"pk": user.pk} if user else {}
    for field, key in (("username", "username"), ("email", "email"), ("student_id", "studentId")):
        value = data.get(key, "")
        if value and User.objects.filter(**{field + "__iexact": value}).exclude(**exclude).exists():
            raise ValidationError({key: "This value is already used by another account."})
    if data["facultyId"] and not User.objects.filter(pk=data["facultyId"]).exists():
        raise ValidationError({"facultyId": "The selected faculty account no longer exists."})
    return dict(username=data["username"], profile_name=data["fullName"], email=data["email"].lower() or None,
                mobile_no=data["mobileNo"], role=data["accountType"], student_id=data["studentId"] or None,
                branch=data["branch"], semester=data["semester"], batch=data["batch"], subject=data["subject"],
                faculty_id=data["facultyId"], is_active=data["isActive"], is_approved=data["isApproved"])


def validated_roles(ids):
    roles = list(AccessRole.objects.filter(pk__in=ids))
    if {r.pk for r in roles} != set(ids):
        raise ValidationError({"roles": "Unknown role."})
    return roles


def role_data(role):
    return dict(id=role.pk, name=role.name, description=role.description,
                defaultAccountType=role.default_account_type, userCount=role.users.count(),
                permissions=list(role.permissions.values_list("code", flat=True)))


def user_data(user):
    roles = list(user.access_roles.prefetch_related("permissions"))
    direct = list(user.direct_permissions.values_list("code", flat=True))
    sources = {code: ["Direct grant"] for code in direct}
    for role in roles:
        for permission in role.permissions.all():
            sources.setdefault(permission.code, []).append(role.name)
    return dict(id=str(user.pk), username=user.username, fullName=user.profile_name or "", email=user.email or "",
                mobileNo=user.mobile_no or "", accountType=user.role, studentId=user.student_id or "",
                branch=user.branch, semester=user.semester, batch=user.batch, subject=user.subject or "",
                facultyId=str(user.faculty_id) if user.faculty_id else None, isActive=user.is_active,
                isApproved=user.is_approved, firstTimeLogin=user.first_time_login,
                roles=[r.pk for r in roles], permissions=direct,
                effectivePermissions=sorted(user.effective_permissions()), sources=sources)


def preserve_manager():
    managers = User.objects.filter(is_active=True, is_approved=True).filter(
        Q(direct_permissions__code="access.manage") | Q(access_roles__permissions__code="access.manage")
    ).exists()
    if not managers:
        raise ValidationError("At least one active user must retain access management permission.")


def lock_access(request):
    # Serialize role and user-access mutations, including concurrent last-manager changes.
    list(AccessRole.objects.select_for_update().order_by("pk").values_list("pk", flat=True))
    list(User.objects.select_for_update().order_by("pk").values_list("pk", flat=True))
    if not request.user.can("access.manage"):
        raise PermissionDenied("Access management permission was revoked.")


def audit(request, action, target, before, after):
    AccessAudit.objects.create(actor=request.user, action=action, target=str(target), before=before, after=after)


class AccessCatalogView(APIView):
    permission_classes = [IsAuthenticated, CanManageAccess]

    def get(self, request):
        return Response(list(AccessPermission.objects.values("id", "code", "module", "label")))


class AccessRolesView(APIView):
    permission_classes = [IsAuthenticated, CanManageAccess]

    def get(self, request):
        return Response([role_data(r) for r in AccessRole.objects.prefetch_related("permissions")])

    @transaction.atomic
    def post(self, request):
        lock_access(request)
        serializer = RoleInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        permissions = validated_permissions(data["permissions"])
        if AccessRole.objects.filter(name__iexact=data["name"]).exists():
            raise ValidationError({"name": "A role with this name already exists."})
        role = AccessRole.objects.create(name=data["name"], description=data["description"])
        role.permissions.set(permissions)
        result = role_data(role)
        audit(request, "role.create", role.pk, {}, result)
        return Response(result, status=201)


class AccessRoleDetailView(APIView):
    permission_classes = [IsAuthenticated, CanManageAccess]

    @transaction.atomic
    def put(self, request, pk):
        lock_access(request)
        role = get_object_or_404(AccessRole, pk=pk)
        before = role_data(role)
        serializer = RoleInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if AccessRole.objects.filter(name__iexact=data["name"]).exclude(pk=pk).exists():
            raise ValidationError({"name": "A role with this name already exists."})
        role.name, role.description = data["name"], data["description"]
        role.save(update_fields=["name", "description"])
        role.permissions.set(validated_permissions(data["permissions"]))
        preserve_manager()
        result = role_data(role)
        audit(request, "role.update", role.pk, before, result)
        return Response(result)

    @transaction.atomic
    def delete(self, request, pk):
        lock_access(request)
        role = get_object_or_404(AccessRole, pk=pk)
        if role.default_account_type:
            raise ValidationError("Default onboarding roles can be edited but cannot be deleted.")
        before = role_data(role)
        role.delete()
        preserve_manager()
        audit(request, "role.delete", pk, before, {})
        return Response(status=204)


class AccessUsersView(APIView):
    permission_classes = [IsAuthenticated, CanManageAccess]

    def get(self, request):
        from apps.users.pagination import pagination_params
        page, limit = pagination_params(request.query_params)
        users = User.objects.order_by("username").prefetch_related("access_roles__permissions", "direct_permissions")
        search = request.query_params.get("search", "").strip()
        if search:
            users = users.filter(Q(username__icontains=search) | Q(profile_name__icontains=search) | Q(email__icontains=search) | Q(student_id__icontains=search))
        account_type = request.query_params.get("accountType")
        if account_type in dict(User.ROLE_CHOICES):
            users = users.filter(role=account_type)
        status_filter = request.query_params.get("status")
        if status_filter in ("active", "inactive"):
            users = users.filter(is_active=status_filter == "active")
        role_id = request.query_params.get("role")
        if role_id:
            try:
                users = users.filter(access_roles__pk=int(role_id))
            except ValueError:
                raise ValidationError({"role": "Invalid role filter."})
        return Response({"count": users.count(), "results": [user_data(u) for u in users[(page-1)*limit:page*limit]]})

    @transaction.atomic
    def post(self, request):
        lock_access(request)
        if not request.user.can("users.create_all"):
            raise PermissionDenied("You do not have permission to create users.")
        serializer = UserDetailsInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        fields = validate_identity(data)
        roles = validated_roles(data["roles"]) if "roles" in data else None
        permissions = validated_permissions(data.get("permissions", []))
        user = User.objects.create_user(**fields)
        if roles is not None:
            user.access_roles.set(roles)
        user.direct_permissions.set(permissions)
        credential = prepare_initial_password(user)
        user.save(update_fields=["password"])
        result = user_data(user)
        audit(request, "user.create", user.pk, {}, result)
        response = Response({"user": result, "temporaryPasswords": [credential] if credential else []}, status=201)
        response["Cache-Control"] = "no-store"
        return response


class AccessUserDetailView(APIView):
    permission_classes = [IsAuthenticated, CanManageAccess]

    def get(self, request, pk):
        return Response(user_data(get_object_or_404(User, pk=pk)))

    @transaction.atomic
    def put(self, request, pk):
        lock_access(request)
        user = get_object_or_404(User, pk=pk)
        before = user_data(user)
        serializer = UserAccessInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        roles = validated_roles(data["roles"])
        user.access_roles.set(roles)
        user.direct_permissions.set(validated_permissions(data["permissions"]))
        preserve_manager()
        result = user_data(user)
        audit(request, "user.access.update", user.pk, before, result)
        return Response(result)

    @transaction.atomic
    def patch(self, request, pk):
        lock_access(request)
        if not request.user.can("users.edit_all"):
            raise PermissionDenied("You do not have permission to edit users.")
        user = get_object_or_404(User, pk=pk)
        before = user_data(user)
        existing = {key: before[key] for key in UserDetailsInput().fields if key in before}
        existing.update(request.data)
        # Identity editing never silently changes role or direct permission grants.
        existing.pop("roles", None)
        existing.pop("permissions", None)
        serializer = UserDetailsInput(data=existing)
        serializer.is_valid(raise_exception=True)
        fields = validate_identity(serializer.validated_data, user)
        if fields["faculty_id"] == user.pk:
            raise ValidationError({"facultyId": "An account cannot be its own faculty."})
        for name, value in fields.items():
            setattr(user, name, value)
        if not user.is_active:
            user.session_id = None
        user.save()
        preserve_manager()
        result = user_data(user)
        audit(request, "user.update", user.pk, before, result)
        return Response(result)

    @transaction.atomic
    def delete(self, request, pk):
        lock_access(request)
        if not request.user.can("users.delete_all"):
            raise PermissionDenied("You do not have permission to delete users.")
        user = get_object_or_404(User, pk=pk)
        before = user_data(user)
        if user.pk == request.user.pk:
            raise ValidationError("You cannot delete your own account while signed in.")
        user.delete()
        preserve_manager()
        audit(request, "user.delete", pk, before, {})
        return Response(status=204)


class AccessAuditView(APIView):
    permission_classes = [IsAuthenticated, CanManageAccess]

    def get(self, request):
        return Response(list(AccessAudit.objects.order_by("-created_at").values(
            "id", "actor__username", "action", "target", "before", "after", "created_at"
        )[:100]))
