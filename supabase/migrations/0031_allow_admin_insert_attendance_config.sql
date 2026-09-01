-- Migration 0031: Add INSERT policy for attendance_config
-- Without this policy, RLS blocks admins from inserting a new institution-specific
-- config row via /settings. The SELECT and UPDATE policies existed (0005, 0022)
-- but INSERT was never added — a silent gap that prevented any institution from
-- creating their own config override through the UI.
create policy "insert attendance_config in own institution" on attendance_config
  for insert with check (
    -- Admin can insert for their own institution only
    public.current_user_role() = 'admin'
    and institution_id = public.current_institution_id()
  );
