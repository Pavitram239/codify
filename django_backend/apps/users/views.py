import uuid
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction, IntegrityError
from django.http import FileResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.core.cache import cache
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from apps.users.authentication import CookieJWTAuthentication
from PIL import Image
from apps.users.onboarding import has_predictable_password
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import User
from apps.users.serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    RegisterSerializer,
    UpdateProfileSerializer,
    UserProfileSerializer,
    UserResponseSerializer,
)


class CSRFTokenView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        response = Response({"csrfToken": get_token(request)})
        response["Cache-Control"] = "no-store"
        return response


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        SessionAuthentication().enforce_csrf(request)
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "message": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        identifier = serializer.validated_data.get("id")
        email = serializer.validated_data.get("email")
        password = serializer.validated_data.get("password")

        user = None
        if identifier:
            user = (
                User.objects.filter(student_id__iexact=identifier).first()
                or User.objects.filter(username__iexact=identifier).first()
            )
        elif email:
            user = User.objects.filter(email__iexact=email).first()

        if not user:
            return Response(
                {"success": False, "message": "User not found with this id"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.is_active:
            return Response({"success": False, "message": "Account is inactive."}, status=status.HTTP_400_BAD_REQUEST)

        if not user.is_approved:
            return Response(
                {"success": False, "message": "User not approved yet"},
                status=status.HTTP_200_OK,
            )

        if not user.check_password(password):
            return Response(
                {"success": False, "message": "Invalid credentials"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if has_predictable_password(user):
            return Response({"success": False, "message": "Ask your administrator or faculty to issue a secure temporary password."}, status=status.HTTP_400_BAD_REQUEST)

        if user.first_time_login:
            return Response(
                {
                    "success": True,
                    "message": "First time login",
                    "firstTimeLogin": True,
                },
                status=status.HTTP_200_OK,
            )

        # Serialize concurrent logins and replace sessions whose access token has expired.
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=user.id)
            now = timezone.now()
            cutoff = now - settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"]
            if user.role == "student" and user.session_id and user.last_login_time and user.last_login_time > cutoff:
                return Response(
                    {
                        "success": False,
                        "message": "User already logged in another device. Please contact the administrator to terminate your session.",
                        "isAdmin": False,
                        "canTerminate": False,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            new_session_id = str(uuid.uuid4())
            if user.role == "student":
                user.session_id = new_session_id
            user.last_login_time = now
            user.save(update_fields=["session_id", "last_login_time"])

        # Generate JWT with matching payload structure
        refresh = RefreshToken.for_user(user)
        refresh["id"] = str(user.id)
        refresh["sessionId"] = new_session_id
        access_token = str(refresh.access_token)

        response = Response(
            {
                "success": True,
                "message": "Login successful",
                "user": UserResponseSerializer(user, context={"request": request}).data,
                "token": access_token,
            },
            status=status.HTTP_200_OK,
        )

        response.set_cookie(
            key="token",
            value=access_token,
            max_age=settings.COOKIE_MAX_AGE,
            httponly=settings.COOKIE_HTTPONLY,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
        )

        return response


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "message": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        role = data.get("role")
        username = data.get("username")

        if User.objects.filter(username__iexact=username).exists():
            return Response(
                {"success": False, "message": "Username already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if role == "student":
            student_id = data.get("id").lower()
            if User.objects.filter(student_id__iexact=student_id).exists():
                return Response(
                    {"success": False, "message": "Student ID already exists."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            email = f"{student_id}@charusat.edu.in"
            faculty_id = data.get("facultyId")
            faculty = User.objects.filter(id=faculty_id, role="faculty").first() if faculty_id else None

            user = User(
                username=username,
                student_id=student_id,
                email=email,
                mobile_no=data.get("mobileNo"),
                role="student",
                branch=data.get("branch", "cspit-it").lower(),
                semester=data.get("semester", 1),
                batch=data.get("batch", "a1").lower(),
                subject=data.get("subject"),
                faculty=faculty,
                is_approved=False,
                first_time_login=True,
            )
            user.set_password(data["password"])
            user.save()

        elif role == "faculty":
            email = data.get("email").lower()
            if User.objects.filter(email__iexact=email).exists():
                return Response(
                    {"success": False, "message": "Email already registered."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user = User(
                username=username,
                email=email,
                role="faculty",
                subject=data.get("subject"),
                is_approved=False,
                first_time_login=True,
            )
            user.set_password(data["password"])
            user.save()

        return Response(
            {
                "success": True,
                "message": "User registered successfully, waiting for approval",
            },
            status=status.HTTP_201_CREATED,
        )


class LogoutView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        if not request.META.get("HTTP_AUTHORIZATION"):
            SessionAuthentication().enforce_csrf(request)
        if not request.user.is_authenticated:
            try:
                authenticated = CookieJWTAuthentication().authenticate(request)
                if authenticated:
                    request.user = authenticated[0]
            except AuthenticationFailed:
                pass
        if request.user and request.user.is_authenticated:
            request.user.session_id = None
            request.user.save(update_fields=["session_id"])

        response = Response(
            {"success": True, "message": "Logged out successfully"},
            status=status.HTTP_200_OK,
        )
        response.delete_cookie("token", samesite=settings.COOKIE_SAMESITE)
        return response


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserResponseSerializer(request.user, context={"request": request})
        return Response(
            {
                "success": True,
                "user": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class ChangePasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "message": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_password = serializer.validated_data.get("oldPassword")
        new_password = serializer.validated_data.get("newPassword")
        passed_id = serializer.validated_data.get("id") or request.data.get("id")

        user = None
        if request.user and request.user.is_authenticated:
            user = request.user
        elif passed_id:
            user = (
                User.objects.filter(student_id__iexact=str(passed_id).strip()).first()
                or User.objects.filter(email__iexact=str(passed_id).strip()).first()
                or User.objects.filter(username__iexact=str(passed_id).strip()).first()
            )

        if not user:
            # Reconstruct email as in Express auth.js controller
            email_attempt = f"{old_password.lower()}@charusat.edu.in"
            faculty_email_attempt = f"{old_password.lower()}@charusat.ac.in"
            user = (
                User.objects.filter(email__iexact=email_attempt).first()
                or User.objects.filter(email__iexact=faculty_email_attempt).first()
                or User.objects.filter(student_id__iexact=old_password).first()
                or User.objects.filter(username__iexact=old_password).first()
            )

        if not user:
            return Response(
                {"success": False, "message": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        is_valid = user.is_active and user.is_approved and not has_predictable_password(user) and user.check_password(old_password)

        if not is_valid:
            return Response(
                {"success": False, "message": "Invalid old password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user=user)
        except ValidationError as exc:
            return Response(
                {"success": False, "message": " ".join(exc.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.first_time_login = False
        user.session_id = None
        user.save(update_fields=["password", "first_time_login", "session_id"])

        return Response(
            {"success": True, "message": "Password changed successfully."},
            status=status.HTTP_200_OK,
        )


class FetchSubjectsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        cache_key = "faculty_subjects_list"
        cached_subjects = cache.get(cache_key)
        if cached_subjects is not None:
            return Response({"success": True, "subjects": cached_subjects}, status=status.HTTP_200_OK)

        faculties = User.objects.filter(role="faculty", is_approved=True)
        subjects = [
            {
                "id": str(faculty.id),
                "subject": faculty.subject or "",
                "teacher": faculty.username,
            }
            for faculty in faculties
            if faculty.subject
        ]
        cache.set(cache_key, subjects, timeout=300)
        return Response(
            {"success": True, "subjects": subjects},
            status=status.HTTP_200_OK,
        )


class UpdateUserView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        serializer = UpdateProfileSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(
                {
                    "message": "Invalid profile fields.",
                    "errors": serializer.errors,
                    "success": False,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        user = request.user
        new_username = data.get("username")

        if new_username != user.username and User.objects.filter(username__iexact=new_username).exclude(id=user.id).exists():
            return Response(
                {"message": "Username already taken.", "success": False},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.username = new_username
        user.profile_name = data.get("name")
        if data.get("email") is not None:
            user.email = data.get("email")
        if data.get("bio") is not None:
            user.profile_bio = data.get("bio")
        if data.get("gender") is not None:
            user.profile_gender = data.get("gender")
        if data.get("location") is not None:
            user.profile_location = data.get("location")
        if data.get("birthday") is not None:
            user.profile_birthday = data.get("birthday")
        if data.get("github") is not None:
            user.profile_github = data.get("github")
        if data.get("skills") is not None:
            user.profile_skills = data.get("skills")
        if data.get("education") is not None:
            user.profile_education = data.get("education")
        if data.get("linkedIn") is not None:
            user.profile_linkedin = data.get("linkedIn")

        try:
            with transaction.atomic():
                user.save()
        except IntegrityError:
            return Response({"success": False, "message": "Username or email already registered."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "message": "Profile updated successfully",
                "user": {
                    "username": user.username,
                    "profile": UserProfileSerializer(user, context={"request": request}).data,
                    "email": user.email,
                },
                "success": True,
            },
            status=status.HTTP_200_OK,
        )


class UploadAvatarView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = request.FILES.get("avatar")
        if not file_obj:
            return Response(
                {"error": "User ID and valid file are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        field = serializers.ImageField()
        try:
            file_obj = field.run_validation(file_obj)
        except ValidationError as exc:
            return Response({"error": " ".join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        old_name = user.profile_avatar.name if user.profile_avatar else None
        storage = user.profile_avatar.storage
        user.profile_avatar = file_obj
        user.save(update_fields=["profile_avatar"])
        if old_name and old_name != user.profile_avatar.name:
            storage.delete(old_name)

        return Response(
            {
                "message": "Avatar uploaded successfully.",
                "fileId": str(user.id),
            },
            status=status.HTTP_200_OK,
        )


class GetAvatarView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.profile_avatar:
            return Response(
                {"error": "Profile picture not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            file_obj = user.profile_avatar.open("rb")
            with Image.open(file_obj) as img:
                mime = Image.MIME.get(img.format, "application/octet-stream")
            file_obj = user.profile_avatar.open("rb")
            file_obj.seek(0)
            return FileResponse(file_obj, content_type=mime)
        except Exception:
            return Response(
                {"error": "Error retrieving profile picture."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class RemoveAvatarView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        user = request.user
        if not user.profile_avatar:
            return Response(
                {"message": "Avatar does not exist."},
                status=status.HTTP_404_NOT_FOUND,
            )

        user.profile_avatar.delete(save=False)
        user.profile_avatar = None
        user.save(update_fields=["profile_avatar"])

        return Response(
            {"message": "Avatar removed successfully."},
            status=status.HTTP_200_OK,
        )

