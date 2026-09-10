# PSYS — Decision Log

> One line per decision: what was decided and why. Append here whenever you and Claude Code
> settle something non-obvious, so it's never re-litigated or silently reversed later.

- **Replace teammate's stub tables, don't extend them.** `students` and `class_sessions` stubs
  from camera-service were replaced/upgraded with real schemas rather than patched, because
  other tables already had live FKs into them — upgrades had to preserve those FK targets.
- **`student_biometrics` is one row per photo**, not one row per student, with an `is_primary`
  flag and `embedding_version` column — allows re-embedding on model upgrades without losing
  history.
- **Delete the source photo from Storage after embedding generation.** Privacy requirement from
  spec Section 9 — only the embedding is retained long-term, not the raw photo.
- **Roster derivation lives in a Postgres function (`derive_session_roster()`), not app code.**
  The Python camera-service needs to consume the exact same logic as the Next.js side; a shared
  DB function avoids the two implementations drifting apart.
- **`roster_source` constraint was narrowed** from `class_enrollments`/`external_checkin`/`manual`
  to just `external_checkin`/`full_enrollment_fallback` — `derive_session_roster()` only ever
  sets one of the two remaining values, so this was compatible.
- **Permitted exits (`session_exceptions`) are excluded from both `presence_score` and gap-check
  windows** — treated like a camera outage for that student, not counted as absence.
- **Occlusion/camera-condition gaps are never auto-marked `left_early`** — only clean
  `no_face`/`poor_quality` gaps past `max_gap_minutes` are. Anything ambiguous is `uncertain` and
  goes to human review with evidence, never silently resolved.
- **Finalization is idempotent by construction:** atomic `finalized_at` claim means a worker that
  gets no row back must exit immediately without side effects — another worker already finalized.
- **Quorum failure sets `processing_status = 'needs_review'`, not `camera_status`.** Quorum miss
  doesn't necessarily mean the camera was offline — it's a "human should look at this" signal
  distinct from live camera health.
- **Camera degradation windows derived from `capture_events` history**, not just current
  `camera_health` state — need the historical record to explain gaps during past sessions.
- **Single failed capture attempt still counts as degraded window.** Gap-check uses `<=` overlap
  check (not `<`) so a zero-width window from one isolated failure still flags camera issues.
- **Exception windows returned already-resolved from `get_session_exceptions()` RPC.** The
  `return_at` fallback to `actual_end`/`scheduled_end` happens in SQL, not in each caller — same
  pattern as `derive_session_roster()`.
- **Disputes call camera-service endpoint, not direct DB insert.** The endpoint does real work:
  best-evidence photo lookup, dispute-window enforcement against `attendance_config`. A raw
  Supabase insert would silently skip all of that.
- **Best evidence photo for disputes: highest-quality observation with stored photo.** Picks the
  strongest single piece of evidence to show an admin, not just the first or last one.
- **Every dispute resolution logged to `audit_logs`.** Spec requirement: every human decision is
  recorded. Two log entries if attendance is also corrected: one for the dispute, one for the
  final_attendance change.
- **Every migration version must be unique.** The duplicate `0010` migrations were split into
  `0010_external_checkin_events.sql` and `0028_session_roster_derivation.sql` because
  Supabase migration history uses the version number as its primary key and cannot record two
  files under one version.
- **SECURITY DEFINER helper functions used for RLS policies with cross-table checks.** Found
  an infinite recursion bug when `class_sessions` queried `final_attendance`, which in turn
  queried `class_sessions` to verify teacher assignment. Moving the cross-table queries into
  `SECURITY DEFINER` helpers bypasses RLS on the inner check and prevents the loop (fixed in 0029).
- **All SECURITY DEFINER functions must pin `search_path = public, pg_temp`** to prevent
  search_path hijacking. Applied to `is_teacher_for_session`, `is_student_in_session`, and
  `current_student_id` in migration 0030. Also DRY'd `is_student_in_session` to call
  `public.current_student_id()` instead of duplicating the student lookup logic.
