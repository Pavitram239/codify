from django.urls import path
from apps.users.views_access import AccessCatalogView, AccessRolesView, AccessRoleDetailView, AccessUsersView, AccessUserDetailView, AccessAuditView

urlpatterns = [
    path("permissions", AccessCatalogView.as_view()),
    path("roles", AccessRolesView.as_view()),
    path("roles/<int:pk>", AccessRoleDetailView.as_view()),
    path("users", AccessUsersView.as_view()),
    path("users/<uuid:pk>", AccessUserDetailView.as_view()),
    path("audit", AccessAuditView.as_view()),
]
