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

## Auth & Access Control (Phase 2 — COMPLETE)

**Status: SATISFIED.**

The auth infrastructure is now fully wired:
- Login page (`/login`) with email/password form
- Login/logout server actions using Supabase Auth
- Middleware protecting routes (redirects to `/login` if unauthenticated)
- Session client (`createClient()`) used by all Server Actions
- `getCurrentUser()` fetching user profile with role/institution_id
- RLS policies for institution-scoped access on all tables
- Storage policies for `enrollment-photos` bucket (institution-scoped uploads)

Spec Section 9 "Access" requirement is enforced:
- Students see only their own attendance (via RLS)
- Teachers see only their assigned classes (via RLS)
- Admins see their institution (via RLS)
- Storage uploads are scoped to the user's institution folder

**Note:** `apps/web/lib/supabase/admin.ts` still exists but is no longer used
by Server Actions. It can be removed in a future cleanup or kept for truly
admin-only operations if needed.
