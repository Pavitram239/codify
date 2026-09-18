import logging
from datetime import timedelta
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
        results, total_marks, passed_count, total_count, max_time, max_memory = (
            judge_client.execute_test_cases(submission.code, submission.language, test_cases)
        )

        with transaction.atomic():
            # Clear previous results if any
            submission.test_case_results.all().delete()

            for res in results:
                TestCaseResult.objects.create(
                    submission=submission,
                    input=res.get("input", ""),
                    output=res.get("output", ""),
                    expected_output=res.get("expectedOutput", ""),
                    passed=res.get("passed", False),
                    time=res.get("time", 0.0),
                    memory=res.get("memory", 0.0),
                    is_hidden=res.get("isHidden", False),
                    marks=res.get("marks", 0),
                    order=res.get("order", 0),
                )

            submission.execution_time = max_time
            submission.memory_usage = max_memory
            submission.number_of_test_cases_pass = passed_count
            submission.number_of_test_cases = total_count
            submission.total_marks = total_marks
            submission.status = "completed"
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
        try:
            self.retry(exc=exc)
        except Exception:
            submission.status = "rejected"
            submission.save()
            return {"error": str(exc)}


@shared_task
def cleanup_expired_sessions():
    """
    Periodic task to clean up old or stale user sessions (replaces node-cron).
    """
    cutoff = timezone.now() - timedelta(days=7)
    stale_users = User.objects.filter(
        session_id__isnull=False,
        last_login_time__lt=cutoff,
    )
    count = stale_users.count()
    stale_users.update(session_id=None)
    logger.info(f"Cleaned up {count} expired user sessions.")
    return {"cleaned_sessions": count}
