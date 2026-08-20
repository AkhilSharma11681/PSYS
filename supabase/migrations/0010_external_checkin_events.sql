-- Raw check-in events from the college's existing entry-scan device
-- (e.g. Kent). Separate source of truth from anything our own cameras
-- observe — tells us WHO to watch for in a session, not how long they
-- stayed. Populated by manual CSV import for now (spec Section 5,
-- Phase A.5 — device currently only confirmed to return timestamp-only
-- data, so building a guessed API integration would be premature).
create table external_checkin_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  source text not null default 'kent',
  external_student_ref text not null,
  student_id uuid references students(id),
  checked_in_at timestamptz not null,
  session_id uuid references class_sessions(id),
  raw_payload jsonb,
  synced_at timestamptz default now(),
  unique(source, external_student_ref, checked_in_at)
);

alter table external_checkin_events enable row level security;

create policy "select checkins in own institution" on external_checkin_events
  for select using (institution_id = public.current_institution_id());
create policy "write checkins in own institution" on external_checkin_events
  for insert with check (institution_id = public.current_institution_id());
create policy "update checkins in own institution" on external_checkin_events
  for update using (institution_id = public.current_institution_id());
