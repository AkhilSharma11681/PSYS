# PSYS — Progress Log (feature/enrollment)

> Update this file at the END of every Claude Code session working on feature/enrollment.
> This is how the next session gets caught up, instead of re-reading old chats. Newest entries at the top.

Older completed entries moved to docs/PROGRESS_ARCHIVE.md.

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

### 2026-09-12 — Session 15
**Goal for this session:** Restore dimension-mismatch guard in enrollment-worker duplicate face check, verify test coverage including pagination, document, and clean up stale notes.
**Done:**
- Restored the accidentally removed embedding dimension check (`len(new_embedding) != len(existing_embedding)`) in `is_duplicate_face()` in `services/enrollment-worker/app/worker.py`.
- Added 2 mocked unit test cases in `services/enrollment-worker/test_duplicate_check.py` verifying multi-page pagination (3 batches, 2250 rows) and single-page edge cases for `fetch_other_biometrics()`.
- Verified all 9 unit tests pass in `services/enrollment-worker/test_duplicate_check.py` (7 duplicate matching cases + 2 pagination cases).
- Corrected stale "known issue" notes regarding pagination in `docs/DECISIONS.md` and `docs/PROGRESS-enrollment.md`.
- Documented the regression root cause, risk, fix, and verification in `docs/DECISIONS.md`.
**Files changed:**
- `services/enrollment-worker/app/worker.py`
- `services/enrollment-worker/test_duplicate_check.py`
- `docs/DECISIONS.md`
- `docs/PROGRESS-enrollment.md`
**Left / not done:**
- None.
**Next session should start with:**
- Proceed with pending feature work or remaining unverified items (student dispute filing UI, end-to-end permitted-exit live session verification) as directed by supervisor.
**Open questions for teammate:**
- Unexpected RLS policy violation when inserting into `attendance_observations` with service-role key.
- Memory files (`.gitignore` item) still flagged for Akhil to confirm.
**Blockers:**
- None.

---

### 2026-09-12 — Session 14
**Goal for this session:** Investigate and verify permitted-exit feature and document findings honestly.
**Done:**
- Confirmed permitted-exit feature is fully built across the entire stack (`/sessions/[id]` UI, `markPermittedExit()` server action, `session_exceptions` table, `gap_check.py` excusal calculation, and `orchestrator.py` finalization).
- Confirmed `markPermittedExit()` works via its real server action code path (successfully created a `session_exceptions` row under authenticated admin session).
- Confirmed real-time exit design (`exit_at = now()`) matches UI without backdating (intentional design, not a bug).
- Documented permitted-exit feature status as **partially verified** in `docs/DECISIONS.md`.
- Fully cleaned up all temporary test artifacts and test directories (`test-e2e-permitted-exit/`, `test-setup/`), confirming 0 stray database rows and a clean working tree.
**Files changed:**
- `docs/DECISIONS.md`
- `docs/PROGRESS-enrollment.md`
**Left / not done:**
- End-to-end mathematical excusal verification in `gap_check.py` resulting in `final_attendance` status update and `exception_applied = true` remains unconfirmed (blocked by synthetic test RLS issues on `attendance_observations` using service-role key; see `docs/DECISIONS.md`).
**Next session should start with:**
- Perform end-to-end excusal verification for permitted exits via a real live camera session or after investigating service-role RLS on `attendance_observations`, or proceed with student dispute filing UI as directed by supervisor.
**Open questions for teammate:**
- Unexpected RLS policy violation when inserting into `attendance_observations` with service-role key (service-role should normally bypass RLS).
- Memory files (`.gitignore` item) still flagged for Akhil to confirm.
**Blockers:**
- None.

---

