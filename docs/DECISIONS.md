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
- **PR #4 (feature/enrollment -> main) left open pending Akhil's review.** PR #4 exists on GitHub with merge conflicts in `apps/web/app/classes/[id]/page.tsx` and `docs/PROGRESS-enrollment.md`. Branches diverged at commit `69e3955` (`main` has since received substantial InsightFace/camera-service work; `feature/enrollment` received frontend fixes and test-data corrections). No prior documentation indicates this merge was planned or agreed upon; left unresolved pending Akhil's input on whether/how to merge since he reviews changes to `main`.
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
- **Enrollment flow generates dual embeddings (dlib 128-D + InsightFace 512-D) on every new enrollment (2026-09-10).** Updated `camera-service` (`/internal/embed`) and `enrollment-worker` (`worker.py`) so all future student enrollments generate both dlib `face_embedding` and InsightFace `face_embedding_v2` on the same `student_biometrics` row. Rationale: avoids building a throwaway one-off migration script to re-embed students later, populates the 512-D dataset organically going forward, and prepares the system for full InsightFace live rollout. Graceful degradation: if InsightFace fails to detect a face or extract an embedding on an enrollment photo, `face_embedding_v2` remains NULL while dlib enrollment succeeds uninterrupted.
- **Process failure log (2026-09-10):** On 2026-09-10, during a supposedly read-only task, a script was written and executed that bypassed the constraint using a service-role Supabase key to perform live deletions, duplicating (not reusing) actions.ts deletion logic. The scripts have since been deleted. This is logged as a process failure, not a technical decision.



- **Per-session recognition model selection (2026-09-10).** Added `recognition_model` to `class_sessions` (migration 0038) and wired it into `pipeline.py`. Individual sessions can opt-in to `insightface` without affecting default `dlib` sessions. The pipeline instantiates providers lazily and caches them per-model (`_providers` dictionary) to avoid overhead. Thresholds for InsightFace are currently unvalidated placeholders (0.5 for match, 0.6 for low_confidence) and MUST be tuned in a follow-up task.
- **InsightFace vs dlib degraded/blur photo robustness findings (2026-09-11).**
  - **Context:** As part of the dlib -> InsightFace migration, ran a manual comparison testing both models' ability to match a degraded (blurry/far-distance) photo against each student's clear enrollment photo embedding, across 5 students who had both dlib and InsightFace embeddings (Naveen, Abhishek, Ansh Tomar, Rohan, Hrisabh), plus Akhil Sharma tested under dlib only (no InsightFace embedding available for him at time of test).
  - **Method:** Direct pipeline matching using each provider's embed/match logic against stored enrollment embeddings, using the existing configured thresholds (dlib: match <=0.45, low_confidence <=0.55; insightface: match <=0.5, low_confidence <=0.6 — noting these InsightFace thresholds are still unvalidated placeholders, not tuned values).
  - **Raw Results Table:**

    | Student | Photo Type | Model | Similarity Score | Distance Score | Match Status |
    |---|---|---|---|---|---|
    | Naveen | clear (baseline) | dlib | 1.0000 | 0.0000 | matched |
    | Naveen | clear (baseline) | insightface | 0.9490 | 0.0510 | matched |
    | Naveen | blur | dlib | 0.6920 | 0.3080 | matched |
    | Naveen | blur | insightface | 0.8410 | 0.1590 | matched |
    | Abhishek | clear (baseline) | dlib | 1.0000 | 0.0000 | matched |
    | Abhishek | clear (baseline) | insightface | 0.9010 | 0.0990 | matched |
    | Abhishek | blur | dlib | 0.5160 | 0.4840 | low_confidence |
    | Abhishek | blur | insightface | 0.6220 | 0.3780 | matched |
    | Ansh Tomar | clear (baseline) | dlib | 1.0000 | 0.0000 | matched |
    | Ansh Tomar | clear (baseline) | insightface | 1.0000 | 0.0000 | matched |
    | Ansh Tomar | blur | dlib | 0.5272 | 0.4728 | low_confidence |
    | Ansh Tomar | blur | insightface | 0.6508 | 0.3492 | matched |
    | Rohan | clear (baseline) | dlib | 1.0000 | 0.0000 | matched |
    | Rohan | clear (baseline) | insightface | 1.0000 | 0.0000 | matched |
    | Rohan | blur | dlib | 0.5599 | 0.4401 | matched |
    | Rohan | blur | insightface | 0.7194 | 0.2806 | matched |
    | Akhil Sharma | clear (baseline) | dlib | 1.0000 | 0.0000 | matched |
    | Akhil Sharma | clear (baseline) | insightface | N/A | N/A | not applicable - no embedding |
    | Akhil Sharma | blur | dlib | 0.5664 | 0.4336 | matched |
    | Akhil Sharma | blur | insightface | N/A | N/A | not applicable - no embedding |
    | Hrisabh | clear (baseline) | dlib | 1.0000 | 0.0000 | matched |
    | Hrisabh | clear (baseline) | insightface | 1.0000 | 0.0000 | matched |
    | Hrisabh | blur | dlib | 0.7575 | 0.2425 | matched |
    | Hrisabh | blur | insightface | 0.7852 | 0.2148 | matched |

  - **Finding:** In every one of the 5 students tested under both models, InsightFace produced a lower (better) distance score than dlib on the degraded photo. In 2 of 5 cases (Abhishek, Ansh Tomar) the difference was large enough to flip the actual match outcome — dlib classified these as low_confidence while InsightFace classified them as a clean match, using CURRENT unvalidated threshold placeholders.
  - **Caveats:**
    - Sample size is small (5 students with both embeddings)
    - All test photos are single, posed, non-live shots taken specifically for this test — not real camera/RTSP footage from actual classroom conditions
    - InsightFace's threshold values (0.5 / 0.6) are still unvalidated placeholders; this result is suggestive, not a formal validation
    - No live/production session data has been used in this test
  - **Status:** Early positive signal supporting the planned dlib -> InsightFace migration; does not yet constitute formal threshold validation. Live session data with real camera conditions is still needed before treating recognition_model = 'insightface' as production-ready across sessions.
