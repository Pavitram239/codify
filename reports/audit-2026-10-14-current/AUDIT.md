# Codify application audit — 14 October 2026

The application has a working core, but it is not ready to be described as fully reliable across custom permissions and all devices. The main problems are staff session revocation, inconsistent permission-aware screens, malformed-ID handling, database query growth, and narrow-screen coding controls. Dependency and execution-capacity risks also need attention before an internet-facing deployment.

This audit did not change application source or the existing UI design. Browser mutations used a separate SQLite database and disposable accounts at ports 7285/7286. Backend tests used pytest's separate PostgreSQL test database. The existing application's accounts and assessment records were not used for mutations. Small execution tests used the existing local Judge0 service. No deployment or shared Postman workspace changes were made.

The checkout was already modified before this audit. Git HEAD was `79c5c96aac5f968497803fe5808ebb2e00e762e5`; results describe the current working files, including those uncommitted changes, rather than that commit alone.

## Verification results

| Check | Result | What it establishes |
| --- | --- | --- |
| Existing backend suite, PostgreSQL | 208 passed; 1 failed; 209 collected | Broad regression coverage. The failure is a submission-review policy disagreement described below. |
| Existing boundary audit within that suite | 63 recorded scenarios passed | Invalid authoring input, ownership/privacy, authentication, pagination, onboarding, and other boundary cases in the saved results. These are included in the 208 passes, not additional tests. |
| New targeted PostgreSQL probes | 8 failed expectations; 1 passed | Reproduced staff-token survival, unrestricted assignment directories, query growth, missing execution throttles, and malformed UUID errors. Some expectations express recommended policy, not an already agreed contract. |
| Concurrent access-manager removal | Passed | Two simultaneous removals produced HTTP 200 and 400; one access manager remained. |
| Frontend submission-loading tests | 8 passed | Duplicate-request prevention, failure/retry behavior, logout/account-change handling, and stale response rejection. |
| Frontend lint | 0 errors, 0 warnings | Static lint checks passed. |
| Production frontend build | Passed | Build completed in 27.83 seconds; large-bundle warning remains. |
| Live local Judge0 | Python, C++, Java all passed | Each ran two cases, saved a 20-mark submission, and masked hidden inputs/output. Request times were 2.59, 3.33, and 4.36 seconds respectively. This is a functional check, not a load test. |
| Browser coding flow | Passed, with layout defect | Compilation error displayed, corrected sample accepted, full submission accepted, history refreshed, draft saved. |
| Instructor PDF export | Download completed | An instructor report was downloaded from populated results. Print quality was not separately audited. |
| Profile request-loop regression | Not reproduced | Empty admin and populated student profiles rendered. The student profile made one submissions request on entry, then the server log stayed quiet during idle observation. |
| Frontend runtime dependency scan | 14 affected packages: 2 critical, 7 high, 5 moderate | Package advisory counts; they do not establish 14 exploitable application vulnerabilities. |
| Django deployment checks | 3 warnings | HTTPS redirect and secure session/CSRF cookies are not enabled in the local configuration; production proxy behavior must be verified separately. |

Fresh results: [backend suite](<C:/Users/pavit/Desktop/Django Projects/codify/codify/reports/audit-2026-10-14-current/evidence/backend-postgres-tests.txt>), [boundary scenarios](<C:/Users/pavit/Desktop/Django Projects/codify/codify/reports/audit-2026-10-14-current/evidence/backend-boundary-results.json>), [targeted probes](<C:/Users/pavit/Desktop/Django Projects/codify/codify/reports/audit-2026-10-14-current/evidence/backend-audit-probes.json>), [frontend loading tests](<C:/Users/pavit/Desktop/Django Projects/codify/codify/reports/audit-2026-10-14-current/evidence/frontend-submission-tests.txt>), [live execution](<C:/Users/pavit/Desktop/Django Projects/codify/codify/reports/audit-2026-10-14-current/evidence/live-judge0.json>), [build output](<C:/Users/pavit/Desktop/Django Projects/codify/codify/reports/audit-2026-10-14-current/evidence/frontend-build.txt>).

## Prioritized findings

