# Automatic Code Assessment — Django Backend

This backend service is a complete, drop-in replacement for the legacy Node.js/Express/MongoDB backend, re-engineered using **Python 3.12+**, **Django 5.1**, **Django REST Framework (DRF)**, **PostgreSQL 16**, **Redis**, and **Celery**.

All API routes, payload structures, HTTP status codes, cookie conventions, and business logic are 100% compatible with the React frontend without modifying any frontend code.

---

## 🏗️ Architecture & Technology Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Language** | Python 3.12+ (Host tested on 3.14) | Core backend runtime |
| **Framework** | Django 5.1 + DRF 3.15 | REST API framework & ORM |
| **Database** | PostgreSQL 16 | Relational data persistence with UUIDv4 primary keys |
| **Authentication** | SimpleJWT + CookieJWTAuthentication | HTTP-only cookie-based JWT auth (`token`) with single-session enforcement (`sessionId`) |
| **Password Hashing** | Bcrypt + Argon2 + PBKDF2 | Seamless authentication compatibility with legacy MongoDB user password hashes |
| **Execution Engine** | Judge0 API | Remote multi-language code compilation and sandbox execution |
| **Task Queue** | Celery 5.4 + RabbitMQ | Asynchronous submission evaluation and scheduled session cleanups |
| **Caching** | Redis 7 + django-redis | Query caching (`FetchSubjectsView`) and rate-limiting storage |
| **WSGI Server** | Gunicorn | Production application server |

---

## 📁 Apps & Module Structure

```text
django_backend/
├── manage.py
├── Dockerfile
├── entrypoint.sh
├── requirements.txt
├── pytest.ini
├── config/
│   ├── settings/
│   │   ├── base.py              # Shared settings (DB, auth, cache, Celery, CORS)
│   │   ├── dev.py               # Local development (SQLite fallback, LocMemCache, debug)
│   │   └── prod.py              # Production settings (SSL headers, gunicorn)
│   ├── urls.py                  # Namespaced /api/v1/ routes
│   ├── wsgi.py                  # Production WSGI application
│   ├── asgi.py                  # ASGI entrypoint
│   └── celery.py                # Celery configuration & autodiscovery
└── apps/
    ├── users/                   # Auth, Profiles, Admin, and Faculty workflows
    ├── problems/                # Problem CRUD, test case constraints, student assignment
    ├── contests/                # Contest management, cascade assignment, and leaderboard
    ├── submissions/             # Submissions, marks aggregation, student history
    ├── execution/               # Judge0 client, run-code / submit-code endpoints, Celery tasks
    └── code_drafts/             # Code draft auto-save and retrieval
```

---

## 🔌 API Route Parity Reference

All endpoints are mounted under `/api/v1/`:

| Feature Area | Legacy Express Route | Django DRF Route | Methods |
| :--- | :--- | :--- | :--- |
| **Auth** | `/api/v1/auth/register` | `/api/v1/auth/register` | `POST` |
| | `/api/v1/auth/login` | `/api/v1/auth/login` | `POST` |
| | `/api/v1/auth/logout` | `/api/v1/auth/logout` | `POST` |
| | `/api/v1/auth/current-user` | `/api/v1/auth/current-user` | `GET` |
| | `/api/v1/auth/change-password` | `/api/v1/auth/change-password` | `POST` |
| | `/api/v1/auth/fetch-subject` | `/api/v1/auth/fetch-subject` | `GET` |
| **User Profile** | `/api/v1/user/update` | `/api/v1/user/update` | `PUT` |
| | `/api/v1/user/profile/upload-avatar` | `/api/v1/user/profile/upload-avatar` | `POST`, `GET` |
| | `/api/v1/user/profile/remove-profile-pic` | `/api/v1/user/profile/remove-profile-pic` | `DELETE` |
| **Problems** | `/api/v1/problems` | `/api/v1/problems/` | `GET`, `POST` |
| | `/api/v1/problems/:id` | `/api/v1/problems/<id>` | `GET`, `PUT`, `DELETE` |
| | `/api/v1/problems/:id/assign` | `/api/v1/problems/<id>/assign` | `POST` |
| | `/api/v1/problems/:id/unassign` | `/api/v1/problems/<id>/unassign` | `POST` |
| | `/api/v1/problems/:id/assigned-students` | `/api/v1/problems/<id>/assigned-students` | `GET` |
| | `/api/v1/problems/:id/unassigned-students`| `/api/v1/problems/<id>/unassigned-students`| `GET` |
| | `/api/v1/problems/:id/students-stats` | `/api/v1/problems/<id>/students-stats` | `GET` |
| **Code Drafts** | `/api/v1/compile/saveCode` | `/api/v1/compile/saveCode` | `POST` |
| | `/api/v1/compile/getCode/:problemId` | `/api/v1/compile/getCode/<problemId>` | `GET` |
| **Submissions** | `/api/v1/submissions/submissions` | `/api/v1/submissions/submissions` | `GET` |
| | `/api/v1/submissions/get-all-submissions`| `/api/v1/submissions/get-all-submissions`| `GET` |
| | `/api/v1/submissions/user-submissions` | `/api/v1/submissions/user-submissions` | `GET` |
| | `/api/v1/submissions/:submissionId` | `/api/v1/submissions/<submissionId>` | `GET` |
| **Compiler / Run** | `/api/v1/compiler/run-code` | `/api/v1/compiler/run-code` | `POST` |
| | `/api/v1/compiler/queue-status` | `/api/v1/compiler/queue-status` | `GET` |
| **Contests** | `/api/v1/contests/create` | `/api/v1/contests/create` | `POST` |
| | `/api/v1/contests` | `/api/v1/contests/` | `GET` |
| | `/api/v1/contests/:id` | `/api/v1/contests/<id>` | `GET`, `PUT`, `DELETE` |
| | `/api/v1/contests/:id/assignContestToStudents` | `/api/v1/contests/<id>/assignContestToStudents` | `POST` |
| | `/api/v1/contests/:id/unassignContestToStudents` | `/api/v1/contests/<id>/unassignContestToStudents` | `POST` |
| | `/api/v1/contests/:id/getAssignedStudents` | `/api/v1/contests/<id>/getAssignedStudents` | `GET` |
| | `/api/v1/contests/:id/unassignedStudents` | `/api/v1/contests/<id>/unassignedStudents` | `GET` |
| | `/api/v1/contests/:id/dashboard` | `/api/v1/contests/<id>/dashboard` | `GET` |
| **Admin APIs** | `/api/v1/admin/get-pending-users` | `/api/v1/admin/get-pending-users` | `GET` |
| | `/api/v1/admin/accept-request` | `/api/v1/admin/accept-request` | `POST` |
| | `/api/v1/admin/accept-all-requests` | `/api/v1/admin/accept-all-requests` | `POST` |
| | `/api/v1/admin/decline-request` | `/api/v1/admin/decline-request` | `POST` |
| | `/api/v1/admin/decline-all-requests` | `/api/v1/admin/decline-all-requests` | `POST` |
| | `/api/v1/admin/get-faculty-by-admin` | `/api/v1/admin/get-faculty-by-admin` | `POST` |
| | `/api/v1/admin/deleteFaculty` | `/api/v1/admin/deleteFaculty` | `DELETE` |
| **Faculty APIs** | `/api/v1/faculty/get-pending-users` | `/api/v1/faculty/get-pending-users` | `GET` |
| | `/api/v1/faculty/accept-request` | `/api/v1/faculty/accept-request` | `POST` |
| | `/api/v1/faculty/accept-all-requests` | `/api/v1/faculty/accept-all-requests` | `POST` |
| | `/api/v1/faculty/decline-request` | `/api/v1/faculty/decline-request` | `POST` |
| | `/api/v1/faculty/decline-all-requests` | `/api/v1/faculty/decline-all-requests` | `POST` |
| | `/api/v1/faculty/bulk-register` | `/api/v1/faculty/bulk-register` | `POST` |
| | `/api/v1/faculty/get-students-by-faculty`| `/api/v1/faculty/get-students-by-faculty`| `POST` |
| | `/api/v1/faculty/expire-session` | `/api/v1/faculty/expire-session` | `POST` |
| | `/api/v1/faculty/remove-user/:userId` | `/api/v1/faculty/remove-user/<userId>` | `DELETE` |

---

## 🚀 Running the Application

### Option 1: Docker Compose (Full Stack)
From the repository root:
```bash
docker compose up django-server celery-worker postgres django-redis-cache
```

To run along with the client:
```bash
docker compose up client django-server celery-worker postgres django-redis-cache judge0-server judge0-worker judge0-db judge0-redis rabbitmq
```

### Option 2: Local Development (Offline / Fast Iteration)
1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Run database migrations:
   ```bash
   python manage.py migrate
   ```
3. Start the development server on port 8000 (or port 3100 if replacing Node directly):
   ```bash
   python manage.py runserver 0.0.0.0:8000 --settings=config.settings.dev
   ```

---

## 🧪 Running Automated Tests

Run the complete test suite (55 unit & integration tests) offline using SQLite:
```powershell
$env:USE_SQLITE="True"; pytest apps/ -v
```

On Linux/macOS:
```bash
USE_SQLITE="True" pytest apps/ -v
```

Run test suite for a specific module:
```powershell
$env:USE_SQLITE="True"; pytest apps/contests/ -v
```

---

## 🔄 MongoDB to PostgreSQL Data Migration

A robust ETL command is provided to migrate existing production data from MongoDB Atlas directly to PostgreSQL:

```bash
# Dry run to preview migration counts
python manage.py migrate_from_mongo --mongo-uri="mongodb+srv://user:pass@cluster.mongodb.net/assessment" --dry-run

# Execute full migration
python manage.py migrate_from_mongo --mongo-uri="mongodb+srv://user:pass@cluster.mongodb.net/assessment"
```

The migration command:
- Deterministically maps MongoDB ObjectIDs to PostgreSQL UUIDs (`uuid5`) so re-runs are idempotent.
- Maintains user-faculty relationships, problem constraints, test cases, submissions, and code drafts.
- Preserves bcrypt password hashes for zero-downtime student and faculty logins.