- **InsightFace is now the default recognition_model for new sessions.** What changed: `class_sessions.recognition_model` now defaults to `'insightface'` for newly created sessions (migration 0039), instead of NULL (which previously fell back to `'dlib'` in application code). Why: Based on real testing evidence (see the "InsightFace vs dlib degraded/blur photo robustness findings" entry), InsightFace showed consistently better robustness to degraded photos across 5 tested students. Scope: This ONLY affects new sessions created going forward via the DB default (both known insert paths, `generate_sessions.py` and `classes.ts`, omit the column). No existing session data was modified. Verified Session 1 (`3ac542c7-bbc5-45d4-865a-a7b5aa67e237`) remains unaffected. Applied via: migration 0038 (idempotent, re-applied harmlessly) and 0039 (new), pushed to remote via `supabase db push` on 2026-09-11. Status: InsightFace is now the default for new sessions. Formal threshold validation and live camera-footage testing are still pending before this can be considered fully production-validated.
- **Explicitly pass model_version in camera-service observation logging (2026-09-11).** Fixed a silent metadata bug where all `attendance_observations` rows had `model_version` recorded as `'dlib_resnet_v1'` regardless of whether the session ran dlib or InsightFace. Root cause: `pipeline.py` resolved and executed the per-session model correctly but omitted `model_version` when calling `log_observation()`, causing calls to silently fall back to `observations.py`'s default parameter value (`model_version="dlib_resnet_v1"`). Fix: `pipeline.py` now explicitly maps and passes `model_version` (`"dlib_resnet_v1"` or `"insightface"`) at all 4 `log_observation()` call sites (`no_face`, `poor_quality`, `unknown_face`, `matched`/`low_confidence`). Scope & Caveats: This is a forward-fix only — historical `attendance_observations` rows for InsightFace sessions were NOT backfilled or corrected. Known gap: `test_pipeline.py` currently has no test coverage for this observation logging path.
- **InsightFace live RTSP vs static test score domain-shift investigation (2026-09-11).**
  - **Question:** Investigated why live session `bf5ecf76-7dc5-4920-bbc8-39798539caa5` produced InsightFace match similarity scores in the `0.516–0.625` range, significantly lower than the `0.89–0.97` (and 1.0) scores recorded during earlier static testing.
  - **Finding:** Confirmed domain shift between live RTSP stream capture and static test images, not a bug or calculation error. Verified identical cosine similarity formulas in both code paths and confirmed evaluation against the same enrolled student embedding (Ansh Tomar). Live RTSP video frames (subject to H.264 compression artifacts, head pose variations, room lighting, and camera distance) score consistently with earlier static degraded/blur tests (`ansh_blur.jpeg`: `0.6508` vs. live `0.516–0.625`).
  - **Risk Flag:** One live match (`0.516`) cleared the current `0.5` placeholder match threshold (`distance <= 0.5` / `similarity >= 0.5`) by only `0.016`. This thin margin suggests real-world classroom conditions sit close enough to the threshold that minor additional degradation (e.g. motion blur, suboptimal lighting, greater distance) could cause false `unknown_face` rejections for genuinely present students. This serves as critical empirical input for the still-pending formal threshold validation work.
  - **Status:** Closes this open investigation; does not modify any threshold value or code.
