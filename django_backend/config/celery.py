"""
Celery application configuration.

Celery is used for:
  - Phase 11: Periodic session cleanup (replaces node-cron)
  - Future: Async submission processing
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")

app = Celery("code_assessment")

# Read Celery config from Django settings (keys prefixed with CELERY_)
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in all INSTALLED_APPS
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Diagnostic task — used to verify Celery is running."""
    print(f"Request: {self.request!r}")
