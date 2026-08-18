-- Adds the audit_logs table and basic institution-scoped RLS policies
-- across all multi-tenant tables. Phase 0 of the spec called for both;
-- neither had been built despite RLS being enabled (with zero policies)
-- on every table -- meaning any access via the anon key would have
-- silently returned zero rows everywhere. This is a starting/draft
-- version covering institution-level isolation; role-based restrictions
-- (e.g. only admins can add cameras) are intentionally left for a
-- follow-up once that's been discussed with the team.

begin;

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  actor_user_id uuid references users(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);
alter table audit_logs enable row level security;

create or replace function public.current_institution_id()
returns uuid
language sql
security definer
stable
as $$
  select institution_id from public.users where id = auth.uid()
$$;

create policy "select own institution" on institutions
  for select using (id = public.current_institution_id());

create policy "select users in own institution" on users
  for select using (institution_id = public.current_institution_id());

create policy "select rooms in own institution" on rooms
  for select using (institution_id = public.current_institution_id());
create policy "write rooms in own institution" on rooms
  for insert with check (institution_id = public.current_institution_id());
create policy "update rooms in own institution" on rooms
  for update using (institution_id = public.current_institution_id());

create policy "select cameras in own institution" on cameras
  for select using (institution_id = public.current_institution_id());

create policy "select camera_health in own institution" on camera_health
  for select using (
    exists (select 1 from cameras where cameras.id = camera_health.camera_id
            and cameras.institution_id = public.current_institution_id())
  );

create policy "select sessions in own institution" on class_sessions
  for select using (institution_id = public.current_institution_id());
create policy "write sessions in own institution" on class_sessions
  for insert with check (institution_id = public.current_institution_id());

create policy "select capture_jobs in own institution" on capture_jobs
  for select using (institution_id = public.current_institution_id());

create policy "select capture_events in own institution" on capture_events
  for select using (institution_id = public.current_institution_id());

create policy "select students in own institution" on students
  for select using (institution_id = public.current_institution_id());
create policy "write students in own institution" on students
  for insert with check (institution_id = public.current_institution_id());
create policy "update students in own institution" on students
  for update using (institution_id = public.current_institution_id());

create policy "select biometrics in own institution" on student_biometrics
  for select using (institution_id = public.current_institution_id());

create policy "select observations in own institution" on attendance_observations
  for select using (institution_id = public.current_institution_id());

create policy "select own config or platform default" on attendance_config
  for select using (institution_id = public.current_institution_id() or institution_id is null);

create policy "select enrollment_jobs in own institution" on enrollment_jobs
  for select using (institution_id = public.current_institution_id());

create policy "select audit_logs in own institution" on audit_logs
  for select using (institution_id = public.current_institution_id());
create policy "write audit_logs in own institution" on audit_logs
  for insert with check (institution_id = public.current_institution_id());

commit;