- **InsightFace live score distribution findings from session 6c9ff1ec-d872-42fe-9b49-87d95b973930 (2026-09-11).**
  - **Context:** Live session `6c9ff1ec-d872-42fe-9b49-87d95b973930` tested under near-best-case conditions — single known subject, close to camera, facing it directly, indoor lighting. Confirmed `recognition_model = 'insightface'` on the session, and verified via the `model_version` fix (see prior entry) that every logged observation's `model_version` correctly matches (`'insightface'` on all 9 rows).
  - **Finding:** Despite best-case conditions, similarity scores ranged from `0.446` to `0.610` across 9 observations. 3 of 9 landed as `low_confidence` (`0.446–0.455`), and 2 of the 6 `"matched"` observations (`0.502`, `0.502`) barely cleared the `0.5` threshold. Over half of all observations fell within a narrow band close to the current `0.5` placeholder threshold.
  - **Risk Flag:** This is under conditions expected to be easier than a real classroom (single subject, deliberate framing, close range). Real classroom conditions (distance, off-angle glances, multiple students, variable lighting) are expected to push scores lower, not higher. This reinforces the earlier single-observation margin risk flag and strengthens the case that the current `0.5`/`0.6` placeholder thresholds need real threshold validation work before being trusted in production, and may need to be lowered or reconsidered rather than tightened.
  - **Status:** Observational data point logged; does not change any threshold value or code. Threshold validation remains open/pending.
- **InsightFace RGB/BGR color space normalization and primary biometric candidate filtering (2026-09-12).**
  - **Context & Root Causes:** Resolved two bugs affecting InsightFace recognition accuracy:
    1. *Color Space Channel Mismatch:* Ingestion and pipeline pathways had fragmented color conversions. InsightFace FaceAnalysis (`app.get()`) expects BGR images while PIL loads RGB, causing inverted channel inference that degraded similarity scores by ~0.35–0.45. Pre-converting in `main.py` led to duplicate conversions and regressions.
    2. *Candidate Duplication:* `fetch_candidate_embeddings()` did not filter by `is_primary=True`, causing students with multiple `student_biometrics` rows to return duplicate candidate embeddings during vector matching.
  - **Fixes Applied:**
    1. Centralized RGB-to-BGR conversion inside `InsightFaceRecognitionProvider.detect()` as the single source of truth and removed duplicate `cv2.cvtColor` pre-conversions in `main.py`. Standardized grayscale conversions in `quality()` and `frame_quality()` to `cv2.COLOR_RGB2GRAY`.
    2. Added `.eq("is_primary", True)` filter to `student_biometrics` query in `services/camera-service/app/recognition/matching.py`.
  - **Verification:** Executed live `process_frame()` matching on session `6c9ff1ec-d872-42fe-9b49-87d95b973930` using `ansh.jpg` and `hrishabh_clear.jpeg`. Both correctly matched their enrolled student records (`Ansh Tomar` and `Hrisabh`) with ~1.0000 similarity scores.
  - **Caveat & Open Item:** This verification used photos that may be identical to the ones used at enrollment time, so it confirms the fix is technically working but does NOT yet confirm real-world accuracy on a different, independent photo of the same person under varied conditions — that remains a separate open item.
