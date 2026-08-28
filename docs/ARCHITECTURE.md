# PSYS — Architecture & Schema (current implementation)

> Derived from live code in supabase/migrations/, services/camera-service/, and apps/web/.
> This document reflects what's actually built, not spec intent.

## Core flow

### 1. Enrollment (apps/web side, complete)
- Student CRUD with consent tracking (`students.consent_given`, `consent_recorded_at`)
- Photo upload → quality check → face embedding stored in `student_biometrics`
- **One row per photo** (not per student) with `is_primary` flag and `embedding_version`
- Source photo deleted from Storage after embedding generation (privacy requirement)
- `enrollment_jobs` tracks async embedding generation with retry support (`retry_count` column)
- Student status transitions: when status changes to `graduated` or `transferred`, biometrics are deleted (not for `inactive` — expected to return)

### 2. External check-in sync (apps/web side, complete)
- `external_checkin_events` ingests data from college's entry-scan device (e.g., Kent)
- Maps `external_student_ref` to `students.id` via `student_id` column
- Manual CSV import with roll-number resolution
- Used by `derive_session_roster()` to determine who to watch for in a session

### 3. Classes/Enrollments (apps/web side, complete)
- `classes` table with `room_id`, `subject`, `teacher_id`, `recurrence`, `is_active`
- `class_enrollments` many-to-many with `status` (`active`/`dropped`)
- `class_sessions` is a shared table (upgraded from teammate's stub) with:
  - Scheduling: `scheduled_start`, `scheduled_end`
  - Actual boundaries: `actual_start`, `actual_end` (quorum-derived)
  - Status tracking: `camera_status` (`unknown`/`healthy`/`degraded`/`offline`), `processing_status` (`pending`/`processing`/`finalized`/`failed`/`needs_review`)
  - Roster source: `roster_source` (`external_checkin`/`full_enrollment_fallback`)
  - Idempotency: `finalized_at` guards against double-finalization

### 4. Session roster derivation (Postgres function, complete)
- `derive_session_roster(p_session_id)` — shared SQL function
- Intersects `class_enrollments` with synced `external_checkin_events`
- Falls back to full enrollment when no check-in data exists
- Sets `roster_source` on `class_sessions` to make derivation visible
- **Called by both apps/web and camera-service** — avoids duplicate logic

### 5. Capture / Matching (camera-service side)
- `cameras` with `camera_rtsp_url`, tied to `rooms`
- `camera_health` tracks `consecutive_failures`, `camera_issue` status
- `capture_events` logs each capture attempt (succeeded/failed)
- `attendance_observations` stores matches with:
  - `match_status`: `matched`/`unknown_face`/`no_face`/`poor_quality`/`uncertain`
  - `confidence_score`, `quality_score`
  - `evidence_photo_url` for disputed cases
  - Unique constraint on `(session_id, student_id, captured_at)` for idempotency

### 6. Finalization (Phase 5 — camera-service side, complete)
Located in `services/camera-service/app/finalization/`:

#### orchestrator.py — Top-level entry point
- `finalize_session(session_id)` — idempotent via `finalized_at` atomic update
- Calls `detect_session_boundaries()`, writes to `class_sessions`
- If quorum reached, iterates through roster calling `compute_student_presence()`
- Persists results to `final_attendance` table

#### boundaries.py — Quorum detection
- `detect_session_boundaries()` — groups `matched` observations by `captured_at`
- Each distinct `captured_at` is one capture round
- Threshold: `max(quorum_fraction × roster_size, min_quorum_count)`
- No quorum → falls back to `scheduled_start`/`scheduled_end`, sets `processing_status = 'needs_review'`

#### gap_check.py — Gap analysis with camera-issue handling
- `compute_student_presence()` — main per-student computation
- Excludes observations during `session_exceptions` windows
- Checks `min_valid_observations` threshold
- Computes `presence_score = matched_count / valid_obs`
- Gap analysis for `left_early` detection:
  - Gaps > `max_gap_minutes` trigger verdict
  - Checks if gap overlaps with camera-degraded windows (from `capture_events`)
  - Clean `no_face`/`poor_quality` evidence → `left_early`
  - Camera-degraded or ambiguous evidence → `camera_issue` or `uncertain`
- Final status: `camera_issue` > `uncertain` > `left_early` > presence-score-based (`present`/`absent`)

#### camera_windows.py — Camera degradation tracking
- `get_camera_degraded_windows()` — derives time windows from failed `capture_events`
- Consecutive failed attempts merged into single window

#### exceptions.py — Permitted exits
- `fetch_exception_windows_by_student()` — calls `get_session_exceptions()` RPC
- Groups results by student for gap-check consumption

### 7. Session exceptions (shared, complete)
- `session_exceptions` table: permitted exits with `exit_at`, `return_at`, `reason`, `marked_by`
- `get_session_exceptions(p_session_id)` RPC — resolves `return_at` to `actual_end` or `scheduled_end`
- **Excluded from presence_score and gap-check windows** — treated as camera outage for that student
- Web actions in `apps/web/lib/enrollment/exceptions.ts`: `markPermittedExit()`, `recordReturn()`

### 8. Final attendance (shared, complete)
- `final_attendance` table:
  - `status`: `present`/`absent`/`left_early`/`uncertain`/`camera_issue`
  - `presence_score`, `exception_applied`, `finalized_at`
  - Unique on `(session_id, student_id)`

### 9. Human review (Phase F — partially complete)
- `get_review_queue(session_id)` — returns `uncertain`/`camera_issue` rows with evidence photos
- Teacher dashboard surfaces these for manual resolution

### 10. Disputes (Phase 7 — complete)
- `disputes` table: `final_attendance_id`, `student_id`, `reason`, `status` (`pending`/`approved`/`rejected`), `evidence_photo_url`
- `dispute_window_hours` config (default 48h)
- `create_dispute()` — auto-attaches best evidence photo, enforces window
- `resolve_dispute()` — updates status, optionally corrects `final_attendance`, logs to `audit_logs`
- Web actions in `apps/web/lib/enrollment/disputes.ts` call camera-service endpoints

## Configuration

### attendance_config table
Per-institution thresholds (all configurable, never hardcoded):
- `present_threshold`, `left_early_threshold` — presence score boundaries
- `min_valid_observations` — minimum matched observations needed
- `max_gap_minutes` — gap threshold for `left_early`
- `quorum_fraction`, `min_quorum_count` — session start/end detection
- `capture_buffer_minutes` — scheduling buffer
- `dispute_window_hours` — time window for filing disputes
- Platform default row has `institution_id IS NULL`, institution-specific overrides exist

### Config access pattern
- `get_recognition_config(institution_id)` in camera-service
- Falls back to platform default if no institution-specific row
- In-memory cache (process-scoped, clears on restart)

## Key tables

### Core (Phase 0)
- `institutions`, `users`, `rooms`

### Enrollment (apps/web owned)
- `students` — with `status`, `consent_given`, `consent_recorded_at`, `enrollment_photo_count`
- `student_biometrics` — one row per photo, `face_embedding vector(128)`, `is_primary`, `embedding_version`, `quality_score`
- `enrollment_jobs` — async embedding queue with `retry_count`

### Classes/Sessions (shared)
- `classes` — with `room_id`, `subject`, `teacher_id`, `recurrence`, `is_active`
- `class_enrollments` — many-to-many with `status` (`active`/`dropped`)
- `class_sessions` — shared table with scheduling, boundaries, camera status, processing status, finalized_at

### External check-in (apps/web owned)
- `external_checkin_events` — raw check-in data from external devices

### Capture/Matching (camera-service owned)
- `cameras`, `camera_health`, `capture_jobs`, `capture_events`
- `attendance_observations` — with idempotency constraint, evidence photos

### Finalization (shared)
- `session_exceptions` — permitted exits
- `final_attendance` — computed attendance with status, presence_score
- `attendance_config` — thresholds and parameters
- `disputes` — dispute tracking with evidence

### Audit
- `audit_logs` — all human decisions logged

### Operational monitoring
- `processing_metrics` — aggregate counters (frames attempted/succeeded, latency) per session

## Migration history (as of 2026-08-28)

Current highest: `0025_enrollment_jobs_retry_count.sql`

Key migrations:
- `0002` — Replaced stub `students`/`student_biometrics` with real schema
- `0008` — `classes` and `class_enrollments`
- `0009` — Upgraded `class_sessions` from stub (teammate's side)
- `0010` (two files) — `external_checkin_events` and `derive_session_roster()`
- `0015` — Idempotency constraint on `attendance_observations`
- `0016` — `session_exceptions`, `final_attendance`, `get_session_exceptions()` RPC
- `0017` — Unique constraint on `attendance_config.institution_id`
- `0018` — Added `needs_review` to `processing_status` check
- `0019` — `disputes` table and `dispute_window_hours`
- `0020` — `student_consent` tracking
- `0021` — `institution_timezone`
- `0024` — Additional idempotency for `no_face` observations
- `0025` — `retry_count` for enrollment jobs

## Cross-branch ownership

### apps/web (feature/enrollment)
- Student CRUD and enrollment
- Class/enrollment management
- External check-in sync
- Session scheduling UI
- Permitted exit marking
- Dispute filing
- Config management

### camera-service (feature/camera-service)
- Camera health monitoring
- Capture orchestration
- Face matching
- Finalization logic (boundaries, gap-check, attendance computation)
- Dispute resolution
- Review queue generation

### Shared tables (coordinate before modifying)
- `class_sessions` — both sides have live FKs
- `attendance_observations` — written by camera-service, read by both
- `session_exceptions` — written by web, read by camera-service
- `final_attendance` — written by camera-service, read by both
- `attendance_config` — read by both

## Key design decisions (reflected in code)

1. **Roster derivation in SQL** — `derive_session_roster()` is a Postgres function so both sides call the same logic
2. **Exception windows in SQL** — `get_session_exceptions()` RPC handles `return_at` fallback consistently
3. **Idempotency via `finalized_at`** — atomic update returns no rows if already claimed
4. **Camera degradation from `capture_events`** — historical record, not just current `camera_health`
5. **Per-student gap verdicts** — each gap evaluated independently, most severe wins
6. **Evidence photos attached to disputes** — auto-select highest quality observation
7. **Config never hardcoded** — all thresholds in `attendance_config`, recalibratable per institution
8. **Consent required** — `consent_given` enforced at student creation (spec Section 9)
