from django.urls import path
from apps.users.views import (
    GetAvatarView,
    RemoveAvatarView,
    UpdateUserView,
    UploadAvatarView,
)

urlpatterns = [
    path("update", UpdateUserView.as_view(), name="user-update"),
    path("upload-avatar", UploadAvatarView.as_view(), name="user-upload-avatar"),
    path("profile/upload-avatar", GetAvatarView.as_view(), name="user-get-avatar"),
    path("profile/remove-profile-pic", RemoveAvatarView.as_view(), name="user-remove-avatar"),
]
