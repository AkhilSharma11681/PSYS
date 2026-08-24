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
