# PSYS — Progress Log

> Update this file at the END of every Claude Code session. This is how the next session
> gets caught up, instead of re-reading old chats. Newest entries at the top.

## Entry Format
Every session log entry below MUST follow this exact template — no free-form summaries.

```
### YYYY-MM-DD — Session N
**Goal for this session:**
**Done:**
-
**Files changed:**
-
**Left / not done:**
-
**Next session should start with:**
-
**Open questions for teammate:**
-
**Blockers:**
-

```

At the START of a new session, read the most recent entry's **"Next session should start
with"** field first — that's the actual to-do list, not a summary to skim.

---

## Test accounts (manual UI testing)

Three Supabase Auth users exist on the linked remote project for manual testing.
All three are linked to institution "Test University"
(id `70881552-0663-494b-8b95-59cfdd5fb246`).

| Role    | Email               | `public.users.id`                           |
|---------|---------------------|---------------------------------------------|
| admin   | admin@test.local    | 38745115-3314-4032-8488-db196a71f966|
| teacher | teacher@test.local  | 85216994-0d8d-4345-b772-d0f3bb942fae|
| student | student@test.local  | 68714a6a-86ce-405f-a2fb-e5565648e772|

Passwords are kept out of this file intentionally — check the local `apps/web/.env.local`
gitignored dev notes, or reset via the Supabase dashboard.

Note: `student@test.local` now has a `students` row (Aisha Mehta, roll PS-2026-084, institution "Test University", consent_given=true).

---

## Session log
(Newest entry at top. Use the Entry Format above for every new one.)

### 2026-08-29 — Session 7
**Goal for this session:**
Manual end-to-end testing of the app with three newly created test accounts (admin, teacher, student) to verify shipped features and identify remaining gaps.
**Done:**
- Verified dispute resolution works end-to-end: camera-service was confirmed runnable locally (`uvicorn app.main:app --reload --port 8000`), `POST /disputes/{id}/resolve` is implemented with proper auth checks.
- Confirmed enrollment pipeline works end-to-end: photo upload → `enrollment_jobs` → enrollment-worker (polls every 5s) → calls `POST /internal/embed` on camera-service → writes to `student_biometrics` → deletes source photo. Three services must be running: Next.js (port 3000), camera-service (port 8000), enrollment-worker (separate Python process).
- Confirmed permitted exits (`markPermittedExit`, `recordReturn`) work.
- Confirmed bulk import works.
- Confirmed student dashboard renders at `/` for `role=student` (component, not a separate route).
- Confirmed StudentDashboard links to a `students` row via `user_id` — created one for `student@test.local` (Aisha Mehta, roll PS-2026-084).
- Confirmed RLS recursion bug (class_sessions ↔ final_attendance) was found and fixed in migrations 0029 and 0030 (SECURITY DEFINER helpers with pinned search_path).
- **Found and documented a new gap:** no class creation UI exists, and no `createClass()`/`scheduleClassSession()` server actions exist. `classes` and `class_sessions` can only be populated via direct DB insert. Blocks testing of sessions/attendance/finalization through the actual UI.
- Confirmed camera-service SETUP.md documents the deployed Render URL (`https://psys-camera-service.onrender.com`) and `/tick` endpoint for cron keepalive.
**Files changed:**
- `docs/PROGRESS.md`
**Left / not done:**
- Class creation UI + server actions (newly discovered gap, see above).
- Comprehensive seed script (per Session 5 carry-over) still not created.
- Operational tasks: backup/recovery, API rate limiting.
**Next session should start with:**
- User to choose: build class creation UI + server actions, create the seed script (per Session 5), or tackle operational tasks (backup/rate-limiting).
**Open questions for teammate:**
- None.
**Blockers:**
- None.

