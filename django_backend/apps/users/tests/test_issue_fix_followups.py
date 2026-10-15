from unittest.mock import patch
from types import SimpleNamespace
import pytest
from rest_framework.test import APIClient
from django.db import IntegrityError, transaction
from django.urls import reverse
from apps.users.models import User
from apps.execution.services import Judge0Client

pytestmark=pytest.mark.django_db


def test_signup_password_is_preserved_at_approval():
    client=APIClient()
    password='ChosenSignupSecret-572!'
    response=client.post(reverse('auth-register'), {'role':'faculty','username':'chosen-faculty','email':'chosen@example.test','password':password},format='json')
    assert response.status_code==201
    user=User.objects.get(username='chosen-faculty')
    admin=User.objects.create_user(username='approval-admin',role='admin',is_approved=True)
    client.force_authenticate(admin)
    response=client.post(reverse('admin-accept-request'),{'userId':str(user.pk)},format='json')
    assert response.status_code==200
    assert response.data['temporaryPasswords']==[]
    user.refresh_from_db()
    assert user.check_password(password)
    assert not user.check_password('chosen')


def test_case_insensitive_email_uniqueness_is_enforced_by_database():
    User.objects.create_user(username='first',email='Duplicate@example.test')
    with pytest.raises(IntegrityError), transaction.atomic():
        User.objects.create_user(username='second',email='duplicate@example.test')


def test_resource_budget_is_forwarded_without_relaxation_and_missing_status_fails():
    client=Judge0Client()
    case=SimpleNamespace(memory_limit=8,cpu_time_limit=1,inputs='',outputs='',marks=10,is_hidden=False)
    with patch.object(client,'submit_one',return_value={'token':'temporary'}) as submit, patch.object(client,'fetch_result',return_value={'stdout':None,'error':None}):
        result=client.execute_test_cases('pass','python',[case])[0]
    assert submit.call_args.args[0]['memory_limit']==8*1024
    assert result['passed'] is False and result['marks']==0


def test_staff_can_issue_secure_initial_password_only_within_scope():
    faculty=User.objects.create_user(username='teacher',role='faculty',is_approved=True)
    other=User.objects.create_user(username='other-teacher',role='faculty',is_approved=True)
    student=User.objects.create_user(username='initial-student',student_id='22it700',password='22it700',role='student',faculty=faculty,is_approved=True,first_time_login=True)
    client=APIClient()
    client.force_authenticate(other)
    assert client.post(reverse('faculty-issue-initial-password'),{'userId':str(student.pk)},format='json').status_code==403
    client.force_authenticate(faculty)
    response=client.post(reverse('faculty-issue-initial-password'),{'userId':str(student.pk)},format='json')
    assert response.status_code==200 and response['Cache-Control']=='no-store'
    password=response.data['temporaryPasswords'][0]['temporaryPassword']
    student.refresh_from_db()
    assert student.check_password(password) and not student.check_password('22it700')
    guest=APIClient()
    response=guest.post(reverse('auth-change-password'),{'id':'22it700','oldPassword':password,'newPassword':'ReplacementSecret-738!'},format='json')
    assert response.status_code==200
    assert guest.post(reverse('auth-change-password'),{'id':'22it700','oldPassword':password,'newPassword':'AnotherSecret-582!'},format='json').status_code==400
    assert client.post(reverse('faculty-issue-initial-password'),{'userId':str(student.pk)},format='json').status_code==400


@pytest.mark.parametrize('identifier', ['not-a-uuid', None, {}])
def test_initial_password_endpoint_validates_identifiers(identifier):
    faculty=User.objects.create_user(username='issue-teacher',role='faculty',is_approved=True)
    client=APIClient()
    client.force_authenticate(faculty)
    assert client.post(reverse('faculty-issue-initial-password'),{'userId':identifier},format='json').status_code==400


def test_bulk_duplicate_rows_are_identified_individually():
    faculty=User.objects.create_user(username='bulk-teacher',role='faculty',is_approved=True)
    client=APIClient()
    client.force_authenticate(faculty)
    row={'id':'22it701','username':'Bulk Student','batch':'a1','semester':6}
    response=client.post(reverse('faculty-bulk-register'),{'facultyId':str(faculty.pk),'students':[row,row]},format='json')
    assert response.status_code==200
    assert response.data['results']['success'][0]['rowIndex']==0
    assert response.data['results']['errors'][0]['rowIndex']==1
    password=response.data['results']['success'][0]['temporaryPassword']
    student=User.objects.get(student_id='22it701')
    assert student.check_password(password) and not student.check_password('22it701')
