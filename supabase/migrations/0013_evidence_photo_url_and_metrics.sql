-- Adds evidence_photo_url to attendance_observations (spec's dispute
-- flow needs this -- Phase F review/dispute screens show evidence
-- photos) and creates processing_metrics (spec's operational
-- monitoring table, Robustness Guardrails section). Both additive/new,
-- no impact on existing rows or code paths that don't populate them.

alter table attendance_observations
  add column evidence_photo_url text;

create table processing_metrics (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  session_id uuid references class_sessions(id),
  frames_attempted int default 0,
  frames_succeeded int default 0,
  avg_processing_time_ms float,
  recorded_at timestamptz default now()
);
alter table processing_metrics enable row level security;
create policy "select processing_metrics in own institution" on processing_metrics
  for select using (institution_id = public.current_institution_id());