### 2026-09-12 — Session 13
**Goal for this session:** Implement automatic timestamp-to-session matching for check-in CSV import and verify end-to-end.
**Done:**
- Added automatic timestamp-to-session matching to `importCheckins()` in `apps/web/lib/enrollment/checkins.ts`, querying `class_sessions` within a +/-15 minute window around `scheduled_start`/`scheduled_end`.
- Handled ambiguous overlapping sessions by keeping `session_id = NULL` and incrementing an `ambiguous` counter.
- Updated `CheckinUploadForm.tsx` to surface the `ambiguous` count alongside resolved, unresolved, and skipped counts.
- Executed authenticated end-to-end self-test against real database entities covering all 4 cases (single match, no match, unresolved student, ambiguous overlap), verified database rows in `external_checkin_events`, and verified returned metrics.
- Cleaned up all test check-in records and confirmed 0 rows remain.
- Documented decision in `docs/DECISIONS.md`.
**Files changed:**
- `apps/web/lib/enrollment/checkins.ts`
- `apps/web/lib/enrollment/CheckinUploadForm.tsx`
- `docs/DECISIONS.md`
- `docs/PROGRESS-enrollment.md`
**Left / not done:**
- None.
**Next session should start with:**
- Proceed with pending feature work or remaining unverified items (student dispute filing UI, permitted-exit UI) as directed by supervisor.
**Open questions for teammate:**
- Memory files (`.gitignore` item) still flagged for Akhil to confirm.
**Blockers:**
- None.

---