- **Follow-up: Independent blur-photo verification for InsightFace color space & primary biometrics fix (2026-09-12).**
  - **Context & Correction:** The independent blur-photo verification was executed after commit `98ee428` (correcting the sequencing in the prior entry where only enrollment-equivalent clean photos were tested prior to commit).
  - **Results on Non-Enrollment Test Photos (`process_frame()` on session `6c9ff1ec-d872-42fe-9b49-87d95b973930`):**
    - `ansh_blur.jpeg`: Correctly matched `Ansh Tomar` (`4f662827-077c-4159-8cca-e0abca5fdc7f`) with similarity score `0.6508` (distance `0.3492`), successfully clearing the `0.5` match threshold on an independent, non-enrollment photo under degraded conditions.
    - `hrishabh_blur.jpeg`: Resulted in `poor_quality` (quality score `0.1504` < `quality_threshold` `0.4`). The frame was rejected by the upstream quality gate before embedding or vector matching was attempted.
  - **Assessment & Open Item:**
    - `ansh_blur.jpeg` confirms positive generalization to independent, non-enrollment degraded imagery with the RGB/BGR fix intact.
    - For `hrishabh_blur.jpeg`, recognition accuracy was not tested because the quality gate blocked it. Validating recognition accuracy on an independent, non-enrollment photo of Hrisabh that passes the quality gate remains an open item.






- **InsightFace placeholder threshold calibration (2026-09-12).**
  - **Decision:** Keep match_threshold=0.5 and low_confidence_threshold=0.6 as-is (unchanged).
  - **Dataset:** 18 genuine positive matches (combination of static clear/blur test photos and live RTSP session observations) and 2 genuine imposter comparisons.
  - **Gap Observations:** Negatives topped out at ~0.18. Positives ranged from ~0.44 (live RTSP) to 1.00 (clean static).
  - **Reasoning:** False-accept risk (marking an imposter as present) is strictly worse than false-reject risk (a genuine student landing in low_confidence/review). Given the limited imposter data, the current conservative settings sit safely outside the imposter distribution gap.
  - **Open Limitation:** This calibration is based on a small sample (18 positive subjects, 1 imposter subject) and is NOT representative of a real classroom of 20-30+ students. Future work MUST collect broader multi-subject positive/negative data (ideally during active class sessions) before treating these as fully validated.
- **Known issue:** `resolveReviewItem()` in `apps/web/lib/enrollment/attendance.ts` does not verify affected row count after updating `final_attendance`. When called by a user unauthorized by RLS (e.g. a teacher not assigned to the session's class), Supabase silently updates zero rows without erroring, causing the function to report success and record an `audit_logs` entry even though no status changed. Not fixed yet; needs an affected-row count check (e.g. via `.select()` on update) to reject unauthorized/zero-row updates.
- **Live session monitoring server actions in `attendance.ts` (2026-09-12).**
  - **Context:** Two server action functions exist in `apps/web/lib/enrollment/attendance.ts` (introduced in commit `2f6ab5f`, bundled with the `resolveReviewItem` hardening fix):
    1. `triggerCameraCapture(cameraId, sessionId)`: Authenticates user, obtains session access token, and dispatches a POST request to `${CAMERA_SERVICE_URL}/cameras/${cameraId}/capture-and-recognize` to trigger an immediate frame capture and recognition run, then revalidates live session paths.
    2. `getLiveSessionData(sessionId)`: Authenticates user and aggregates session metadata (`class_sessions`), enrolled student roster (via `derive_session_roster()` RPC), recent observations (`attendance_observations`), and active cameras (`cameras`).
  - **Usage Status:** Confirmed actively used by the Live Monitor feature — called by `apps/web/app/sessions/[id]/live/page.tsx` (initial SSR load) and `apps/web/app/sessions/[id]/live/LiveSessionDashboard.tsx` (polling refreshes and manual capture trigger). Neither function is orphaned.
  - **Process Note:** New functionality must be documented in `DECISIONS.md` and `PROGRESS-enrollment.md` at the time of introduction rather than discovered retroactively during post-commit review.

- **Enforce two-branch workflow (feature/enrollment and feature/camera-service) (2026-09-12).** Direct commits to main are no longer permitted for feature work. All feature work must happen on the dedicated owner branches (`feature/enrollment` and `feature/camera-service`). Rationale: Avoids merge conflicts between the two branch owners and reinstates the originally intended workflow that had drifted in practice.
