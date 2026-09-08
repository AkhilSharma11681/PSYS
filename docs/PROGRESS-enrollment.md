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

- **2026-09-08 Verification Note:** Migration 0031's `attendance_config` INSERT policy was verified live on remote via direct `pg_policies` query on 2026-09-08 — confirmed working, no further action needed.

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
