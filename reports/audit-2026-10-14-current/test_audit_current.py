import json
from pathlib import Path
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import pytest
from django.db import connection, close_old_connections
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from apps.users.models import User, AccessRole, AccessPermission
from apps.problems.models import Problem
from apps.contests.models import Contest

pytestmark=pytest.mark.django_db
results=[]
@pytest.fixture(scope="session",autouse=True)
def save():
    yield
    Path("/tmp/current-audit-probes.json").write_text(json.dumps(results,indent=2,default=str))
@pytest.fixture(autouse=True)
def settings_override(settings):
    settings.PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"]
    settings.CACHES={"default":{"BACKEND":"django.core.cache.backends.locmem.LocMemCache"}}
@pytest.fixture
def actors():
    a=User.objects.create_user(username="probe-admin",role="admin",password="AuditPassword42!",is_approved=True,first_time_login=False)
    t=User.objects.create_user(username="probe-teacher",role="faculty",password="AuditPassword42!",is_approved=True,first_time_login=False)
    o=User.objects.create_user(username="probe-other",role="faculty",is_approved=True)
    s=User.objects.create_user(username="probe-own",role="student",faculty=t,is_approved=True)
    f=User.objects.create_user(username="probe-foreign",role="student",faculty=o,email="foreign@example.test",is_approved=True)
    return a,t,o,s,f

def api(u):
    c=APIClient();c.raise_request_exception=False;c.force_authenticate(u);return c

def record(code,**data):results.append(dict(id=code,**data))

@pytest.mark.parametrize("account",["faculty","admin"])
def test_revocation(actors,account):
    a,t,*_=actors;u=t if account=="faculty" else a
    u.session_id="old-session";u.save(update_fields=["session_id"])
    token=RefreshToken.for_user(u);token["sessionId"]="old-session";jwt=str(token.access_token)
    revoked=api(a).post("/api/v1/admin/terminate-session",{"userId":str(u.pk)},format="json")
    c=APIClient();c.credentials(HTTP_AUTHORIZATION="Bearer "+jwt)
    r=c.get("/api/v1/auth/get-current-user")
    record("AUTH-REVOKE-"+account,termination=revoked.status_code,old_token=r.status_code,expected=401)
    assert r.status_code==401

@pytest.mark.parametrize("module",["problems","contests"])
def test_student_directory_scope(actors,module):
    a,t,o,s,f=actors;t.access_roles.clear();t.direct_permissions.add(AccessPermission.objects.get(code=module+".assign_shared"))
    if module=="problems":
        p=Problem.objects.create(title="Owned",description="A",created_by=t);url=f"/api/v1/problems/{p.pk}/unassignStudent"
    else:
        p=Contest.objects.create(name="Owned",description="A",created_by=t,start_time=timezone.now(),end_time=timezone.now()+timedelta(hours=1));url=f"/api/v1/contests/{p.pk}/unassignedStudents"
    r=api(t).get(url);entries=r.data.get("unassignedStudents",[])
    exposed=any(x.get("username")==f.username for x in entries)
    record("SCOPE-DIRECTORY-"+module,http=r.status_code,foreign_student_exposed=exposed,user_directory_permission=False,entries=len(entries))
    assert r.status_code==200 and not exposed


def test_user_list_queries(actors):
    a,*_=actors
    for n in range(25):User.objects.create_user(username=f"query-user-{n}",role="student",is_approved=True)
    with CaptureQueriesContext(connection) as small:api(a).get("/api/v1/access/users",{"limit":1})
    with CaptureQueriesContext(connection) as large:r=api(a).get("/api/v1/access/users",{"limit":20})
    record("PERF-USER-LIST",one_user_queries=len(small),twenty_user_queries=len(large),http=r.status_code)
    assert r.status_code==200 and len(large)<=len(small)+10


def test_throttling(settings):
    from apps.execution.views import RunCodeView
    classes=settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_CLASSES",[])
    record("PERF-EXECUTION-LIMIT",default_throttles=classes,view_throttles=[str(c) for c in RunCodeView.throttle_classes])
    assert classes or RunCodeView.throttle_classes

@pytest.mark.parametrize("endpoint",["execution","submissions"])
def test_bad_uuids(actors,endpoint):
    _,t,*_=actors;c=api(t)
    r=c.post("/api/v1/compiler/run-code",{"code":"print(1)","language":"python","problemId":"not-a-uuid"},format="json") if endpoint=="execution" else c.get("/api/v1/submissions/problem",{"problem_id":"not-a-uuid"})
    record("VALIDATION-ID-"+endpoint,http=r.status_code,expected=400)
    assert r.status_code==400

@pytest.mark.django_db(transaction=True)
def test_concurrent_managers():
    from apps.users.access_catalog import CATALOG
    for code,(module,label) in CATALOG.items():AccessPermission.objects.get_or_create(code=code,defaults={"module":module,"label":label})
    permission=AccessPermission.objects.get(code="access.manage")
    users=[User.objects.create_user(username="concurrent-"+str(n),role="faculty",is_approved=True) for n in range(2)]
    for u in users:u.direct_permissions.add(permission)
    barrier=Barrier(2)
    def revoke(identifier):
        close_old_connections();u=User.objects.get(pk=identifier);c=api(u);barrier.wait(timeout=10)
        r=c.put(f"/api/v1/access/users/{identifier}",{"roles":[],"permissions":[]},format="json")
        close_old_connections();return r.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:status=list(pool.map(revoke,[u.pk for u in users]))
    remaining=User.objects.filter(is_active=True,is_approved=True,direct_permissions=permission).count()
    record("CONCURRENCY-LAST-MANAGER",statuses=status,remaining=remaining)
    assert sorted(status)==[200,400] and remaining==1
