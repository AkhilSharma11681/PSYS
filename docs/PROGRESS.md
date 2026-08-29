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

### 2026-08-30 — Session (two bugs + design restyle continuation)
**Goal for this session:** Fix Bug 1 (timezone on session scheduling) and Bug 2 (stale UI after student update); confirm both; update PROGRESS.md per session-end rule.
**Done:**
- Bug 1 (timezone): toUTC() added in lib/enrollment/classes.ts; datetime-local now converts to correct UTC equiv (not 6am offset). Form validation kept (end > start).
- Bug 2 (stale UI): confirmed revalidatePath('/students/${id}') present at actions.ts:153 (updateStudent) and 172 (confirmConsent); server-action form submit triggers page refresh by default; no missing call.
- Event-handler crash fixed (ScheduleSessionForm.tsx extracted, 'use client').
- Attendance/[id] template restyle complete (.card, .badge-*, .btn-*, .info-rail, Inter typography, tabular-nums on stats, dark leftovers cleaned, font-mono → font-sans).
- Google Fonts loaded via `<link>` in layout.tsx (fixed @import ordering violation).
**Files changed:**
- apps/web/lib/enrollment/classes.ts (toUTC + server validation)
- apps/web/lib/enrollment/actions.ts (verified, no edit needed — revalidatePath present)
- apps/web/app/classes/ScheduleSessionForm.tsx (created)
- apps/web/app/classes/[id]/page.tsx (uses ScheduleSessionForm)
- apps/web/app/globals.css (done in prior session, unchanged)
- apps/web/app/layout.tsx (Google Fonts `<link>`, done prior)
- apps/web/app/attendance/[id]/page.tsx (template restyle, done prior)
- docs/PROGRESS.md (this entry)
**Left / not done:**
- Component-level restyle propagation to classes/, disputes/, attendance/ pages (only attendance/[id] done as template).
- Clean test DB artifacts (session d444c450 fake observations/final_attendance from Session 9) if real pilot loads.
- Operational tasks (backup/recovery plan, API rate limits) — carrying over from Session 5.
**Next session should start with:**
- Propagate .card/.badge/.btn restyle from attendance/[id] to classes/page + [id], disputes/page, attendance/page, page.tsx dashboard; OR clean test artifacts / start operational tasks; OR commit current work.
**Open questions for teammate:**
- Confirm camera-service /finalize auth flow: should it require JWT from web auth session, or service-role callable for admin? (From Session 9 entry — still open.)
**Blockers:**
- None.

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

### 2026-08-29 — Session 8
**Goal for this session:**
Build class creation UI and server actions to close the gap identified in Session 7.
**Done:**
- Created `lib/enrollment/classes.ts` with three server actions: `createClass()` (admin-only, auto-sets teacher_id to auth.uid()), `enrollStudent()` (admin/teacher), `scheduleClassSession()` (admin/teacher, sets safe defaults: status=scheduled, camera_status=unknown, processing_status=pending, roster_source=full_enrollment_fallback).
- Created `app/classes/page.tsx`: class list with room/student counts, inline "Create New Class" form (subject, room select, recurrence).
- Created `app/classes/[id]/page.tsx`: class detail with enrolled student list, "Enroll Student" select form, "Schedule Session" date/time form, and upcoming sessions list.
- Added "Classes" to NavLinks (admin/teacher visible).
- Added "Manage classes" Quick Action to dashboard.
- Recorded three design decisions in DECISIONS.md (admin-as-teacher, minimal session defaults, roster_source pre-set).
**Files changed:**
- `apps/web/lib/enrollment/classes.ts` (created)
- `apps/web/app/classes/page.tsx` (created)
- `apps/web/app/classes/[id]/page.tsx` (created)
- `apps/web/lib/NavLinks.tsx`
- `apps/web/app/page.tsx`
- `docs/DECISIONS.md`
- `docs/PROGRESS.md`
**Left / not done:**
- Comprehensive seed script (per Session 5 carry-over) still not created.
- Operational tasks: backup/recovery, API rate limiting.
**Next session should start with:**
- User to choose: seed script (per Session 5) or operational tasks (backup/rate-limiting).
**Open questions for teammate:**
- None.
**Blockers:**
- None.

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
- Class creation gap — CLOSED in Session 7 (createClass, enrollStudent, scheduleClassSession server actions + /classes route with list/form/detail). See new entry below for full details.
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

