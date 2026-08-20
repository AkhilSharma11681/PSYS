-- Phase 4 foundation, scoped narrowly: only classes + class_enrollments.
-- class_sessions is intentionally NOT touched here -- it's currently a
-- 3-column stub, but camera-service's capture_jobs/capture_events/
-- attendance_observations (and our own external_checkin_events) already
-- have live FK references into it. Upgrading it to the real spec schema
-- needs explicit coordination before merging, not a silent drop/recreate.

create table classes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  room_id uuid references rooms(id) not null,
  subject text not null,
  teacher_id uuid references users(id),
  recurrence text, -- e.g. 'MON,WED,FRI 10:00-11:00'
  is_active boolean default true
);
alter table classes enable row level security;

create policy "select classes in own institution" on classes
  for select using (institution_id = public.current_institution_id());
create policy "write classes in own institution" on classes
  for insert with check (institution_id = public.current_institution_id());
create policy "update classes in own institution" on classes
  for update using (institution_id = public.current_institution_id());

-- Many-to-many, replaces any v1 array-column approach. Supports section
-- changes, drops, late joins, and clean historical reporting.
create table class_enrollments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  class_id uuid references classes(id) not null,
  student_id uuid references students(id) not null,
  status text not null default 'active' check (status in ('active','dropped')),
  enrolled_at timestamptz default now(),
  unique(class_id, student_id)
);
alter table class_enrollments enable row level security;

create policy "select enrollments in own institution" on class_enrollments
  for select using (institution_id = public.current_institution_id());
create policy "write enrollments in own institution" on class_enrollments
  for insert with check (institution_id = public.current_institution_id());
create policy "update enrollments in own institution" on class_enrollments
  for update using (institution_id = public.current_institution_id());
