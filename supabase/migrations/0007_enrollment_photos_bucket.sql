-- Creates the enrollment-photos bucket used by apps/web's student photo
-- upload flow and enrollment-worker's download step. Was referenced in
-- code (actions.ts, worker.py) but never actually created, which would
-- have made every enrollment upload fail. Matches the private-bucket
-- pattern used for capture-frames.

insert into storage.buckets (id, name, public)
values ('enrollment-photos', 'enrollment-photos', false)
on conflict (id) do nothing;
