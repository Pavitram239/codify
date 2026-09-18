from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken


class CookieJWTAuthentication(JWTAuthentication):
    """
    Extends SimpleJWT to read the JWT access token from the HTTP-only 'token' cookie,
    with a fallback to the standard 'Authorization: Bearer <token>' header.
    Also validates that the session_id in the token matches the user's active session_id in the database.
    """

    def authenticate(self, request):
        header = self.get_header(request)
        raw_token = None

        if header is not None:
            raw_token = self.get_raw_token(header)
        elif "token" in request.COOKIES:
            raw_token = request.COOKIES.get("token")

        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
        except InvalidToken as e:
            raise AuthenticationFailed(str(e))

        user = self.get_user(validated_token)

        # Check session_id matching if present in token payload (enforced ONLY for students)
        if user.role == "student":
            token_session_id = validated_token.get("sessionId")
            if token_session_id:
                if not user.session_id or user.session_id != token_session_id:
                    raise AuthenticationFailed("Session expired or logged in from another device")

        return user, validated_token

    def get_user(self, validated_token):
        user_id = validated_token.get("user_id") or validated_token.get("id")
        if not user_id:
            raise AuthenticationFailed("Token contained no recognizable user identification")

        try:
            user = self.user_model.objects.get(**{self.user_model.USERNAME_FIELD if False else "id": user_id})
        except self.user_model.DoesNotExist:
            raise AuthenticationFailed("User not found", code="user_not_found")

        if not user.is_active:
            raise AuthenticationFailed("User is inactive", code="user_inactive")

        return user
