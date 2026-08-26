-- These 2 RLS policies already exist live on the shared dev DB (added
-- directly via SQL Editor while migrating the dashboard's write paths
-- off the service-role client -- their absence was causing silent
-- 0-row deletes/updates under RLS, not errors). Documenting them here
-- so a fresh DB setup doesn't miss them.
--
-- Postgres has no "CREATE POLICY IF NOT EXISTS" -- using drop-then-
-- create for idempotency instead. Harmless on the shared dev DB
-- (recreates the identical policy); creates it properly on a fresh DB.

drop policy if exists "delete biometrics in own institution" on student_biometrics;
create policy "delete biometrics in own institution" on student_biometrics
  for delete using (institution_id = public.current_institution_id());

drop policy if exists "update own config" on attendance_config;
create policy "update own config" on attendance_config
  for update using (institution_id = public.current_institution_id());
