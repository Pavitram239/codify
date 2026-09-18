from django.urls import path
from apps.users.views import (
    ChangePasswordView,
    CurrentUserView,
    FetchSubjectsView,
    LoginView,
    LogoutView,
    RegisterView,
)

urlpatterns = [
    path("login", LoginView.as_view(), name="auth-login"),
    path("register", RegisterView.as_view(), name="auth-register"),
    path("logout", LogoutView.as_view(), name="auth-logout"),
    path("get-current-user", CurrentUserView.as_view(), name="auth-current-user"),
    path("change-password", ChangePasswordView.as_view(), name="auth-change-password"),
    path("fetch-subjects", FetchSubjectsView.as_view(), name="auth-fetch-subjects"),
]