### 2026-08-29 — Session 9 (finalization testing)
**Goal for this session:**
Fix maths session scheduling bug (end < start), add client + server validation for session scheduling form, apply/verify 0031, lower min_quorum_count to 1, run zero-observation finalize pass, insert fake observations, run full finalize with gap logic.
**Done:**
- Added HTML5 onChange validation and server-side `end <= start` guard to `scheduleClassSession`; documented in DECISIONS.md.
- Confirmed 0031 already applied (institution config exists). Confirmed Aisha biometrics (`8efbceb2-...`).
- Fixed maths session `scheduled_end` (was 13:00, now 01:00 next day). Not timezone — missing validation.
- Pass 1 (zero obs): `finalized_at` claimed, `processing_status = needs_review`, `quorum_not_reached`, zero final_attendance.
- Pass 2 (fake obs: 12 matched across 4 rounds, gap 15min > 10): `status = left_early`, `presence_score = 1.0`, `actual_start=23:05`, `actual_end=23:50`.
- Wrote/removed `test_finalize_maths.py`; kept test DB state (dev only).

**⚠️ TEST DATA LEFTOVER IN DB (do not mistake for real):**
The following rows in the remote DB are dev/test artifacts from this session, NOT real production data:
- `class_sessions.d444c450-...` (maths) — `processing_status=finalized`, `actual_start=23:05`, `actual_end=23:50`
- `attendance_observations` — 12 synthetic rows for Aisha (bdfacf52), 4 capture rounds
- `final_attendance` — 1 row, Aisha, `status=left_early`, `presence_score=1.0`
- `attendance_config` for institution 70881552 — `min_quorum_count` was set to 1 for the test, **already reverted to 4**

Clean up via SQL before any real pilot data is loaded. The fake data passes the left_early logic but is structurally perfect test data (same student, no camera issues, single gap).
**Files changed:**
- `apps/web/app/classes/[id]/page.tsx` (client validation)
- `apps/web/lib/enrollment/classes.ts` (server validation)
- `docs/DECISIONS.md` (two entries added)
- `docs/PROGRESS.md` (this entry)
- `supabase/migrations/0031_...` (pre-existing, applied)
**Left / not done:**
- No real camera-service endpoint call (used DB-level simulation instead of curl with JWT).
- Test DB state (fake observations + final_attendance) remains — could clean before any real pilot data.
**Next session should start with:**
- Clean test data (delete fake observations + final_attendance for session d444c450) if needed; or move to Phase F review queue / operational tasks (backup, rate limits per Session 5 carry-over).
**Open questions for teammate:**
- Confirm camera-service endpoint auth flow — should /finalize require a token from the web auth session, or should it be callable via service role for admin? (Current implementation uses depend(get_current_user) which requires a JWT from the institution user.)
**Blockers:**
- None.

