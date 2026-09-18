from unittest.mock import MagicMock, patch
from bson import ObjectId
import pytest
from django.core.management import call_command
from apps.users.models import User
from apps.problems.models import Problem
from apps.contests.models import Contest
from apps.submissions.models import Submission
from apps.code_drafts.models import CodeDraft


@pytest.mark.django_db
def test_migrate_from_mongo_command():
    fake_user_id = ObjectId()
    fake_prob_id = ObjectId()
    fake_contest_id = ObjectId()
    fake_sub_id = ObjectId()

    mock_db = {
        "users": [
            {
                "_id": fake_user_id,
                "username": "mongouser",
                "id": "22IT100",
                "email": "mongouser@charusat.edu.in",
                "role": "student",
                "isApproved": True,
                "firstTimeLogin": False,
                "password": "hashed_password",
                "profile": {
                    "name": "Mongo Student",
                    "bio": "Coding enthusiast",
                },
            }
        ],
        "problems": [
            {
                "_id": fake_prob_id,
                "title": "Mongo Problem",
                "description": "Solve this",
                "difficulty": "easy",
                "inputFormat": "text",
                "outputFormat": "text",
                "constraints": "none",
                "tags": ["array"],
                "totalMarks": 100,
                "createdBy": fake_user_id,
                "sampleIO": [{"input": "1", "output": "1"}],
                "testCases": [{"inputs": "1", "outputs": "1", "marks": 100, "cpu_time_limit": 2, "memory_limit": 128}],
                "assignedStudents": [fake_user_id],
            }
        ],
        "contests": [
            {
                "_id": fake_contest_id,
                "name": "Mongo Contest",
                "description": "A contest from mongo",
                "start_time": "2026-09-01T00:00:00Z",
                "end_time": "2026-09-02T00:00:00Z",
                "created_by": fake_user_id,
                "problems": [fake_prob_id],
                "assignedStudents": [fake_user_id],
            }
        ],
        "submissions": [
            {
                "_id": fake_sub_id,
                "user_id": fake_user_id,
                "problem_id": fake_prob_id,
                "code": "print('hello')",
                "language": "python",
                "status": "completed",
                "total_marks": 100,
                "test_cases_results": [
                    {
                        "input": "1",
                        "output": "1",
                        "expected_output": "1",
                        "passed": True,
                        "marks": 100,
                    }
                ],
            }
        ],
        "codes": [
            {
                "userId": fake_user_id,
                "problemId": fake_prob_id,
                "code": "print('draft')",
                "language": "python",
            }
        ],
    }

    mock_client = MagicMock()
    mock_client.server_info.return_value = {"version": "6.0.0"}
    mock_client.get_default_database.return_value = MagicMock()
    mock_client.__getitem__.side_effect = lambda name: mock_db_wrapper

    class MockCollection:
        def __init__(self, data):
            self.data = data

        def find(self):
            return self.data

    class MockDB:
        def __init__(self, collections):
            self.collections = collections
            self.name = "assessment"

        def __getitem__(self, name):
            return MockCollection(self.collections.get(name, []))

    mock_db_wrapper = MockDB(mock_db)
    mock_client.get_default_database.return_value = mock_db_wrapper

    with patch("pymongo.MongoClient", return_value=mock_client):
        call_command("migrate_from_mongo", mongo_uri="mongodb://localhost:27017/assessment")

    # Assert user was imported
    user = User.objects.filter(username="mongouser").first()
    assert user is not None
    assert user.student_id == "22IT100"
    assert user.profile_name == "Mongo Student"

    # Assert problem was imported
    problem = Problem.objects.filter(title="Mongo Problem").first()
    assert problem is not None
    assert problem.sample_io.count() == 1
    assert problem.test_cases.count() == 1
    assert problem.assigned_students.filter(id=user.id).exists()

    # Assert contest was imported
    contest = Contest.objects.filter(name="Mongo Contest").first()
    assert contest is not None
    assert contest.problems.filter(id=problem.id).exists()
    assert contest.assigned_students.filter(id=user.id).exists()

    # Assert submission was imported
    submission = Submission.objects.filter(user=user, problem=problem).first()
    assert submission is not None
    assert submission.total_marks == 100
    assert submission.test_case_results.count() == 1

    # Assert draft was imported
    draft = CodeDraft.objects.filter(user=user, problem=problem).first()
    assert draft is not None
    assert draft.code_by_language["python"] == "print('draft')"
