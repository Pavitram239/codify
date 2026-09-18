import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError("The Username field must be set")
        user = self.model(username=username, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault("role", "admin")
        extra_fields.setdefault("is_approved", True)
        extra_fields.setdefault("first_time_login", False)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        return self.create_user(username, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ("admin", "Admin"),
        ("faculty", "Faculty"),
        ("student", "Student"),
    ]

    BRANCH_CHOICES = [
        ("cspit-cse", "CSPIT CSE"),
        ("cspit-ce", "CSPIT CE"),
        ("cspit-it", "CSPIT IT"),
    ]

    # Primary key UUID
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Student ID / Institutional ID (matches "id" field in MongoDB, e.g. "22it015" or uuid)
    student_id = models.CharField(max_length=100, unique=True, null=True, blank=True, db_index=True)

    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(null=True, blank=True)
    mobile_no = models.CharField(max_length=20, null=True, blank=True)

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="student", db_index=True)
    branch = models.CharField(max_length=50, choices=BRANCH_CHOICES, default="cspit-it")
    semester = models.PositiveSmallIntegerField(default=1)
    batch = models.CharField(max_length=20, default="a1")
    subject = models.CharField(max_length=255, null=True, blank=True)

    is_approved = models.BooleanField(default=False)
    first_time_login = models.BooleanField(default=True)

    faculty = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
    )

    # Profile fields
    profile_name = models.CharField(max_length=255, null=True, blank=True)
    profile_bio = models.TextField(null=True, blank=True)
    profile_avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)
    profile_github = models.CharField(max_length=255, null=True, blank=True)
    profile_linkedin = models.CharField(max_length=255, null=True, blank=True)
    profile_birthday = models.CharField(max_length=50, null=True, blank=True)
    profile_gender = models.CharField(max_length=50, null=True, blank=True)
    profile_skills = models.TextField(null=True, blank=True)
    profile_education = models.TextField(null=True, blank=True)
    profile_location = models.CharField(max_length=255, null=True, blank=True)

    # Session control
    session_id = models.CharField(max_length=100, null=True, blank=True)
    last_login_time = models.DateTimeField(null=True, blank=True)

    # Django internal fields for staff/admin permissions
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"
        indexes = [
            models.Index(fields=["email", "role"]),
        ]

    def __str__(self):
        return f"{self.username} ({self.role})"
