"""
Management command to seed demo test accounts for Admin, Faculty, and Students.

Usage:
    docker compose exec django-server python manage.py seed_demo_users
    # Or locally on host:
    python manage.py seed_demo_users --settings=config.settings.dev
"""

from django.core.management.base import BaseCommand
from apps.users.models import User


class Command(BaseCommand):
    help = "Seed pre-configured test users (Admin, Faculty, Students) for local testing"

    def handle(self, *args, **options):
        # 1. Admin
        admin, created = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@charusat.edu.in",
                "role": "admin",
                "is_approved": True,
                "first_time_login": False,
                "is_staff": True,
                "is_superuser": True,
            }
        )
        admin.set_password("AdminPassword123!")
        admin.is_approved = True
        admin.first_time_login = False
        admin.is_staff = True
        admin.is_superuser = True
        admin.save()
        self.stdout.write(self.style.SUCCESS(f"{'Created' if created else 'Updated'} Admin: admin / AdminPassword123!"))

        # 2. Faculty 1 (IT Department)
        fac1, created = User.objects.get_or_create(
            username="prof_patel",
            defaults={
                "email": "faculty1@charusat.edu.in",
                "role": "faculty",
                "branch": "cspit-it",
                "subject": "Data Structures & Algorithms",
                "is_approved": True,
                "first_time_login": False,
                "is_staff": False,
            }
        )
        fac1.set_password("Faculty123!")
        fac1.is_approved = True
        fac1.first_time_login = False
        fac1.subject = "Data Structures & Algorithms"
        fac1.save()
        self.stdout.write(self.style.SUCCESS(f"{'Created' if created else 'Updated'} Faculty: prof_patel / Faculty123! (Subject: Data Structures)"))

        # 3. Faculty 2 (CE Department)
        fac2, created = User.objects.get_or_create(
            username="prof_shah",
            defaults={
                "email": "faculty2@charusat.edu.in",
                "role": "faculty",
                "branch": "cspit-ce",
                "subject": "Design & Analysis of Algorithms",
                "is_approved": True,
                "first_time_login": False,
                "is_staff": False,
            }
        )
        fac2.set_password("Faculty123!")
        fac2.is_approved = True
        fac2.first_time_login = False
        fac2.subject = "Design & Analysis of Algorithms"
        fac2.save()
        self.stdout.write(self.style.SUCCESS(f"{'Created' if created else 'Updated'} Faculty: prof_shah / Faculty123! (Subject: DAA)"))

        # 4. Student 1 (IT, 6th Sem, Batch A1)
        st1, created = User.objects.get_or_create(
            username="student_it",
            defaults={
                "student_id": "22it001",
                "email": "22it001@charusat.edu.in",
                "role": "student",
                "branch": "cspit-it",
                "semester": 6,
                "batch": "a1",
                "faculty": fac1,
                "is_approved": True,
                "first_time_login": False,
            }
        )
        st1.set_password("Student123!")
        st1.student_id = "22it001"
        st1.is_approved = True
        st1.first_time_login = False
        st1.faculty = fac1
        st1.save()
        self.stdout.write(self.style.SUCCESS(f"{'Created' if created else 'Updated'} Student 1: ID 22it001 (username: student_it) / Student123!"))

        # 5. Student 2 (IT, 6th Sem, Batch A1)
        st2, created = User.objects.get_or_create(
            username="student_it2",
            defaults={
                "student_id": "22it002",
                "email": "22it002@charusat.edu.in",
                "role": "student",
                "branch": "cspit-it",
                "semester": 6,
                "batch": "a1",
                "faculty": fac1,
                "is_approved": True,
                "first_time_login": False,
            }
        )
        st2.set_password("Student123!")
        st2.student_id = "22it002"
        st2.is_approved = True
        st2.first_time_login = False
        st2.faculty = fac1
        st2.save()
        self.stdout.write(self.style.SUCCESS(f"{'Created' if created else 'Updated'} Student 2: ID 22it002 (username: student_it2) / Student123!"))

        # 6. Student 3 (CE, 6th Sem, Batch B1)
        st3, created = User.objects.get_or_create(
            username="student_ce",
            defaults={
                "student_id": "22ce001",
                "email": "22ce001@charusat.edu.in",
                "role": "student",
                "branch": "cspit-ce",
                "semester": 6,
                "batch": "b1",
                "faculty": fac2,
                "is_approved": True,
                "first_time_login": False,
            }
        )
        st3.set_password("Student123!")
        st3.student_id = "22ce001"
        st3.is_approved = True
        st3.first_time_login = False
        st3.faculty = fac2
        st3.save()
        self.stdout.write(self.style.SUCCESS(f"{'Created' if created else 'Updated'} Student 3: ID 22ce001 (username: student_ce) / Student123!"))

        self.stdout.write(self.style.SUCCESS("\nAll demo accounts are ready!"))