### 2026-08-29 — Session 6
**Goal for this session:**
Create three test accounts (admin, teacher, student) for manual UI testing, all on institution 1.
**Done:**
- Created three Supabase Auth users via the Admin API: `admin@test.local`, `teacher@test.local`, `student@test.local` (all under institution "Test University", ID `70881552-0663-494b-8b95-59cfdd5fb246`).
- Created the `Test University` institution row in `public.institutions`.
- Inserted one row per auth user into `public.users` with matching `id`, `role`, `institution_id`, and `full_name`.
- Logged in to apps/web to confirm the test user link works (admin dashboard, teacher attendance view, student dashboard at `/`).
- Confirmed `StudentDashboard` is a component rendered inside `app/page.tsx` based on `user.role === 'student'`, not a separate `/student-dashboard` route.
**Files changed:**
- `docs/PROGRESS.md`
**Left / not done:**
- **Newly discovered gap (not carried over):** Class creation UI + server actions do not exist. `classes` and `class_sessions` can currently only be populated via direct DB insert. This blocks testing of sessions, attendance review, and finalization through the actual UI. Needs `createClass()` and `scheduleClassSession()` server actions plus a form, likely on `/settings` or a new `/classes` route.
- `student@test.local` has no `students` row yet — student dashboard will show the "Your account is not linked to a student record" message until a `students` row with `user_id = 68714a6a-86ce-405f-a2fb-e5565648e772` is created.
- Comprehensive seed script (per Session 5 carry-over) still not created.
- Operational tasks: backup/recovery, API rate limiting.
**Next session should start with:**
- Run a quick smoke test of each test account in the browser to confirm role-scoped navigation works as expected, then decide between the seed script (per Session 5) and operational tasks (backup/recovery, rate-limiting).
**Open questions for teammate:**
- None.
**Blockers:**
- None.