### A01 — High — Staff session termination does not invalidate the login token

**Confirmed.** For both faculty and administrator accounts, the terminate-session endpoint returned HTTP 200, but the retained token still received HTTP 200 from the current-user endpoint. Authentication checks the stored session identifier only for student accounts. The termination endpoint clears that identifier for staff too and reports success, which creates a false impression of revocation.

Reproduce: sign in as staff, retain the token, terminate that account's session using an authorized manager, then replay the retained token. Expected after an actual revocation: HTTP 401. Actual: HTTP 200.

Implement revocation that supports multiple staff devices, such as per-session records or an account token version for revoking all sessions. Define whether the button revokes one device or every device and make its wording match. Password changes already have separate token-invalidating protection; this finding concerns the terminate-session action.

Source: [authentication](<C:/Users/pavit/Desktop/Django Projects/codify/codify/django_backend/apps/users/authentication.py:36>), [termination](<C:/Users/pavit/Desktop/Django Projects/codify/codify/django_backend/apps/users/views_admin.py:265>). Evidence: `AUTH-REVOKE-faculty` and `AUTH-REVOKE-admin` in targeted probes.

### A02 — High — Assignment permissions expose an unrestricted student directory

**Exposure confirmed; target-scope policy needs a decision.** An account with only `problems.assign_shared` or `contests.assign_shared`, and no user-directory permission, received students linked to another instructor from its own resource's unassigned-students endpoint. The responses contain identifiers, usernames, branch, semester, and batch. The tested serializer does not include email or mobile numbers.

The resource ownership check works, but the target-student query covers the entire institution. If cross-class assignment is intended, document that access and return the minimum identity data needed. Otherwise, constrain targets to the instructor's permitted students, with an explicit permission for broader assignment. Apply the same target scope when accepting assignment mutations. This result is not classified as an unambiguous violation of an existing documented target-scope contract.

Source: [problem directory](<C:/Users/pavit/Desktop/Django Projects/codify/codify/django_backend/apps/problems/views.py:181>), [contest directory](<C:/Users/pavit/Desktop/Django Projects/codify/codify/django_backend/apps/contests/views.py:239>). Evidence: `SCOPE-DIRECTORY-problems` and `SCOPE-DIRECTORY-contests`.

### A03 — High — Security maintenance is behind on backend and file-import dependencies

