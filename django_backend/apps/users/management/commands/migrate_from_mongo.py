"""
Management command to migrate data from MongoDB to PostgreSQL.

Usage:
    python manage.py migrate_from_mongo --mongo-uri="mongodb+srv://..." --db-name="assessment"
    python manage.py migrate_from_mongo --dry-run
"""

import os
import uuid
from datetime import datetime, timezone as dt_timezone
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.conf import settings

from apps.users.models import User
from apps.problems.models import Problem, SampleIO, TestCase
from apps.contests.models import Contest
from apps.submissions.models import Submission, TestCaseResult
from apps.code_drafts.models import CodeDraft

NAMESPACE = uuid.NAMESPACE_OID


def mongo_id_to_uuid(mongo_id):
    """Converts a MongoDB ObjectId (or string) deterministically to a UUID."""
    if not mongo_id:
        return None
    return uuid.uuid5(NAMESPACE, str(mongo_id))


def parse_date(val):
    if not val:
        return timezone.now()
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=dt_timezone.utc)
        return val
    try:
        dt = datetime.fromisoformat(str(val).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            return dt.replace(tzinfo=dt_timezone.utc)
        return dt
    except Exception:
        return timezone.now()


class Command(BaseCommand):
    help = "Migrate collections from MongoDB to Django PostgreSQL models"

    def add_arguments(self, parser):
        parser.add_argument(
            "--mongo-uri",
            type=str,
            default=os.getenv("MONGO_URI", "mongodb://localhost:27017/assessment"),
            help="MongoDB connection URI",
        )
        parser.add_argument(
            "--db-name",
            type=str,
            default="",
            help="MongoDB database name (defaults to database in URI or 'assessment')",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate the migration without writing changes to the database",
        )

    def handle(self, *args, **options):
        try:
            import pymongo
        except ImportError:
            raise CommandError("pymongo is not installed. Please install it using: pip install pymongo")

        mongo_uri = options["mongo_uri"]
        db_name = options["db_name"]
        dry_run = options["dry_run"]

        self.stdout.write(self.style.NOTICE(f"Connecting to MongoDB: {mongo_uri}"))

        try:
            client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
            # Test connection
            client.server_info()
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Could not connect to MongoDB: {e}"))
            return

        if not db_name:
            # Try to get default database from URI
            try:
                db = client.get_default_database()
            except Exception:
                db = client["assessment"]
        else:
            db = client[db_name]

        self.stdout.write(self.style.SUCCESS(f"Connected to MongoDB database: {db.name}"))
        if dry_run:
            self.stdout.write(self.style.WARNING("Running in DRY-RUN mode. No changes will be committed."))

        # ── 1. Migrate Users ──────────────────────────────────────────────────
        self.stdout.write(self.style.NOTICE("Migrating Users collection..."))
        mongo_users = list(db["users"].find())
        self.stdout.write(f"Found {len(mongo_users)} users in MongoDB.")

        user_id_map = {}  # str(mongo_id) -> pg_uuid
        user_ident_map = {}  # student_id or username -> User object

        for doc in mongo_users:
            m_id = str(doc["_id"])
            pg_id = mongo_id_to_uuid(m_id)
            user_id_map[m_id] = pg_id

            student_id = doc.get("id") or None
            username = doc.get("username") or str(pg_id)[:8]
            email = doc.get("email") or None
            mobile_no = doc.get("mobileNo") or ""
            role = doc.get("role", "student")
            branch = doc.get("branch", "cspit-it")
            semester = doc.get("semester", 1) or 1
            batch = doc.get("batch", "a1") or "a1"
            subject = doc.get("subject", "") or ""
            is_approved = doc.get("isApproved", False)
            first_time_login = doc.get("firstTimeLogin", True)
            created_at = parse_date(doc.get("createdAt"))
            updated_at = parse_date(doc.get("updatedAt"))

            # Profile fields
            prof = doc.get("profile", {}) or {}
            profile_name = prof.get("name") or doc.get("name") or ""
            profile_bio = prof.get("bio") or ""
            profile_github = prof.get("github") or ""
            profile_linkedin = prof.get("linkedIn") or ""
            profile_birthday = prof.get("birthday") or ""
            profile_gender = prof.get("gender") or ""
            profile_skills = prof.get("skills") or ""
            profile_education = prof.get("education") or ""
            profile_location = prof.get("location") or ""

            raw_password = doc.get("password", "")

            if not dry_run:
                user, _ = User.objects.update_or_create(
                    id=pg_id,
                    defaults={
                        "student_id": student_id,
                        "username": username,
                        "email": email,
                        "mobile_no": mobile_no,
                        "role": role,
                        "branch": branch,
                        "semester": int(semester) if str(semester).isdigit() else 1,
                        "batch": batch,
                        "subject": subject,
                        "is_approved": is_approved,
                        "first_time_login": first_time_login,
                        "password": raw_password,  # Store hash (bcrypt compatible)
                        "profile_name": profile_name,
                        "profile_bio": profile_bio,
                        "profile_github": profile_github,
                        "profile_linkedin": profile_linkedin,
                        "profile_birthday": profile_birthday,
                        "profile_gender": profile_gender,
                        "profile_skills": profile_skills,
                        "profile_education": profile_education,
                        "profile_location": profile_location,
                        "created_at": created_at,
                        "updated_at": updated_at,
                    }
                )
                user_ident_map[m_id] = user
                if student_id:
                    user_ident_map[student_id] = user
                user_ident_map[username] = user

        # Associate faculty references
        if not dry_run:
            for doc in mongo_users:
                m_faculty_id = doc.get("facultyId")
                if m_faculty_id and str(m_faculty_id) in user_id_map:
                    faculty_uuid = user_id_map[str(m_faculty_id)]
                    User.objects.filter(id=user_id_map[str(doc["_id"])]).update(faculty_id=faculty_uuid)

        self.stdout.write(self.style.SUCCESS(f"Migrated {len(mongo_users)} users."))

        # ── 2. Migrate Problems ───────────────────────────────────────────────
        self.stdout.write(self.style.NOTICE("Migrating Problems collection..."))
        mongo_problems = list(db["problems"].find())
        self.stdout.write(f"Found {len(mongo_problems)} problems in MongoDB.")

        problem_id_map = {}

        for doc in mongo_problems:
            m_id = str(doc["_id"])
            pg_id = mongo_id_to_uuid(m_id)
            problem_id_map[m_id] = pg_id

            title = doc.get("title") or doc.get("name") or "Untitled Problem"
            description = doc.get("description", "")
            difficulty = doc.get("difficulty", "easy")
            input_format = doc.get("inputFormat", "")
            output_format = doc.get("outputFormat", "")
            constraints = doc.get("constraints", "")
            tags = doc.get("tags", [])
            total_marks = doc.get("totalMarks", 100) or 100
            created_at = parse_date(doc.get("createdAt"))
            updated_at = parse_date(doc.get("updatedAt"))

            created_by_id = None
            if doc.get("createdBy") and str(doc["createdBy"]) in user_id_map:
                created_by_id = user_id_map[str(doc["createdBy"])]
            elif doc.get("created_by") and str(doc["created_by"]) in user_id_map:
                created_by_id = user_id_map[str(doc["created_by"])]

            if not dry_run:
                problem, _ = Problem.objects.update_or_create(
                    id=pg_id,
                    defaults={
                        "title": title,
                        "description": description,
                        "difficulty": difficulty,
                        "input_format": input_format,
                        "output_format": output_format,
                        "constraints": constraints,
                        "tags": tags if isinstance(tags, list) else [],
                        "total_marks": int(total_marks),
                        "created_by_id": created_by_id,
                        "created_at": created_at,
                        "updated_at": updated_at,
                    }
                )

                # Migrate SampleIO
                problem.sample_io.all().delete()
                for idx, sio in enumerate(doc.get("sampleIO", [])):
                    SampleIO.objects.create(
                        problem=problem,
                        input=sio.get("input", ""),
                        output=sio.get("output", ""),
                        order=idx + 1,
                    )

                # Migrate TestCases
                problem.test_cases.all().delete()
                for idx, tc in enumerate(doc.get("testCases", [])):
                    TestCase.objects.create(
                        problem=problem,
                        inputs=tc.get("inputs", "") or tc.get("input", ""),
                        outputs=tc.get("outputs", "") or tc.get("output", ""),
                        marks=int(tc.get("marks", 0) or 0),
                        cpu_time_limit=max(1, min(15, int(tc.get("cpu_time_limit", 2) or 2))),
                        memory_limit=max(1, min(256, int(tc.get("memory_limit", 128) or 128))),
                        is_hidden=bool(tc.get("is_hidden", False) or tc.get("isHidden", False)),
                        order=idx + 1,
                    )

                # Assigned students
                assigned = doc.get("assignedStudents", [])
                if assigned:
                    assigned_uuids = [user_id_map[str(s)] for s in assigned if str(s) in user_id_map]
                    problem.assigned_students.set(assigned_uuids)

        self.stdout.write(self.style.SUCCESS(f"Migrated {len(mongo_problems)} problems."))

        # ── 3. Migrate Contests ───────────────────────────────────────────────
        self.stdout.write(self.style.NOTICE("Migrating Contests collection..."))
        mongo_contests = list(db["contests"].find())
        self.stdout.write(f"Found {len(mongo_contests)} contests in MongoDB.")

        for doc in mongo_contests:
            m_id = str(doc["_id"])
            pg_id = mongo_id_to_uuid(m_id)

            name = doc.get("name", "Contest")
            description = doc.get("description", "")
            start_time = parse_date(doc.get("start_time"))
            end_time = parse_date(doc.get("end_time"))
            status = doc.get("status", "upcoming")
            created_at = parse_date(doc.get("createdAt"))
            updated_at = parse_date(doc.get("updatedAt"))

            created_by_id = None
            if doc.get("created_by") and str(doc["created_by"]) in user_id_map:
                created_by_id = user_id_map[str(doc["created_by"])]

            if not dry_run and created_by_id:
                contest, _ = Contest.objects.update_or_create(
                    id=pg_id,
                    defaults={
                        "name": name,
                        "description": description,
                        "created_by_id": created_by_id,
                        "start_time": start_time,
                        "end_time": end_time,
                        "status": status,
                        "created_at": created_at,
                        "updated_at": updated_at,
                    }
                )

                problems = doc.get("problems", [])
                if problems:
                    prob_uuids = [problem_id_map[str(p)] for p in problems if str(p) in problem_id_map]
                    contest.problems.set(prob_uuids)

                assigned = doc.get("assignedStudents", [])
                if assigned:
                    assigned_uuids = [user_id_map[str(s)] for s in assigned if str(s) in user_id_map]
                    contest.assigned_students.set(assigned_uuids)

        self.stdout.write(self.style.SUCCESS(f"Migrated {len(mongo_contests)} contests."))

        # ── 4. Migrate Submissions ────────────────────────────────────────────
        self.stdout.write(self.style.NOTICE("Migrating Submissions collection..."))
        mongo_submissions = list(db["submissions"].find())
        self.stdout.write(f"Found {len(mongo_submissions)} submissions in MongoDB.")

        for doc in mongo_submissions:
            m_id = str(doc["_id"])
            pg_id = mongo_id_to_uuid(m_id)

            m_user_id = str(doc.get("user_id") or doc.get("userId"))
            m_problem_id = str(doc.get("problem_id") or doc.get("problemId"))

            if m_user_id not in user_id_map or m_problem_id not in problem_id_map:
                continue

            user_uuid = user_id_map[m_user_id]
            prob_uuid = problem_id_map[m_problem_id]

            code = doc.get("code", "")
            language = doc.get("language", "python")
            sub_status = doc.get("status", "pending")
            exec_time = float(doc.get("execution_time", 0.0) or 0.0)
            mem_usage = float(doc.get("memory_usage", 0.0) or 0.0)
            num_tc = int(doc.get("number_of_test_cases", 0) or 0)
            num_tc_pass = int(doc.get("number_of_test_cases_pass", 0) or 0)
            total_marks = int(doc.get("totalMarks", 0) or doc.get("total_marks", 0) or 0)
            created_at = parse_date(doc.get("createdAt"))
            updated_at = parse_date(doc.get("updatedAt"))

            if not dry_run:
                submission, _ = Submission.objects.update_or_create(
                    id=pg_id,
                    defaults={
                        "user_id": user_uuid,
                        "problem_id": prob_uuid,
                        "code": code,
                        "language": language,
                        "status": sub_status,
                        "execution_time": exec_time,
                        "memory_usage": mem_usage,
                        "number_of_test_cases": num_tc,
                        "number_of_test_cases_pass": num_tc_pass,
                        "total_marks": total_marks,
                        "created_at": created_at,
                        "updated_at": updated_at,
                    }
                )

                # Migrate test cases results
                submission.test_case_results.all().delete()
                for idx, tcr in enumerate(doc.get("test_cases_results", [])):
                    TestCaseResult.objects.create(
                        submission=submission,
                        input=tcr.get("input", ""),
                        output=tcr.get("output", ""),
                        expected_output=tcr.get("expected_output", "") or tcr.get("expectedOutput", ""),
                        passed=bool(tcr.get("passed", False)),
                        time=float(tcr.get("time", 0.0) or 0.0),
                        memory=float(tcr.get("memory", 0.0) or 0.0),
                        is_hidden=bool(tcr.get("is_hidden", False) or tcr.get("isHidden", False)),
                        marks=int(tcr.get("marks", 0) or 0),
                        order=idx + 1,
                    )

        self.stdout.write(self.style.SUCCESS(f"Migrated {len(mongo_submissions)} submissions."))

        # ── 5. Migrate Code Drafts ────────────────────────────────────────────
        self.stdout.write(self.style.NOTICE("Migrating Code drafts collection..."))
        mongo_codes = list(db["codes"].find())
        self.stdout.write(f"Found {len(mongo_codes)} code drafts in MongoDB.")

        for doc in mongo_codes:
            m_user_id = str(doc.get("userId"))
            m_problem_id = str(doc.get("problemId"))

            if m_user_id not in user_id_map or m_problem_id not in problem_id_map:
                continue

            user_uuid = user_id_map[m_user_id]
            prob_uuid = problem_id_map[m_problem_id]
            code = doc.get("code", "")
            language = doc.get("language", "python")

            if not dry_run:
                draft, _ = CodeDraft.objects.get_or_create(
                    user_id=user_uuid,
                    problem_id=prob_uuid,
                )
                if "codeByLanguage" in doc and isinstance(doc["codeByLanguage"], dict):
                    draft.code_by_language.update(doc["codeByLanguage"])
                else:
                    lang = (doc.get("language") or "python").lower()
                    code = doc.get("code", "")
                    draft.code_by_language[lang] = code
                draft.save()

        self.stdout.write(self.style.SUCCESS(f"Migrated {len(mongo_codes)} code drafts."))
        self.stdout.write(self.style.SUCCESS("MongoDB to PostgreSQL Migration Complete!"))
