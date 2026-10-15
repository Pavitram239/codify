import logging
from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from celery import shared_task
from django.db import transaction

from apps.execution.services import Judge0Client
from apps.submissions.models import Submission, TestCaseResult
from apps.users.models import User

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def process_submission_async(self, submission_id: str):
    """
    Celery background worker task to evaluate a code submission against Judge0 asynchronously.
    """
    try:
        submission = Submission.objects.select_related("problem", "user").get(id=submission_id)
    except Submission.DoesNotExist:
        logger.error(f"Submission {submission_id} not found.")
        return {"error": "Submission not found"}

    problem = submission.problem
    test_cases = list(problem.test_cases.all().order_by("order"))

    if not test_cases:
        submission.status = "rejected"
        submission.save()
        return {"error": "No test cases found for problem"}

    judge_client = Judge0Client()

    try:
        results = judge_client.execute_test_cases(submission.code, submission.language, test_cases)
        total_marks = sum(res.get("marks", 0) for res in results)
        passed_count = sum(bool(res.get("passed")) for res in results)
        total_count = len(results)
        execution_time = sum(float(res.get("time") or 0) for res in results) * 1000
        memory_usage = sum(float(res.get("memory") or 0) for res in results) / total_count / 1024 if total_count else 0

        with transaction.atomic():
            # Clear previous results if any
            submission.test_case_results.all().delete()

            for order, res in enumerate(results):
                TestCaseResult.objects.create(
                    submission=submission,
                    input=res.get("input", ""),
                    output=res.get("output", ""),
                    expected_output=res.get("expectedOutput", ""),
                    passed=res.get("passed", False),
                    time=res.get("time", 0.0),
                    memory=res.get("memory", 0.0),
                    is_hidden=res.get("is_hidden", False),
                    marks=res.get("marks", 0),
                    order=order,
                )

            submission.execution_time = round(execution_time, 2)
            submission.memory_usage = round(memory_usage, 2)
            submission.number_of_test_cases_pass = passed_count
            submission.number_of_test_cases = total_count
            submission.total_marks = total_marks
            submission.status = "completed" if passed_count == total_count else "rejected"
            submission.save()

        return {
            "submission_id": str(submission.id),
            "status": submission.status,
            "passed": passed_count,
            "total": total_count,
            "total_marks": total_marks,
        }

    except Exception as exc:
        logger.error(f"Error processing submission {submission_id}: {exc}")
        if self.request.retries >= self.max_retries:
            submission.status = "rejected"
            submission.save()
            return {"error": str(exc)}
        raise self.retry(exc=exc)


@shared_task
def cleanup_expired_sessions():
    """
    Periodic task to clean up old or stale user sessions (replaces node-cron).
    """
    cutoff = timezone.now() - settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"]
    stale_users = User.objects.filter(
        session_id__isnull=False,
    ).filter(Q(last_login_time__lte=cutoff) | Q(last_login_time__isnull=True))
    count = stale_users.count()
    stale_users.update(session_id=None)
    logger.info(f"Cleaned up {count} expired user sessions.")
    return {"cleaned_sessions": count}
