-- Teammate's Q2 proposal (Phase 5 discussion): quorum failure is a
-- "needs human review" signal distinct from camera_status, which
-- reflects genuine live camera_health, not a quorum-detection outcome.
alter table class_sessions drop constraint class_sessions_processing_status_check;

alter table class_sessions add constraint class_sessions_processing_status_check
  check (processing_status = ANY (ARRAY['pending'::text, 'processing'::text, 'finalized'::text, 'failed'::text, 'needs_review'::text]));
