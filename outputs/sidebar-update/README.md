# Sidebar update — 14 October 2026

The local frontend at http://localhost:5185 now serves the updated navigation.

- Four main links: Overview/Home, Assessments, Problems, History.
- People: Students, Faculty, Approvals.
- Administration: Access management, Sessions.
- Account, Support, and Sign out appear in the sidebar footer.
- Groups are hidden when none of their pages are permitted. Mobile links use the same permission rules.
- The current page's group opens automatically. Users can toggle groups with the pointer or keyboard.
- Approvals combines the existing faculty/student approval workflows and displays pending counts for the existing permitted scopes. Existing backend approval scope and endpoints are retained.
- Students provides Add student and Import students actions through the existing registration workflow. The Add action opens the single-student form; registration still uses the existing preview/select/register process.
- Existing student password/session/deletion controls are retained with permission and class-scope checks. The delete dialog was opened and cancelled in browser verification; no actual accounts were deleted.
- Old request and student URLs redirect to their new destinations.

Validation completed:

- 10 navigation/permission regression tests passed.
- 8 submission-loading regression tests passed.
- Frontend lint passed with no warnings.
- Final production Docker build passed, and the local frontend container was updated.
- Browser verification used isolated preview accounts (admin, faculty, and direct-permission author) and a separate audit database, with six viewport sizes: 320×568, 390×844, 768×1024, 844×390, 1024×768, 1440×900.
- Group toggles, automatic expansion, selected-page highlighting, legacy redirects, approval-tab restrictions, pending badges, student actions, mobile focus trapping, and Escape dismissal were checked.
- Real Safari/Android hardware was not used in these checks.

Evidence is saved in this directory, including desktop/phone screenshots, layout measurements, build output, and test results. The separate application audit findings remain outside this navigation update.
