import json
from pathlib import Path
from datetime import timedelta
from django.utils import timezone
from apps.users.models import User
from apps.problems.models import Problem, TestCase, SampleIO
from apps.contests.models import Contest
from django.core.cache import cache

PREFIX="qaaudit_20261014_"
PASSWORD="QaAuditRun-42!temporary"
if User.objects.filter(username__startswith=PREFIX).exists():
    raise RuntimeError("Audit accounts already exist; inspect before creating more.")
users={}
for role in ["admin","faculty","student"]:
    users[role]=User.objects.create_user(username=PREFIX+role,password=PASSWORD,role=role,email=PREFIX+role+"@example.test",
        profile_name="QA "+role.title(),is_approved=True,first_time_login=False,branch="cspit-it",semester=6,batch="a1",subject="QA test subject" if role=="faculty" else "")
users["student"].student_id=PREFIX+"22it001"
users["student"].faculty=users["faculty"]
users["student"].save()
problem=Problem.objects.create(title="QA temporary Pair Sum",description="Read two integers and print their sum.",created_by=users["faculty"],input_format="Two integers",output_format="Their sum",total_marks=20,difficulty="easy")
problem.assigned_students.add(users["student"])
SampleIO.objects.create(problem=problem,input="2 3",output="5")
TestCase.objects.create(problem=problem,inputs="2 3",outputs="5",marks=10,cpu_time_limit=1,memory_limit=128,is_hidden=False)
TestCase.objects.create(problem=problem,inputs="4 5",outputs="9",marks=10,cpu_time_limit=1,memory_limit=128,is_hidden=True,order=1)
now=timezone.now()
contest=Contest.objects.create(name="QA temporary active assessment",description="QA end-to-end verification",created_by=users["faculty"],start_time=now-timedelta(hours=1),end_time=now+timedelta(hours=2))
contest.problems.add(problem);contest.assigned_students.add(users["student"])
data={"prefix":PREFIX,"password":PASSWORD,"users":{r:{"id":str(u.id),"username":u.username,"email":u.email} for r,u in users.items()},"problemId":str(problem.id),"contestId":str(contest.id)}
Path("/tmp/codify-live-audit-fixtures.json").write_text(json.dumps(data))
cache.delete("faculty_subjects_list")
print("Created three temporary audit accounts, one problem and one assessment.")
