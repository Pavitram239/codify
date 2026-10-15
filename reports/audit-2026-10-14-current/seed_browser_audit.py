import os, json
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "audit_settings")
import django
django.setup()
from pathlib import Path
from django.utils import timezone
from datetime import timedelta
from apps.users.models import User, AccessRole, AccessPermission
from apps.problems.models import Problem, SampleIO, TestCase
from apps.contests.models import Contest
from apps.submissions.models import Submission, TestCaseResult
password="AuditPreview842!"
admin=User.objects.create_superuser(username="audit.admin", password=password, email="audit.admin@example.test", profile_name="Audit Administrator")
teacher=User.objects.create_user(username="audit.faculty",password=password,role="faculty",email="audit.faculty@example.test",profile_name="Audit Faculty",is_approved=True,first_time_login=False,subject="Programming Fundamentals")
other=User.objects.create_user(username="audit.otherfaculty",password=password,role="faculty",email="audit.otherfaculty@example.test",is_approved=True,first_time_login=False)
student=User.objects.create_user(username="audit.student",password=password,role="student",email="audit.student@example.test",student_id="audit24it001",profile_name="Audit Student",faculty=teacher,is_approved=True,first_time_login=False)
limited=User.objects.create_user(username="audit.author",password=password,role="faculty",email="audit.author@example.test",is_approved=True,first_time_login=False)
limited.access_roles.clear(); limited.direct_permissions.add(*AccessPermission.objects.filter(code__in=["problems.create","problems.view_shared","problems.edit_own"]))
for index in range(14):
    User.objects.create_user(username=f"audit.student{index+2}",password=password,role="student",email=f"student{index+2}@example.test",student_id=f"audit24it{index+2:03}",profile_name=("Student With A Very Long Name For Layout Testing " if index==0 else "Audit Student ")+str(index+2),faculty=teacher if index%2 else other,is_approved=True,first_time_login=False,semester=6,batch="a1")
problem=Problem.objects.create(title="Audit Pair Sum",description="Read two integers and output their sum.",input_format="Two space-separated integers.",output_format="Their sum.",constraints="0 <= a, b <= 100",created_by=teacher,total_marks=20)
problem.assigned_students.add(student)
SampleIO.objects.create(problem=problem,input="2 3",output="5")
TestCase.objects.create(problem=problem,inputs="2 3",outputs="5",marks=10,is_hidden=False,cpu_time_limit=2,memory_limit=128)
TestCase.objects.create(problem=problem,inputs="10 20",outputs="30",marks=10,is_hidden=True,cpu_time_limit=2,memory_limit=128,order=1)
private=Problem.objects.create(title="Audit private problem",description="Private",created_by=other)
now=timezone.now()
contest=Contest.objects.create(name="Audit coding assessment with a longer title",description="Complete the assigned problem.",created_by=teacher,start_time=now-timedelta(hours=1),end_time=now+timedelta(hours=3))
contest.problems.add(problem); contest.assigned_students.add(student)
submission=Submission.objects.create(user=student,problem=problem,code="a,b=map(int,input().split());print(a+b)",language="python",status="completed",total_marks=20,number_of_test_cases=2,number_of_test_cases_pass=2)
TestCaseResult.objects.create(submission=submission,input="2 3",output="5",expected_output="5",passed=True,marks=10)
TestCaseResult.objects.create(submission=submission,input="10 20",output="30",expected_output="30",passed=True,marks=10,is_hidden=True,order=1)
reviewer=AccessRole.objects.create(name="Teaching Assistant With A Long Role Name",description="A sample role for checking long content and independent module permissions.")
reviewer.permissions.add(AccessPermission.objects.get(code="problems.create"))
student.access_roles.add(reviewer)
ids={"admin":str(admin.pk),"faculty":str(teacher.pk),"student":str(student.pk),"author":str(limited.pk),"problem":str(problem.pk),"contest":str(contest.pk),"submission":str(submission.pk),"private":str(private.pk)}
Path("../reports/audit-2026-10-14-current/evidence/browser-fixtures.json").write_text(json.dumps(ids,indent=2))
print("Isolated browser audit fixtures created.")
