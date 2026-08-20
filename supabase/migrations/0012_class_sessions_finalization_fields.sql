-- Adds the remaining class_sessions columns needed before Phase 5
-- (Finalization) can be built: camera_id (which camera serves this
-- session), actual_start/actual_end (quorum-derived, distinct from
-- scheduled_start/scheduled_end), camera_status, processing_status,
-- and finalized_at (the idempotency guard per spec Section 5 Phase E).
-- Purely additive -- safe on top of existing rows.

alter table class_sessions
  add column camera_id uuid references cameras(id),
  add column actual_start timestamptz,
  add column actual_end timestamptz,
  add column camera_status text default 'unknown'
    check (camera_status in ('unknown','healthy','degraded','offline')),
  add column processing_status text default 'pending'
    check (processing_status in ('pending','processing','finalized','failed')),
  add column finalized_at timestamptz;
