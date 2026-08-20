-- Upgrades class_sessions from its 3-column stub to the real spec
-- schema. Purely additive (ALTER TABLE ADD COLUMN only) -- never
-- drops/recreates the table, since capture_jobs, capture_events,
-- attendance_observations, and external_checkin_events all have live
-- FK references into it. Existing rows get safe defaults/nulls.

alter table class_sessions
  add column class_id uuid references classes(id),
  add column scheduled_start timestamptz,
  add column scheduled_end timestamptz,
  add column status text not null default 'scheduled'
    check (status in ('scheduled','in_progress','completed','cancelled')),
  add column roster_source text not null default 'class_enrollments'
    check (roster_source in ('class_enrollments','external_checkin','manual'));