**Installed versions and reachable import path confirmed; exploits were not attempted.** The backend pins Django 5.1.1. Django 5.1 ended security support in December 2025 and its final security release was 5.1.15. Move to a currently supported release and verify compatibility rather than merely upgrading within the unsupported series. [Django support announcement](https://www.djangoproject.com/weblog/2025/dec/03/django-60-released/).

The student-import screen reads uploaded spreadsheets using `xlsx` 0.18.5. The vendor reports prototype-pollution exposure when reading crafted files through 0.19.2 and regular-expression denial of service through 0.20.1; the import path is relevant because it parses arbitrary uploads. Replace or update the parser through a maintained distribution, validate file size/content, and check the import flow after the update. [SheetJS prototype-pollution advisory](https://cdn.sheetjs.com/advisories/CVE-2023-30533), [SheetJS ReDoS advisory](https://cdn.sheetjs.com/advisories/CVE-2024-22363).

The frontend scan also flags axios, jsPDF, its table plugin, routing dependencies, and transitive packages. Assess each advisory against the code actually used. For example, the inspected PDF exporters use `text`, `autoTable`, and `save`; they do not invoke the new-window `output` overloads affected by the particular critical HTML-injection advisory reviewed. Node-only advisories in frontend dependencies also do not automatically describe a browser exploit. [jsPDF maintainer advisory](https://github.com/parallax/jsPDF/security/advisories/GHSA-wfv2-pwc8-crg5).

Source: [backend requirements](<C:/Users/pavit/Desktop/Django Projects/codify/codify/django_backend/requirements.txt:2>), [spreadsheet parser](<C:/Users/pavit/Desktop/Django Projects/codify/codify/client/src/componets/Faculty/StudentRegister.jsx:54>). [Dependency scan](<C:/Users/pavit/Desktop/Django Projects/codify/codify/reports/audit-2026-10-14-current/evidence/dependency-audit.json>).

### A04 — High — Execution lacks admission limits and occupies web workers

**Configuration and execution path confirmed; overload impact is a risk inference.** The execution endpoint has no throttle classes and no configured default REST throttles. It synchronously runs test cases through Judge0. The web server has four workers and a 120-second timeout; Judge0 polling can wait up to 30 seconds per case, and execution is sequential. A few slow, repeated requests can occupy the available workers. A Celery execution task exists, but this endpoint does not dispatch it.

Add per-user execution admission limits, bounded case counts/runtime budgets, and backpressure. Use the background worker path for long submissions, with a job status returned to the client. Login also lacks an explicit application throttle in the inspected settings/views and should have independently scoped abuse protection. No stress test was run against the existing service.

Source: [execution endpoint](<C:/Users/pavit/Desktop/Django Projects/codify/codify/django_backend/apps/execution/views.py:15>), [polling](<C:/Users/pavit/Desktop/Django Projects/codify/codify/django_backend/apps/execution/services.py:69>), [web workers](<C:/Users/pavit/Desktop/Django Projects/codify/codify/django_backend/Dockerfile:34>). Evidence: `PERF-EXECUTION-LIMIT`.

### A05 — Medium — Malformed problem IDs produce server errors

**Confirmed on two endpoints.** A `problemId` of `not-a-uuid` in code execution and a `problem_id` of `not-a-uuid` in problem submissions both returned HTTP 500. The UUID field validation exception escapes the normal API validation path.

Validate request body/query IDs before querying. Return HTTP 400 for malformed IDs and HTTP 404 for well-formed IDs that do not exist. Check other body/query UUID lookups using the same pattern.

Source: [execution lookup](<C:/Users/pavit/Desktop/Django Projects/codify/codify/django_backend/apps/execution/views.py:37>), [submission lookup](<C:/Users/pavit/Desktop/Django Projects/codify/codify/django_backend/apps/submissions/views.py:72>). Evidence: `VALIDATION-ID-execution` and `VALIDATION-ID-submissions`.

### A06 — Medium — Access-management user listing repeats database queries per user

**Confirmed on PostgreSQL.** Listing one user took 10 queries; listing 20 took 86. Although the view prefetches access relationships, serialization performs additional relationship queries and recalculates effective permissions per user. This increases page latency as the directory grows.

Build role/direct/effective permission output from the prefetched data and annotate role user counts where needed. Verify a bounded query count at several page sizes. Access mutations also lock all role and user rows for the last-manager safeguard; that safeguard passed concurrency testing, but its scalability deserves measurement before weakening or replacing those locks.

Source: [serialization](<C:/Users/pavit/Desktop/Django Projects/codify/codify/django_backend/apps/users/views_access.py:81>), [listing](<C:/Users/pavit/Desktop/Django Projects/codify/codify/django_backend/apps/users/views_access.py:180>). Evidence: `PERF-USER-LIST`.

### A07 — Medium — The home page fails for valid custom module permissions

**Confirmed in the browser.** An approved account with only `problems.create`, `problems.view_shared`, and `problems.edit_own` signs in but sees “You do not have permission to perform this action” on its home page. The page unconditionally requests contests and submission history together; denial of either request prevents the whole overview from displaying. The same account can open its authorized problem-bank page and is correctly denied access management.

Fetch and display each home section according to its own permission. An account should have a useful landing page even when it has access to only one module. Avoid sending unavailable-module requests or presenting a retry for a permanent authorization denial.

Source: [home requests](<C:/Users/pavit/Desktop/Django Projects/codify/codify/client/src/componets/workspace/StudentHome.jsx:27>). [Screenshot](<C:/Users/pavit/Desktop/Django Projects/codify/codify/reports/audit-2026-10-14-current/evidence/direct-author-home-phone.jpg>).

### A08 — Medium — Navigation and some legacy buttons do not reflect granular permissions

**Confirmed in the browser and API.** The restricted author account's sidebar omits unauthorized modules, but its phone bottom navigation still includes Assessments and Progress. Separately, the student-register screen showed enabled Delete buttons for a faculty account whose only grants were `users.view_assigned` and `users.create_assigned`, with no delete permission. A direct request received HTTP 403 and the student remained. This is misleading UI; the backend denied the action.

Filter all navigation consistently. Gate each action by its own permission and applicable resource scope. The `/registerStudent` route currently requires a create permission even though it renders a list, while the list API requires a view permission; align those contracts. Preserve the existing visual design while changing visibility, enabled state, and error behavior.

Source: [bottom navigation](<C:/Users/pavit/Desktop/Django Projects/codify/codify/client/src/componets/workspace/WorkspaceShell.jsx:222>), [delete button](<C:/Users/pavit/Desktop/Django Projects/codify/codify/client/src/componets/Faculty/FacultyRegister.jsx:173>), [route rules](<C:/Users/pavit/Desktop/Django Projects/codify/codify/client/src/utils/permissions.js:17>). [Action check](<C:/Users/pavit/Desktop/Django Projects/codify/codify/reports/audit-2026-10-14-current/evidence/granular-action-check.json>).

### A09 — Medium — Coding actions are clipped on a small phone

**Confirmed at 320 × 568.** The Run, Submit, and Save buttons remain in one nonwrapping row. The Save button extends past the containing coding panel and is visibly cut off. There is no page-wide horizontal scrollbar that reveals the clipped portion. Keyboard activation still saved the draft, but the full button is not visible for touch users.

Wrap or stack the action buttons at narrow widths, keep full labels visible, and verify the controls above the bottom navigation. This needs a layout adjustment within the current UI, not a redesign.

Source: [action row](<C:/Users/pavit/Desktop/Django Projects/codify/codify/client/src/componets/CodeEditor/TestCaseResults.jsx:24>). [Measurements](<C:/Users/pavit/Desktop/Django Projects/codify/codify/reports/audit-2026-10-14-current/evidence/coding-small-clipping.json>).

![Save Code clipped at small-phone width](<C:/Users/pavit/Desktop/Django Projects/codify/codify/reports/audit-2026-10-14-current/evidence/coding-actions-small-320.jpg>)

### A10 — Medium — Core problem navigation and form labels have accessibility gaps

**DOM and source confirmed.** The student problem title is a clickable table cell rather than a link or keyboard-focusable control. Its row had zero links, buttons, or tabindex targets, so keyboard-only users cannot open that problem through the list. Similar click-only navigation appears in history/submission/profile lists. Problem editing uses visible labels that are neither connected by `htmlFor` nor wrapped around their controls; its difficulty selector has no accessible label. The editor theme selector and several legacy dashboard filters also lack explicit labels.

Use real links for navigation and connect persistent labels to form controls. Verify focus order, Enter/Space behavior where appropriate, and screen-reader names. The newer access-management dialogs use native modal dialogs, and Escape returned focus to Add role during the check.

Source: [problem title](<C:/Users/pavit/Desktop/Django Projects/codify/codify/client/src/componets/Problem/MakeProblem.jsx:280>), [problem labels](<C:/Users/pavit/Desktop/Django Projects/codify/codify/client/src/componets/Problem/ProblemForm.jsx:535>), [editor selector](<C:/Users/pavit/Desktop/Django Projects/codify/codify/client/src/componets/CodeEditor/CodeEditorArea.jsx:22>). [Label evidence](<C:/Users/pavit/Desktop/Django Projects/codify/codify/reports/audit-2026-10-14-current/evidence/problem-form-labels.json>).

### A11 — Medium — Queue status is synthetic

**Source confirmed.** The queue-status endpoint always reports zero pending, zero processing, and one active user. Execution responses also return zero pending/processing. These values are not derived from worker state and cannot communicate a backlog or diagnose a slow Judge0 service.

Return real measurements when jobs are queued, or remove/make explicit any unavailable status rather than displaying invented counts. This should be addressed with the execution-worker changes in A04.

Source: [queue status](<C:/Users/pavit/Desktop/Django Projects/codify/codify/django_backend/apps/execution/views.py:175>).

### A12 — Low — The initial frontend bundle is large

**Build measurement confirmed; user-perceived slowdown was not measured.** The main JavaScript bundle is 1,431.73 kB before compression and 446.00 kB gzip. The production build warns about large chunks. This increases download/parse work for phones and slower connections.

Split by route and load spreadsheet/PDF tools only when their screens or exports need them. Measure load and interaction timing before setting a performance budget; do not infer actual slow-device timings from bundle size alone.

Evidence: production build output.

## Submission-review contract disagreement

The one failing existing test is `TestSubmissionsAPI.test_submission_detail_faculty_cannot_view_admin`. It expects HTTP 403 when a faculty owner requests an administrator's submission on that faculty member's problem. The current permission policy grants `submissions.review_own` to review submissions on owned problems regardless of the submitter's account type, so it returns HTTP 200.

That behavior is consistent with explicit resource permissions and the agreed absence of automatic role hierarchy. Decide and document whether submitter account type should add a separate restriction. Then align either the test or the implementation with that contract. This is not presented as a proven privilege-escalation bug. Reviews of another faculty member's private submissions were denied in the boundary tests.

## Device and UI coverage

The browser audit used a Chromium-based Codex in-app browser with viewport overrides. It exercised admin, faculty, student, role-granted custom access, and a direct-permission-only account. Seventy screenshots and [layout observations](<C:/Users/pavit/Desktop/Django Projects/codify/codify/reports/audit-2026-10-14-current/evidence/ui-layout-metrics.json>) are saved for the checked states.

| Viewport | Coverage and observed result |
| --- | --- |
| 320 × 568 small phone | Home, users, roles, profile, assessment list, coding workspace, role dialog. Main pages fit; coding Save button is clipped. |
| 390 × 844 phone portrait | Additional permission catalog, user form, nested extra-permission dialog, login, navigation drawer, populated/empty history, submissions, contest detail, legacy tables. Main layouts fit. Older tables require horizontal scrolling. |
| 768 × 1024 tablet portrait | Home, users, roles, profile, assessment list, coding workspace. No page-wide horizontal overflow detected in the checked states. |
| 844 × 390 landscape | Core pages, assessment editing, role dialog. Dialog footer remains visible with scrollable content. User table requires sideways scrolling. |
| 1024 × 768 laptop | Six core pages checked; no page-wide horizontal overflow detected. |
| 1440 × 900 desktop | Six core pages plus populated student profile and instructor report. Main layouts render. |
| 640 × 450 reduced viewport | Core layout/reflow checks. This approximates space available when zoomed, but does not certify actual 200% browser zoom. |

The populated instructor table's Delete column was reachable by horizontal scrolling on the phone-sized viewport. Wide table content is therefore recorded as a mobile usability limitation, not automatically as a broken control. The clipped coding action is a separate, reproduced defect. Metrics that list offscreen table controls are not themselves failure assertions. The raw `unlabelled` heuristic also flags nested-label controls; only controls independently checked for missing associations are reported in A10.

The audit does **not** certify every device. Real iPhone/iPad Safari, Android hardware, Firefox, virtual keyboards, touch gestures, notches/safe areas, native screen readers, and actual browser zoom still need validation. No quantified contrast audit or high-concurrency load test was performed. External AI-generation-provider availability and real invitation/email delivery were not exercised. Failure-path backend tests include mocked execution behavior; those checks do not prove worker recovery during a real service outage. Visual results used seeded fixtures, not an exhaustive record of every possible production data shape or every route/state.

## Recommended repair order

1. Correct staff revocation and settle assignment target scope; update supported dependencies and add execution/login abuse protection before public deployment.
2. Remove home-page module coupling and align route, navigation, and action permissions. Keep the current Codify colors, typography, and component styling.
3. Fix malformed IDs, bounded user-list query costs, and execution/queue behavior.
4. Fix the small-phone action row and keyboard/label issues; validate the resulting UI on real phone/tablet browsers.
5. Resolve the submission-review test contract, add regression checks for the confirmed defects, and reduce the initial bundle after measuring load behavior.

The proposed next work is targeted repair and verification. No fixes were applied during this audit.
