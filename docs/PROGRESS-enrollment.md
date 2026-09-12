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