### 2026-09-12 — Session 12
**Goal for this session:** Spot-check `resolveReviewItem()` against real finalized session data and verify RLS authorization behavior.
**Done:**
- Spot-checked `resolveReviewItem()` against a real `uncertain` `final_attendance` record (`1b3c29f4-6308-44d0-9496-6d0effe4037d`, from session `6c9ff1ec-d872-42fe-9b49-87d95b973930`), generated by running `finalize_session()` on a session with real `attendance_observations`, rather than a synthetic test row.
- Verified PASS when called by a user properly authorized under RLS (`admin@test.local`, matching the class's actual `teacher_id`): status correctly changed to 'present' and `audit_logs` entry correctly recorded with `actor_user_id` (`38745115-3314-4032-8488-db196a71f966`). Reverted `final_attendance` status back to 'uncertain' post-test.
- Identified an open correctness bug: an earlier test using `teacher@test.local` (not the assigned teacher for the class) returned `ok: true` from `resolveReviewItem()` but silently updated zero rows due to RLS blocking unauthorized updates without erroring, while still writing an `audit_logs` row.
- Hardened `resolveReviewItem()` in `apps/web/lib/enrollment/attendance.ts` to reject silent no-op updates when RLS blocks unauthorized access (commit `2f6ab5f`).
- Retroactive note on commit `2f6ab5f`: `apps/web/lib/enrollment/attendance.ts` also introduced `triggerCameraCapture(cameraId, sessionId)` and `getLiveSessionData(sessionId)` to support the live session monitoring feature (`apps/web/app/sessions/[id]/live/`), which was not originally documented in the initial session summary.
- Cleaned up temporary test route `apps/web/app/test-action/`.
**Files changed:**
- `apps/web/lib/enrollment/attendance.ts`
- `docs/PROGRESS-enrollment.md`
- `docs/DECISIONS.md`
**Left / not done:**
- `resolveReviewItem()` needs follow-up hardening to verify affected row count (e.g. via `.select()` after update or checking returned rows) and throw/report failure if no rows were modified.
**Next session should start with:**
- Harden `resolveReviewItem()` to check affected row count on update, or proceed with pending feature work.
**Open questions for teammate:**
- Memory files (`.gitignore` item) still flagged for Akhil to confirm.
**Blockers:**
- None.

---

### 2026-09-12 — Session 11
**Goal for this session:** Spot-check `resolveReviewItem()` end-to-end and clean up test data.
**Done:**
- Created a temporary test route `/test-action` to trigger `resolveReviewItem()` using an authenticated session.
- Verified `resolveReviewItem()` behavior against `final_attendance` (status updated to 'present') and `audit_logs` (audit recorded properly).
- Cleaned up test data (`final_attendance` row, `audit_logs` entry, and the temporary test route logic).
- Corrected schema field mismatches in `resolveReviewItem()` located in `apps/web/lib/enrollment/attendance.ts` to log proper `actor_user_id` and metadata instead of legacy `performed_by` fields.
**Files changed:**
- `apps/web/lib/enrollment/attendance.ts`
- `docs/PROGRESS-enrollment.md`
**Left / not done:**
- None.
**Next session should start with:**
- Flip one test session's `recognition_model` to 'insightface', run a live test, then use real results to validate/tune the placeholder thresholds.
**Open questions for teammate:**
- Memory files (`.gitignore` item) still flagged for Akhil to confirm.
**Blockers:**
- None.

---

### 2026-09-11 — Session 10
**Goal for this session:** Fix TypeScript relation type errors in classes pages and restore progress log.
**Done:**
- Restored `docs/PROGRESS-enrollment.md` from Claude Code session transcript.
- Fixed TypeScript relation type errors (`TS2339: Property does not exist on type 'never'`) in `apps/web/app/classes/[id]/page.tsx` and `apps/web/app/classes/page.tsx` by correcting PostgREST query builder generic type parameters.
**Files changed:**
- `docs/PROGRESS-enrollment.md`
- `apps/web/app/classes/[id]/page.tsx`
- `apps/web/app/classes/page.tsx`
**Left / not done:**
- Spot-check `resolveReviewItem()` against a real `uncertain`/`camera_issue` record once one exists.
**Next session should start with:**
- Flip one test session's `recognition_model` to 'insightface' run a live test, then use real results to validate/tune the placeholder thresholds.
**Open questions for teammate:**
- Memory files (`.gitignore` item) still flagged for Akhil to confirm.
**Blockers:**
- This file was briefly lost due to not being git-tracked and has now been restored from a Claude Code session transcript.

---

### 2026-09-10 — Session 9
**Goal for this session:** Clean up test data, re-enroll pilot student, and wire InsightFace embedding generation into enrollment flow.
**Done:**
- Deleted 10 junk/test students (Aditya Raj, Akhil Sharma, Ansh Tomar, navee, Rohan, Aisha Mehta, Ajay Tomar, Test Student One/Two/Three).
- Re-enrolled Ansh Tomar as a real pilot student.
- Wired InsightFace embedding generation into the enrollment flow (`camera-service /internal/embed` + `enrollment-worker`). New enrollments now dual-embed (dlib + InsightFace).
- Added UI badge on student detail page identifying InsightFace status per enrollment photo.
**Files changed:**
- `docs/DECISIONS.md`
- `docs/PROGRESS-enrollment.md`
- `apps/web/app/students/[id]/page.tsx`
- (and backend worker/service files linked to camera-service tasks)
**Left / not done:**
- Spot-check `resolveReviewItem()` against a real `uncertain`/`camera_issue` record once one exists.
**Next session should start with:**
- Flip one test session's `recognition_model` to 'insightface' run a live test, then use real results to validate/tune the placeholder thresholds.
**Open questions for teammate:**
- None.
**Blockers:**
- None.

---

### 2026-09-08 — Session 8
**Goal for this session:** Verify remote migrations, harden security policies, add duplicate-face detection, clean test data, implement student deletion (hard/soft), and fix audit log discrepancies.
**Done:**
- Verified migration 0031 (`attendance_config` INSERT policy) is live on remote via `pg_policies` direct query.
- Removed unneeded admin-client privilege escalation for enrollment photo signed URLs in `apps/web/app/students/[id]/page.tsx` and updated `OPERATIONS.md`.
- Implemented duplicate-face enrollment detection in `services/enrollment-worker/app/worker.py` (including demoted-photo bypass fix) and added comprehensive unit tests in `services/enrollment-worker/test_duplicate_check.py`.
- Cleaned up stale/duplicate test data (today's test runs and legacy Aug 24–30 junk data).
- Identified and resolved a security vulnerability: unpinned `search_path` on `current_institution_id()` and `current_user_role()` via migration `0035_pin_search_path_on_remaining_helpers.sql`, logged in `docs/DECISIONS.md`.
- Implemented complete student deletion workflow: migration `0034_students_deleted_at_and_delete_policy.sql`, `deleteStudent()` server action in `apps/web/lib/enrollment/actions.ts` (with hard vs soft archive logic checking 6 history tables and writing structured `audit_logs`), client confirmation dialog (`DeleteStudentButton.tsx`), filtered main `/students` list, and added `/students/archived` route.
- Fixed schema field-name mismatches in `resolveReviewItem()` (`apps/web/lib/enrollment/attendance.ts`) to use `actor_user_id`, `metadata`, `entity_type: 'final_attendance'`, and `entity_id`.
**Files changed:**
- `docs/PROGRESS-enrollment.md`
- `docs/DECISIONS.md`
- `OPERATIONS.md`
- `services/enrollment-worker/app/worker.py`
- `services/enrollment-worker/test_duplicate_check.py`
- `supabase/migrations/0034_students_deleted_at_and_delete_policy.sql`
- `supabase/migrations/0035_pin_search_path_on_remaining_helpers.sql`
- `apps/web/lib/enrollment/actions.ts`
- `apps/web/lib/enrollment/attendance.ts`
- `apps/web/app/students/page.tsx`
- `apps/web/app/students/archived/page.tsx`
- `apps/web/app/students/[id]/page.tsx`
- `apps/web/app/students/[id]/DeleteStudentButton.tsx`
**Left / not done:**
- Review queue resolution (`resolveReviewItem()`) not yet verified against live UI due to no existing `uncertain`/`camera_issue` rows in `final_attendance`.
- Cross-student duplicate-face query in `worker.py` pagination verified implemented and tested with mock coverage on 2026-09-12 (Session 15); embedding dimension mismatch guard restored.
- Photo cleanup after dismissing duplicate-flagged jobs.
**Next session should start with:**
- Spot-check `resolveReviewItem()` against a real `uncertain`/`camera_issue` record once one exists.
- Consider other ambiguous/unverified items (check-in CSV import, student dispute filing, permitted-exit UI) if time allows.
**Open questions for teammate:**
- Note that `ajaytomar` (`332487b0...`) still has cross-referenced `attendance_observations` and should not be deleted without checking with Akhil since it's used in shared-table test data.
**Blockers:**
- None.

---

- **2026-09-08 Verification Note:** Migration 0031's `attendance_config` INSERT policy was verified live on remote via direct `pg_policies` query on 2026-09-08 — confirmed working, no further action needed.
- **2026-09-10 InsightFace Enrollment Note:** Enrollment flow updated to generate dual embeddings (dlib 128-D `face_embedding` and InsightFace 512-D `face_embedding_v2`) on `student_biometrics` for all new enrollments. UI updated on student detail page to display InsightFace embedding status badge per enrollment photo.
- **2026-09-12 Permitted-Exit Status Note:** Permitted-exit feature is partially verified (full stack implementation and server action confirmed; end-to-end mathematical excusal verification via finalization is pending live session validation — see `docs/DECISIONS.md`).


---

## Test accounts (manual UI testing)

Five Supabase Auth users exist on the linked remote project for manual testing.
The role-scoped test trio are linked to institution "Test University"
(id `70881552-0663-494b-8b95-59cfdd5fb246`); the two named admin accounts are linked to institution `485a5846-54c5-48bf-a523-6f86ecb54c42`.

| Role    | Email               | `public.users.id`                           |
|---------|---------------------|---------------------------------------------|
| admin   | admin@test.local    | 38745115-3314-4032-8488-db196a71f966|
| teacher | teacher@test.local  | 85216994-0d8d-4345-b772-d0f3bb942fae|
| student | student@test.local  | 68714a6a-86ce-405f-a2fb-e5565648e772|
| admin   | akhil@test.com      | 6c37cb61-ca55-45c5-b6a9-160abcf5f592|
| admin   | ansh@test.com       | 52111cdb-6e33-4b7a-927b-1c03ba8e98f0|

Passwords are kept out of this file intentionally — check the local `apps/web/.env.local`
gitignored dev notes, or reset via the Supabase dashboard.

Note: `student@test.local` now has a `students` row (Aisha Mehta, roll PS-2026-084, institution "Test University", consent_given=true).