- **Class creation server actions and UI added (Session 7).** createClass() sets teacher_id = auth.uid() (admin creating = teacher) rather than accepting a teacher_id form field — keeps the form minimal; the teacher dropdown from the plan was omitted for simplicity.
- **session scheduling only requires scheduled_start / scheduled_end.** All other class_sessions columns (camera_id, actual_start, actual_end, finalized_at, camera_status, processing_status, roster_source) are set to safe defaults; camera-service fills live values during finalization.
- **roster_source pre-set to 'full_enrollment_fallback'** on session insert so derive_session_roster() never hits a null constraint.
- **attendance_config INSERT policy added (0031).** Only SELECT (0005) and UPDATE (0022) policies existed; INSERT was missing, so any /settings save trying to create a new institution-specific config row was blocked by RLS. New policy requires admin role + institution_id = current_institution_id(), matching the 0022/0027 convention. Must be manually applied (Supabase SQL editor or CLI db push) before UI saves work.
- **Session scheduling form must validate end > start at both client and server levels.** Client uses HTML5 onChange/setCustomValidity; server throws in scheduleClassSession(). Missing validation allowed the maths session to get scheduled_end (13:00) before scheduled_start (23:00) — not a timezone conversion bug, just missing guard.**
- **Student dashboard distinguishes two metrics: 'Present Rate' (% finalized sessions marked 'present') and 'Presence' (% of session time detected on camera).** Different definitions: present rate is the institutional attendance metric, presence is a per-session coverage metric from gap_check.py. A student can have low Present Rate with high Presence (e.g., left_early status with presence_score=1.0). UI now labels them distinctly to avoid confusion.
- **Orphaned auth user check added to middleware.** When an auth session exists but no matching `public.users` row is found, middleware signs out and redirects to `/login?reason=orphaned` instead of allowing the page to crash with an unhandled 500 error. This handles stale test sessions gracefully without requiring code changes in `getCurrentUser()` or individual page components.
- **enrollment-worker assumes a single concurrent process.** It uses a read-then-write approach for setting `is_primary` on biometrics without atomic row locking; if scaled to multiple workers, concurrent jobs for the same student will introduce race conditions.
- **Project memory files must remain tracked in git.** A recent commit on main added memory files (`CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, `OPERATIONS.md`) to `.gitignore`; this was reverted during merge on 2026-09-07 because these files are the team's shared persistent coordination mechanism. Flagged for Akhil to confirm.
- **Split docs/PROGRESS.md into per-owner files.** Split into `docs/PROGRESS-enrollment.md` and `docs/PROGRESS-camera.md` because a single shared append-only log caused merge conflicts across branches.
- **Use authenticated client for enrollment photo signed URLs in `students/[id]/page.tsx`.** `createAdminClient()` (service-role, bypasses RLS) was previously used as a temporary workaround before migration 0026 added Storage RLS policies for `enrollment-photos`. Since migration 0026 scopes SELECT access by institution, the authenticated client now works correctly and removes an unneeded privilege-escalation path. Verified manually via browser: signed URL loads correctly using the authenticated client.
- **Known issue:** `app/classes/[id]/page.tsx` and `app/classes/page.tsx` have pre-existing TypeScript errors (`Property 'name'/'full_name'/'roll_number' does not exist on type '{...}[]'`) surfaced during a build check on 2026-09-08 — unrelated to any recent change, not yet fixed.
- **Enrollment photos for jobs flagged as duplicate (status='failed', 'possible duplicate enrollment' error) are intentionally NOT deleted from Storage**, unlike the normal post-embedding deletion policy — an admin needs to see the actual photo to resolve the flagged case. This is a narrow, deliberate exception to the privacy-deletion rule in ARCHITECTURE.md Section 1. Once an admin resolves a flagged job (approves or rejects), the photo should still eventually be deleted — but no automatic cleanup for this exists yet and should be tracked as a follow-up, not assumed handled.
- **Known issue:** the cross-student duplicate-face query in enrollment-worker (worker.py) does not paginate — if student_biometrics grows beyond PostgREST's default row limit (~1000), the duplicate check will silently miss comparisons against students beyond that limit. Not fixed yet; needs a decision on pagination strategy (e.g. batched fetches) before the institution's biometrics table approaches that scale.
- **Pinned search_path on current_institution_id() and current_user_role() (migration 0035)** — these SECURITY DEFINER functions were missed when migration 0030 pinned search_path on is_teacher_for_session, is_student_in_session, and current_student_id, despite being the most widely-used RLS helpers in the codebase. Discovered while reviewing migration 0034 (students.deleted_at / DELETE policy). Logic unchanged, only the search_path hardening was added. Verified via RLS smoke test under an impersonated admin session — role/institution resolution and dependent policies behave identically post-fix.
- **Migrate face recognition from dlib to InsightFace (buffalo_l / ArcFace) (2026-09-10).** Decided to replace the 2017-era dlib model with InsightFace (`buffalo_l` model, ResNet-50 ArcFace 512-D raw feature vectors) based on side-by-side empirical verification against real classroom test photos with 4 enrolled candidates. InsightFace achieved superior separation (~0.70–0.73 cosine similarity for correct matches vs. ~0.11–0.28 for non-matches; zero false positives) and corrected borderline low-confidence match failures observed under dlib. Trade-offs: ~325MB model download footprint and ~1GB RAM peak inference usage (vs. dlib's lower memory footprint); requires re-embedding all existing enrolled students as 512-D ArcFace vectors are incompatible with 128-D dlib vectors; matching thresholds will require recalibration for the cosine similarity scale, and comparisons must use cosine similarity (not Euclidean distance, as the vectors are not L2-normalized). Status: `insightface==2.0` and `onnxruntime==1.29.0` dependencies added to `services/camera-service/requirements.txt`; migration in progress, NOT yet wired into live production matching pipeline.
- **Add `face_embedding_v2` vector(512) nullable column to `student_biometrics` (Migration 0037).** InsightFace embeddings are 512-D and incompatible with the existing `face_embedding` vector(128) column (pgvector throws hard dimension mismatch errors). Adding a separate nullable column bypasses the need to alter the live dlib matching path or its index during the transition. The existing `embedding_model` and `embedding_version` columns correctly track which model generated a row. Current status: schema change only, no data migrated yet, live matching query in camera-service still only reads `face_embedding` (dlib) and is NOT yet updated to read `face_embedding_v2`.