### 2026-08-30 — Session (design-system swap)
**Goal for this session:** Restyle PSYS UI to modern SaaS LMS light theme (Newton-style card dashboard) per user request — full palette swap from dark to light. Inter-only typography (no serif) per user correction.
**Done:**
- Proposed design system before writing code: light palette (`#F8FAFC` bg, `#FFFFFF` surface, `#0F172A` text, `#2563EB` blue primary, `#10B981`/`#F59E0B`/`#EF4444` status), Inter for headings + body (weight-based hierarchy: 600 headings / 400 body / 500 labels) + JetBrains Mono for data, `rounded-2xl` cards with `shadow-sm` and `#E2E8F0` border, right-side info-rail layout.
- Wrote full token swap to `apps/web/app/globals.css`: replaced dark theme tokens, added Google Fonts import (Inter 300/400/500/600/700, JetBrains Mono 400/500), introduced `.card` (rounded-2xl, soft shadow, hover lift) and `.card-compact` for compact widgets, added `.info-rail` for the right-side review/session panel pattern, restyled badges (`.badge-good`/`.badge-warn`/`.badge-bad` with soft fills + colored borders matching the new status hexes), buttons (`.btn-primary` blue with subtle shadow + hover lift, `.btn-secondary` white with border, `.btn-ghost` blue text), forms (`.field-input` with focus ring on primary), and links (`.link-accent` blue with offset underline).
- Confirmed Inter-only typography (no Playfair / serif) per user correction.
**Files changed:**
- `apps/web/app/globals.css` (rewritten — full light-theme token swap, font import, `.card` / `.info-rail` additions, badge/button/form restyles)
- `docs/PROGRESS.md` (this entry)
**Left / not done:**
- Component-level restyles not done — only the token layer (`.card`, `.badge-*`, `.btn-*`, `.field-*` classes) is in place; existing pages (`app/classes/page.tsx`, `app/classes/[id]/page.tsx`, `app/attendance/page.tsx`, `app/attendance/[id]/page.tsx`, `app/disputes/page.tsx`, `app/page.tsx`) still use the old `page-shell` / `ledger-row` patterns and need to be migrated to `.card` + 2-col grid + info-rail.
- No visual verification yet (browser render not run).
**Next session should start with:**
- Apply `.card` / `.badge-*` / `.btn-*` restyles to the attendance detail page (`app/attendance/[id]/page.tsx`) as the template (highest info density + info-rail most useful), then propagate to `app/classes/page.tsx`, `app/classes/[id]/page.tsx`, `app/disputes/page.tsx`, and the home dashboard.
**Open questions for teammate:**
- None — design change is web-side only. No shared tables touched, no migration needed.
**Blockers:**
- None.

### 2026-08-31 — Session (client-component fix + stat zero + dark-leftover cleanup)
**Goal for this session:** Fix the "Event handlers cannot be passed to Client Component props" crash on /classes/[id] (session scheduling form onChange handlers inside a Server Component), clean dark-theme leftovers on the attendance template, and fix the slashed-zero stat-display cosmetic.
**Done:**
- Extracted scheduling validation (onChange + setCustomValidity on scheduled_start / scheduled_end) from server component `app/classes/[id]/page.tsx` into a new `'use client'` component `app/classes/ScheduleSessionForm.tsx`; rendered via `<ScheduleSessionForm classId={id} />`. Server-side `scheduleClassSession()` validation untouched.
- Removed `fileDispute` / `resolveDispute` unused imports from `app/attendance/[id]/page.tsx`; cleaned `bg-white/5`, `bg-transparent`, `text-white/80`, `text-white/70`, and `bg-black/60` dark-theme leftovers (replaced with `.card-compact`, `.field-input`, `var(--text-secondary)`, `bg-black/70` for the photo hover overlay).
- Fixed stat card zero display: `font-mono` → `font-sans tabular-nums` (Inter plain zero at large display size; JetBrains Mono kept for small roll / data IDs where the slashed zero is correct).
**Files changed:**
- `apps/web/app/classes/ScheduleSessionForm.tsx` (created)
- `apps/web/app/classes/[id]/page.tsx` (onChange removed; form replaced with client component; scheduleClassSession import dropped since the form now lives in the client component)
- `apps/web/app/attendance/[id]/page.tsx` (dark-theme leftovers removed; stat numbers switched to font-sans tabular-nums; unused imports cleaned)
- `docs/PROGRESS.md` (this entry)
**Left / not done:**
- Verify /classes/[id] loads in browser with the new client form (server :3000 hot-reloads; cannot curl with classifier interruption).
- Verify end-must-be-after-start UX validation triggers on bad start/end (client-side setCustomValidity preserved in ScheduleSessionForm).
**Next session should start with:**
- Open /classes/[id] in browser to confirm no "Event handlers cannot be passed" error and the start/end validation still triggers on bad inputs.
**Open questions for teammate:**
- None — fix is web-side only (no shared table / camera-service impact; no migration).
**Blockers:**
- None.
