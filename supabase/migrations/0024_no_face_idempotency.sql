-- Guardrail 6, part 2: NULL student_id observations (no_face/poor_quality/
-- unknown_face) were never caught by unique(session_id, student_id,
-- captured_at) -- Postgres unique constraints treat NULL as always
-- distinct from NULL. Verified: same session+captured_at logged twice
-- with student_id=null produced 2 rows, no constraint violation.
--
-- Only no_face is safely fixable here -- it's genuinely one row per
-- capture round (whole-frame result, not per-face). poor_quality/
-- unknown_face are per-detected-FACE and can legitimately have multiple
-- null-student rows in one round (e.g. 2 poor-quality faces in one
-- frame) -- a real duplicate there needs a per-face identifier (e.g.
-- bounding box) the schema doesn't currently have. NOT fixed here --
-- flagging as a separate open gap, not guessing at a wrong constraint.
create unique index if not exists attendance_observations_no_face_idempotency
  on attendance_observations (session_id, captured_at)
  where match_status = 'no_face';
