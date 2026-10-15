"""
Development settings — extends base.py.
Use these when running locally (not in Docker or CI).
"""

from .base import *  # noqa: F401, F403

# ---------------------------------------------------------------------------
# Debug
# ---------------------------------------------------------------------------

DEBUG = True

ALLOWED_HOSTS = ["*"]

# ---------------------------------------------------------------------------
# Database — optionally use SQLite for quick local tests or when offline
# ---------------------------------------------------------------------------

if env.bool("USE_SQLITE", default=False):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "local-dev-cache",
        }
    }
else:
    import os
    # When running on host machine outside Docker, translate internal Docker container hostnames to localhost
    if not os.path.exists("/.dockerenv"):
        if DATABASES.get("default", {}).get("HOST") == "postgres":
            DATABASES["default"]["HOST"] = "localhost"
        if "django-redis-cache" in CACHES.get("default", {}).get("LOCATION", ""):
            CACHES["default"]["LOCATION"] = "redis://localhost:6380/0"


# ---------------------------------------------------------------------------
# CORS — allow all origins in dev
# ---------------------------------------------------------------------------

CORS_ALLOW_ALL_ORIGINS = True

# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------

COOKIE_SECURE = False
COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = False
CSRF_COOKIE_SAMESITE = "Lax"

# ---------------------------------------------------------------------------
# Email — print to console instead of sending
# ---------------------------------------------------------------------------

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# ---------------------------------------------------------------------------
# DRF — enable browsable API in dev
# ---------------------------------------------------------------------------

REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
}
