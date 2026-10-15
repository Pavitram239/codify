"""
Root URL configuration.

All API routes are namespaced under /api/v1/ to mirror the existing
Node.js backend URL structure exactly.
"""

from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from apps.problems.views import ProblemListCreateView
from apps.contests.views import ContestListCreateView
from apps.submissions.views import UserSubmissionsForProblemView

urlpatterns = [
    # Django admin panel
    path("admin/", admin.site.urls),

    # API v1 — routes will be added incrementally per phase
    path(
        "api/v1/",
        include(
            [
                # Phase 4: Authentication
                path("access/", include("apps.users.urls.access")),
                path("auth/", include("apps.users.urls.auth")),

                # Phase 4: User profile
                path("user/", include("apps.users.urls.user")),

                # Phase 5: Problems
                path("problems", ProblemListCreateView.as_view(), name="problems-direct-no-slash"),
                path("problems/", include("apps.problems.urls")),

                # Phase 6: Code drafts (save / get code)
                path("compile/", include("apps.code_drafts.urls")),

                # Phase 7: Submissions
                path("submissions", UserSubmissionsForProblemView.as_view(), name="submissions-direct-no-slash"),
                path("submissions/", include("apps.submissions.urls")),

                # Phase 8: Code execution (Judge0)
                path("compiler/", include("apps.execution.urls")),

                # Phase 9: Contests
                path("contests", ContestListCreateView.as_view(), name="contests-direct-no-slash"),
                path("contests/", include("apps.contests.urls")),

                # Phase 10: Admin management
                path("admin/", include("apps.users.urls.admin")),

                # Phase 10: Faculty management
                path("faculty/", include("apps.users.urls.faculty")),
            ]
        ),
    ),
]

# Serve media files in development (in production use nginx/S3)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
