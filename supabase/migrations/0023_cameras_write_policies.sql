-- cameras had SELECT-only RLS (same gap pattern found earlier on
-- student_biometrics/attendance_config) — admin needs to actually
-- register cameras via the dashboard, which requires INSERT/UPDATE.
create policy "write cameras in own institution" on cameras
  for insert with check (institution_id = public.current_institution_id());
create policy "update cameras in own institution" on cameras
  for update using (institution_id = public.current_institution_id());
