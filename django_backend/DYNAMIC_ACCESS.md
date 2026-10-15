# Dynamic access control

Open **Access management** in the application sidebar (`/access-management/users`) using an account with `access.manage`.

- **User Management**: searchable, paginated user table with role/status filters, Add User, Edit User, Manage Access, and Delete actions.
- **Role Management**: role cards showing assigned user counts and permission counts, with role creation/editing and permission dialogs.
- **Permission Management**: module catalog with action filters, search, descriptions, and permission codes.
- Role and user permission dialogs offer module/search filters and selection of all visible available permissions. Inherited permissions are selected and locked in the user editor; direct grants can be removed separately from the user editor.
- Create and edit roles using module-wise permission checkboxes.
- Assign any number of roles to a user.
- Add direct user permissions for individual exceptions.
- Effective access is the union of role permissions and direct grants. There are no explicit denials.
- Removing a grant does not remove access if another role or direct grant provides it.
- View effective access and its sources in the user editor; review the most recent 100 access changes in Change history.

## Installation and defaults

Run `python manage.py migrate` with the deployment's normal settings. Schema migration 0003 and data migrations 0004–0005 create the catalog and default Admin, Faculty, and Student roles, then assign existing users according to their account type. New accounts receive the configured default role once at creation. Editing an account type does not silently replace its access roles.

The old `User.role` field remains an **account type**, used for registration, student sessions, and institutional student/faculty records. It is not an API authorization gate. Django's `is_staff` and `is_superuser` retain Django-admin semantics and do not bypass application permissions.

Default roles are editable, but cannot be deleted because new-account onboarding uses them. Defaults preserve the main existing workflows. Student statistics now require `users.view_all` for institution-wide totals; `users.view_assigned` only returns the requester's managed students.

## Scope and enforcement

- `view_assigned`: resources assigned to the user; contest problem time windows still apply.
- `view_shared`: owned resources and the existing shared bank of admin-authored resources.
- `view_all`: all resources in the module.
- `edit_own` / `delete_own`: resources created by the requester.
- `edit_all` / `delete_all`: resources created by any user.
- `assign_shared`: owned or shared-bank resources; `assign_all`: any resource.
- `users.*_assigned`: students linked to the requester; `users.*_all`: unrestricted scope for that action.
- `submissions.review_own`: submissions for the requester's problems/contests; `review_all`: unrestricted review. Own submission access remains a separate permission.

Each action requires its own permission. For example, editing does not grant deletion, execution requires both `execution.run` and problem access, and contest construction validates access to every selected problem. Drafts remain owned by their user. Hidden submission evidence is returned only with review access to the resource.

The backend resolves grants from the database on every request, so changes apply without issuing a new JWT. The interface refreshes effective permissions on navigation and window focus, and after access edits. Backend checks remain authoritative.

An active, approved access manager must remain after any management edit. Role/user access mutations are atomic, serialized with database locks, and recorded with before/after values. Deleting the final active access manager is rejected. API access management requires `access.manage`, including granting that permission to others.

## API

All routes are under `/api/v1/access/`:

- `GET permissions`: module/action catalog.
- `GET/POST roles`: list/create roles.
- `PUT/DELETE roles/<id>`: edit/delete roles.
- `GET users?search=...&status=active&role=<id>&page=1&limit=10`: paginated user search with filters.
- `POST users`: create an account with optional roles/direct grants; requires `users.create_all` as well as `access.manage`. Returns a one-time temporary password and forces a password change at first login.
- `GET/PUT users/<uuid>`: inspect/replace access assignments.
- `PATCH users/<uuid>`: update identity/status with `users.edit_all`; does not change grants.
- `DELETE users/<uuid>`: delete an account with `users.delete_all`; rejects self-deletion and protects the last manager.
- `GET audit`: recent access change history.

Role payload: `{ "name": "Reviewer", "description": "", "permissions": ["submissions.review_all"] }`.
User payload: `{ "roles": [1, 2], "permissions": ["problems.create"] }`.

Permission identifiers are application-defined, since every action requires matching enforcement code. Add new actions to the catalog, a catalog migration, and the endpoint policy; administrators dynamically choose their grants. Protected module views deny unmapped actions by default.
