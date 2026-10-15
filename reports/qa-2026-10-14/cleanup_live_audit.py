import json
from django.db import transaction
from django.core.cache import cache
from apps.users.models import User
from apps.problems.models import Problem
from apps.contests.models import Contest
from apps.submissions.models import Submission
from apps.code_drafts.models import CodeDraft

prefix = 'qaaudit_20261014_'
users = User.objects.filter(username__startswith=prefix)
problems = Problem.objects.filter(created_by__in=users)
contests = Contest.objects.filter(created_by__in=users)
# Refuse cleanup if another account has interacted with these temporary records.
if User.objects.filter(faculty__in=users).exclude(username__startswith=prefix).exists():
    raise RuntimeError('Non-audit students linked to an audit faculty; cleanup stopped.')
if problems.exclude(title__startswith='QA temporary').exists() or contests.exclude(name__startswith='QA temporary').exists():
    raise RuntimeError('Unexpected content linked to audit accounts; cleanup stopped.')
if Submission.objects.filter(problem__in=problems).exclude(user__in=users).exists():
    raise RuntimeError('Non-audit submissions reference audit problems; cleanup stopped.')
if CodeDraft.objects.filter(problem__in=problems).exclude(user__in=users).exists():
    raise RuntimeError('Non-audit drafts reference audit problems; cleanup stopped.')
if problems.filter(assigned_students__isnull=False).exclude(assigned_students__in=users).exists():
    raise RuntimeError('Non-audit assignments reference audit problems; cleanup stopped.')
if contests.filter(assigned_students__isnull=False).exclude(assigned_students__in=users).exists():
    raise RuntimeError('Non-audit assignments reference audit contests; cleanup stopped.')
counts = {'users': users.count(), 'problems': problems.count(), 'contests': contests.count(),
          'submissions': Submission.objects.filter(user__in=users).count(),
          'drafts': CodeDraft.objects.filter(user__in=users).count()}
with transaction.atomic():
    total, details = users.delete()
cache.delete('faculty_subjects_list')
print(json.dumps({'temporary_records_before_cleanup': counts, 'deleted_rows_including_related': total,
                  'remaining_audit_users': User.objects.filter(username__startswith=prefix).count()}))
