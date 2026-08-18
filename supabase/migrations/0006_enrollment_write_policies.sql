-- 0005 added SELECT-only RLS on student_biometrics and enrollment_jobs.
-- Fine while enrollment-worker/apps/web use the service_role key
-- (bypasses RLS), but INSERT/UPDATE policies are needed before either
-- switches to an authenticated/anon-key client.

begin;

create policy "write biometrics in own institution" on student_biometrics
  for insert with check (institution_id = public.current_institution_id());
create policy "update biometrics in own institution" on student_biometrics
  for update using (institution_id = public.current_institution_id());

create policy "write enrollment_jobs in own institution" on enrollment_jobs
  for insert with check (institution_id = public.current_institution_id());
create policy "update enrollment_jobs in own institution" on enrollment_jobs
  for update using (institution_id = public.current_institution_id());

commit;