### 2026-08-29 — Session 5
**Goal for this session:**
Repair the remote Supabase migration history, apply pending migrations, and verify their resulting schema artifacts.
**Done:**
- Verified the remote schema had migrations through `0025` applied despite an empty migration-history table, then repaired remote history through `0025`.
- Found that the duplicate `0010` filenames could not both be recorded because Supabase uses migration version as the history table primary key; renamed `0010_session_roster_derivation.sql` to `0028_session_roster_derivation.sql`.
- Applied `0026_enrollment_photos_storage_policies.sql`, `0027_enforce_role_based_access.sql`, and `0028_session_roster_derivation.sql` to the linked remote project.
- Verified all 28 migration versions are synchronized between repository migration files and remote history.
- Verified the two `0026` Storage policies and the student- and teacher-scoped `class_sessions` select policy from `0027` now exist on the remote database.
- Updated migration documentation and recorded the unique-version migration decision.
**Files changed:**
- `supabase/migrations/0010_session_roster_derivation.sql` (renamed to `0028_session_roster_derivation.sql`)
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/PROGRESS.md`
**Left / not done:**
- No existing seed or fixture data was found; comprehensive Phase 0 test seed data remains to be created.
- Local Supabase has not been started because Docker Desktop is not installed; the linked remote database was migrated and verified instead.
- Operational tasks: Supabase backup/recovery plan remains undefined and API rate limiting is not yet implemented.
**Next session should start with:**
- Create the requested comprehensive seed script for two institutions, consented students, enrollments, quorum/no-quorum/gap scenarios, capture failures, check-ins, and a permitted-exit window; do not execute it until requested.
**Open questions for teammate:**
- None.
**Blockers:**
- Docker Desktop is not installed, so local Supabase cannot run until it is installed and started.

### 2026-08-29 — Session 4
**Goal for this session:**
Implement the Student Dashboard (Phase 7) — UI for students to view attendance and file disputes.
**Done:**
- Added `StudentDashboard` component to render student-specific UI in `app/page.tsx` when user.role is student.
- Wrote `0027_enforce_role_based_access.sql` migration to enforce proper RLS limiting access to final_attendance, class_sessions, classes, and disputes per user role.
- Made root layout async to fetch and pass the current role to `<NavLinks />` so navigation hides irrelevant views from students.
- Updated `fileDispute` endpoint to revalidate the root path so the student dashboard reflects changes immediately.
- Adjusted disputes UI (`app/disputes/page.tsx`) to conditionally hide dispute resolution controls and links if the user is a student.
**Files changed:**
- `apps/web/app/student-dashboard.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/app/disputes/page.tsx`
- `apps/web/lib/enrollment/disputes.ts`
- `supabase/migrations/0027_enforce_role_based_access.sql`
**Left / not done:**
- Operational tasks: Supabase database backup/recovery plan is still undefined (free tier limitation, spec Section 7 violation pending upgrade/script), API rate limiting.
- Need to run `supabase migration up` manually.
**Next session should start with:**
- Run `supabase migration up` on the local database and review if Operational tasks (backups/rate-limits) need attention, or if we should move towards deployment/mock population for Phase 0 pilot.
**Open questions for teammate:**
- None.
**Blockers:**
- None.

---



### 2026-08-29 — Session 3
**Goal for this session:**
Build the Teacher Dashboard (Phase 6) — dedicated attendance review, session attendance detail, and disputes management.
**Done:**
- Created `apps/web/lib/enrollment/attendance.ts` server actions (`getTeacherSessions`, `getSessionAttendance`, `getReviewQueue`, `getAllReviewItems`, `resolveReviewItem`, `getAllDisputes`)
- Built `/attendance` route matching dashboard styling to list teacher's sessions with summary statistics
- Built `/attendance/[id]` detail view replacing raw styling with the project design system (`page-shell`, `ledger-row`), showing full roster, review queue, exceptions
- Built `/disputes` route listing pending/approved/rejected disputes and wiring them up to camera-service `resolveDispute` endpoints
- Updated home page Quick Actions and Stats to link to `/attendance` and `/disputes`
- Wired `NavLinks.tsx` with `/attendance` and `/disputes` entries
**Files changed:**
- `apps/web/lib/enrollment/attendance.ts` (created)
- `apps/web/app/attendance/page.tsx` (created)
- `apps/web/app/attendance/[id]/page.tsx` (created)
- `apps/web/app/disputes/page.tsx` (created)
- `apps/web/app/page.tsx`
- `apps/web/lib/NavLinks.tsx`
**Left / not done:**
- Student Dashboard (Phase 7) — UI for students to view attendance, file disputes (if any UI is actually needed beyond Phase 6 disputes handling)
- Operational tasks: backup/recovery, API rate limiting
**Next session should start with:**
- Review priority and decide if Phase 7 (Student Dashboard) is needed next, or if we move to Operational tasks.
**Open questions for teammate:**
- None
**Blockers:**
- None

---


### 2026-08-29 — Session 2
**Goal for this session:**
Review spec (Claude (1).md) and update docs to reflect full project status and remaining work.
**Done:**
- Read full spec from `docs/Claude (1).md` — confirmed implementation matches spec through Phase 5
- Added `processing_metrics` table to ARCHITECTURE.md (was missing from Key tables section)
- Identified remaining phases: Auth (Phase 2), Teacher Dashboard (Phase 6), Student Dashboard (Phase 7)
**Files changed:**
- `docs/ARCHITECTURE.md` — added processing_metrics to Key tables section
**Left / not done:**
- Phase 2 (Auth) — RLS currently bypassed by service-role client; need real login flow
- Phase 6 (Teacher Dashboard) — UI for reviewing uncertain/camera_issue cases, resolving disputes
- Phase 7 (Student Dashboard) — UI for students to view attendance, file disputes
- Operational gaps: backup/recovery, API rate limits
**Next session should start with:**
- User to pick priority: Auth (Phase 2), Teacher Dashboard (Phase 6), or Student Dashboard (Phase 7)
**Open questions for teammate:**
- None
**Blockers:**
- None

---

### 2026-08-28 — Session 1
**Goal for this session:**
Update DECISIONS.md to reflect shipped Phase 5 implementation and remove stale entries.
**Done:**
- Rewrote `docs/ARCHITECTURE.md` from live code (Phase 5 finalization logic in
  `services/camera-service/app/finalization/`, disputes, exceptions, review queue)
- Updated `docs/DECISIONS.md`: removed stale "Phase 5 needs a call" entry, added 7 new
  decisions revealed by the finalization code (quorum failure handling, camera degradation
  windows from capture_events, exception-window resolution in SQL, disputes endpoint vs
  direct insert, best-evidence photo selection, audit logging for disputes)
- Verified Phase 5 is fully shipped on camera-service side: orchestrator, boundaries,
  gap_check, camera_windows, exceptions, disputes, review all implemented
**Files changed:**
- `docs/ARCHITECTURE.md` — rewritten from live code
- `docs/DECISIONS.md` — updated with new decisions, removed stale Phase 5 entry
**Left / not done:**
- `docs/PROGRESS.md` needs "Next session should start with" field populated once user
  confirms what they're actually working on next
**Next session should start with:**
- [awaiting user input]
**Open questions for teammate:**
- None — Phase 5 handoff is complete, both sides have shipped their code
**Blockers:**
- None
