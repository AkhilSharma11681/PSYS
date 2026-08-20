-- Guardrail 6: prevents duplicate attendance_observations rows if a
-- capture job is retried. Only works because captured_at is now derived
-- once at capture time (capture_worker.py) and threaded through every
-- downstream write, instead of each write generating its own timestamp.
alter table attendance_observations
  add constraint attendance_observations_idempotency
  unique (session_id, student_id, captured_at);
