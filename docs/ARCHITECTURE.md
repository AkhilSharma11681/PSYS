# PSYS — Architecture & Schema (condensed)

> First-pass distillation from the claude.ai chat exports + spec PDF. Gaps are marked
> `[VERIFY]` — have Claude Code re-derive these from the live `supabase/migrations/` folder
> and the full spec, since this doc was built from a partial read of very long chat logs.

## Core flow
1. **Enrollment (your side, done):** student CRUD → photo upload → quality check → face
   embedding generated and stored in `student_biometrics` (one row per photo, `is_primary`
   flag, `embedding_version`, ivfflat vector index via pgvector). Source photo is deleted
   from Storage after embedding generation (privacy cleanup, spec Section 9).
2. **External check-in sync (your side, done):** `external_checkin_events` ingests data from
   the college's existing entry-scan device (e.g. Kent), maps device student refs to
   `students` via `external_student_ref`, with CSV import + roll-number resolution.
   `roster_source = 'full_enrollment_fallback'` is used when a session has no
   `class_enrollments` match and the system falls back to full roster.
3. **Classes/Enrollments (your side, foundation drafted):** `classes` + `class_enrollments`
   tables with RLS. `class_sessions` is a shared table — originally a 3-column stub from the
   teammate, later upgraded (`class_id`, `scheduled_start`, `scheduled_end`, `status`,
   `roster_source`) once other live FKs (`attendance_observations`, capture jobs) were
   accounted for.
4. **Session roster derivation:** implemented as a **Postgres function**,
   `derive_session_roster()` — intersects `class_enrollments` with synced
   `external_checkin_events` for a session; falls back to full enrollment
   (`roster_source = 'full_enrollment_fallback'`) when no check-in match exists. Built as a
   SQL function (not app code) specifically so the Python camera-service can call the same
   logic instead of re-implementing it.
5. **Capture / matching (teammate's side):** `cameras` (with `camera_rtsp_url`, tied to
   `rooms`), `camera_health` (tracks `consecutive_failures`, `camera_issue` status),
   `capture_events`, `attendance_observations` (`match_status`: `matched` / `unknown_face` /
   `no_face` / `poor_quality` / `uncertain`, `confidence_score`).
6. **Finalization (Phase 5 — jointly owned, highest-risk piece per spec):**
   - Idempotency guard: `update class_sessions set finalized_at = now() where id = $1 and
     finalized_at is null returning id` — no row returned means another worker already ran it.
   - **Quorum detection** (mostly camera-service side): group `matched` observations by
     capture round; `actual_start` = first round where distinct matched-student count crosses
     `max(quorum_fraction × roster_size, min_quorum_count)` (config in `attendance_config`,
     `roster_size` from `derive_session_roster()`); `actual_end` = last such round. No round
     crosses quorum → fall back to `scheduled_start/scheduled_end` + flag session
     `camera_issue`.
   - **Presence + permitted exits:** students under `min_valid_observations` → `uncertain`.
     `presence_score` computed only from observations inside `[actual_start, actual_end]`.
     `session_exceptions` (permitted exits, has `exit_at`/`return_at`) are *excluded* from this
     window — treated like a camera outage, not held against the student.
     `final_attendance.exception_applied = true` when this applies.
   - **Gap check (mid-class exit):** largest gap between a student's consecutive `matched`
     observations (skipping exception windows). Clean `no_face`/`poor_quality` gap past
     `max_gap_minutes` (default 10, from `attendance_config`) → `left_early`. Gap caused by
     occlusion/camera condition → `uncertain` (not auto-marked; shown to teacher with evidence).
   - **Human review (Phase F):** only `uncertain`/`camera_issue` sessions surface on the
     teacher dashboard; one-click resolve writes to `audit_logs`. Late permitted-exit reports
     don't silently overwrite an already-finalized result — they go through a dispute path.
   - Three handoff contracts agreed with teammate for this phase:
     1. Quorum detection: reads `matched` observations + roster size → outputs
        `actual_start`/`actual_end` or `camera_issue`.
     2. Gap-check + `session_exceptions`: needs both observation timeline (camera-service) and
        roster/enrollment context (enrollment side) → outputs `left_early` / `uncertain` /
        normal.
     3. `final_attendance` materialization: consumes both of the above.

## Key tables (as understood — `[VERIFY]` against live migrations)
- `institutions`, `users`, `rooms` — Phase 0 foundation
- `students` (replaced teammate's stub), `student_biometrics`
- `external_checkin_events`, `external_student_ref`
- `classes`, `class_enrollments` (`status`: active/inactive/graduated/transferred)
- `class_sessions` (shared; `scheduled_start/end`, `actual_start/end`, `status`, `roster_source`,
  `finalized_at`)
- `cameras`, `camera_health`, `capture_events`
- `attendance_observations` (unique on `session_id, student_id, captured_at`)
- `session_exceptions`, `final_attendance`, `attendance_config`, `audit_logs`, `processing_metrics`
- `[VERIFY]` — check `session_exceptions` and `final_attendance` column-level schema against
  whatever was actually agreed on the teammate call; the chat only got to the draft-schema stage.

## Known cross-branch friction points (watch for these)
- Migration numbering has collided across branches before (both sides pushed different files
  numbered `0011`) — always `ls supabase/migrations/ | sort` after merging `main`.
- `roster_source` check constraint was tightened once (dropped `manual` as a valid value,
  restricted to `external_checkin`/`full_enrollment_fallback`) — confirm `derive_session_roster()`
  still only ever sets values inside the current constraint.
- Confirm whether camera-service calls `derive_session_roster()` directly or reimplemented its
  own roster query — duplicating that logic was explicitly flagged as a risk to avoid.
