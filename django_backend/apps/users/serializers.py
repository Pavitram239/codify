from rest_framework import serializers
from apps.users.models import User
from datetime import date
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth.password_validation import validate_password


class UserProfileSerializer(serializers.Serializer):
    name = serializers.CharField(source="profile_name", allow_null=True, required=False)
    bio = serializers.CharField(source="profile_bio", allow_null=True, required=False)
    avatar = serializers.SerializerMethodField()
    github = serializers.CharField(source="profile_github", allow_null=True, required=False)
    linkedIn = serializers.CharField(source="profile_linkedin", allow_null=True, required=False)
    birthday = serializers.CharField(source="profile_birthday", allow_null=True, required=False)
    gender = serializers.CharField(source="profile_gender", allow_null=True, required=False)
    skills = serializers.CharField(source="profile_skills", allow_null=True, required=False)
    education = serializers.CharField(source="profile_education", allow_null=True, required=False)
    location = serializers.CharField(source="profile_location", allow_null=True, required=False)

    def get_avatar(self, obj):
        if obj.profile_avatar:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.profile_avatar.url)
            return obj.profile_avatar.url
        return None


class UserResponseSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()
    accessRoles = serializers.SerializerMethodField()

    def get_permissions(self, obj):
        return sorted(obj.effective_permissions())

    def get_accessRoles(self, obj):
        return list(obj.access_roles.values("id", "name"))

    _id = serializers.SerializerMethodField()
    id = serializers.SerializerMethodField()
    isApproved = serializers.BooleanField(source="is_approved")
    firstTimeLogin = serializers.BooleanField(source="first_time_login")
    mobileNo = serializers.CharField(source="mobile_no")
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "_id",
            "id",
            "username",
            "email",
            "mobileNo",
            "role",
            "permissions",
            "accessRoles",
            "branch",
            "semester",
            "batch",
            "subject",
            "isApproved",
            "firstTimeLogin",
            "profile",
            "created_at",
        ]

    def get__id(self, obj):
        return str(obj.id)

    def get_id(self, obj):
        return obj.student_id or str(obj.id)

    def get_profile(self, obj):
        return UserProfileSerializer(obj, context=self.context).data


class LoginSerializer(serializers.Serializer):
    id = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, data):
        if not data.get("id") and not data.get("email"):
            raise serializers.ValidationError("Either 'id' or 'email' is required.")
        return data


class RegisterSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)
    username = serializers.CharField(required=True)
    id = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    mobileNo = serializers.CharField(required=False, allow_blank=True)
    branch = serializers.CharField(required=False, allow_blank=True)
    semester = serializers.IntegerField(required=False)
    batch = serializers.CharField(required=False, allow_blank=True)
    subject = serializers.CharField(required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=["student", "faculty"])
    facultyId = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        role = data.get("role")
        try:
            validate_password(data["password"], user=User(username=data.get("username"), email=data.get("email")))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages})
        if role == "student":
            if not data.get("id"):
                raise serializers.ValidationError({"id": "Student ID is required for students."})
            if not data.get("branch") or not data.get("semester") or not data.get("batch"):
                raise serializers.ValidationError("Branch, semester, and batch are required for students.")
        elif role == "faculty":
            if not data.get("email"):
                raise serializers.ValidationError({"email": "Email is required for faculty."})
        return data


class ChangePasswordSerializer(serializers.Serializer):
    oldPassword = serializers.CharField(required=True)
    newPassword = serializers.CharField(required=True)
    id = serializers.CharField(required=False, allow_blank=True)


class UpdateProfileSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    name = serializers.CharField(required=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    bio = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    gender = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    location = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    birthday = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    github = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    skills = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    education = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    linkedIn = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_username(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Username cannot be empty.")
        return value.strip()

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Profile name cannot be empty.")
        return value.strip()

    def validate_email(self, value):
        if value:
            value = value.strip().lower()
            user = self.context["request"].user
            if User.objects.filter(email__iexact=value).exclude(pk=user.pk).exists():
                raise serializers.ValidationError("Email already registered.")
        return value

    def validate_birthday(self, value):
        if value:
            try:
                date.fromisoformat(value)
            except ValueError:
                raise serializers.ValidationError("Birthday must be a valid YYYY-MM-DD date.")
        return value

    def _validate_url(self, value):
        if value:
            try:
                URLValidator(schemes=["https", "http"])(value)
            except DjangoValidationError:
                raise serializers.ValidationError("Enter a valid http or https URL.")
        return value

    validate_github = _validate_url
    validate_linkedIn = _validate_url

