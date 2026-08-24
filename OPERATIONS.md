# Operations Notes

## Backup & Recovery (Spec Section 7 — Operational Basics)

**Status: NOT SATISFIED — flagged, not blocking (no real student data loaded yet).**

Supabase's automatic backups require a paid plan; the project is currently
on the free tier, which does not include automatic database backups.

Spec requirement: "Supabase's automatic backups must be confirmed enabled
and their retention window documented before any real student data is
loaded."

**Action required before onboarding any real institution/student data:**
1. Upgrade to a Supabase plan with Point-in-Time Recovery or daily backups, OR
2. Set up a manual backup cron (e.g. `pg_dump` via the Supabase connection
   string, stored somewhere durable) as a stopgap until upgrading.

Until one of the above is done, a database-level incident (accidental
delete, bad migration, etc.) has no recovery path beyond what's in git
(migrations) and Storage's own versioning (photos only, not table data).

Owner: revisit before Phase 0 pilot goes live with a real institution.

## Auth Bypass (Temporary — flagged in code, documenting here too)

**Status: KNOWN GAP — every dashboard write currently bypasses RLS.**

`apps/web/lib/supabase/admin.ts` uses the Supabase service-role client for
all Server Actions (student CRUD, exceptions, disputes, etc.), because no
real login/session system exists yet. This means:

- `session_exceptions.marked_by` is hardcoded to a dev test-user ID
  (`DEV_TEACHER_ID` in `lib/enrollment/exceptions.ts`), not derived from
  an actual logged-in teacher.
- The RLS policies already written (institution-scoping,
  `current_user_role()` role-checks, Guardrail 17) are correct and will
  work once real auth exists, but are currently *not being exercised* --
  the service-role client bypasses RLS entirely.
- Spec Section 9 "Access" requirement (students see only their own
  attendance, teachers see only their assigned classes) is not yet
  enforced at the application layer for the same reason.

**Action required before any real institution use:** build the actual
Supabase Auth login flow (student/teacher/admin roles, session handling)
and switch Server Actions from the admin client to a per-request client
scoped to the logged-in user, so RLS actually applies. This is a
cross-cutting change (affects every write path), not a solo/quick fix --
needs to be planned together.
