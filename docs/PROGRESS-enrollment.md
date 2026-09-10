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
- Memory files (`.gitignore` item) still flagged for Akhil to confirm.
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
- Cross-student duplicate-face query in `worker.py` lacks pagination for large biometrics datasets (>1000 rows).
- Photo cleanup after dismissing duplicate-flagged jobs.
**Next session should start with:**
- Spot-check `resolveReviewItem()` against a real `uncertain`/`camera_issue` record once one exists.
- Consider other ambiguous/unverified items (check-in CSV import, student dispute filing, permitted-exit UI) if time allows.
**Open questions for teammate:**
- Memory files (`CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/PROGRESS*.md`, `OPERATIONS.md`) gitignore item still flagged for Akhil to confirm.
- Note that `ajaytomar` (`332487b0...`) still has cross-referenced `attendance_observations` and should not be deleted without checking with Akhil since it's used in shared-table test data.
**Blockers:**
- None.

---

- **2026-09-08 Verification Note:** Migration 0031's `attendance_config` INSERT policy was verified live on remote via direct `pg_policies` query on 2026-09-08 — confirmed working, no further action needed.
- **2026-09-10 InsightFace Enrollment Note:** Enrollment flow updated to generate dual embeddings (dlib 128-D `face_embedding` and InsightFace 512-D `face_embedding_v2`) on `student_biometrics` for all new enrollments. UI updated on student detail page to display InsightFace embedding status badge per enrollment photo.
- **2026-09-11 Test Student Dual Embedding Note:** Generated and verified InsightFace embedding (`face_embedding_v2`, 512-D) for test student Rohan (`569c5308-4b6a-4aa3-918d-bf1b155fadb4`) in "Test University" using existing photo and dual-embedding tooling (`camera-service /internal/embed` + `enrollment-worker`) to enable multi-student InsightFace live testing.


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

