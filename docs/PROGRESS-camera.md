# PSYS — Progress Log (feature/camera-service)

> Update this file at the END of every Claude Code session working on feature/camera-service.
> This is how the next session gets caught up, instead of re-reading old chats. Newest entries at the top.

Older completed entries moved to docs/PROGRESS_ARCHIVE.md.

## Entry Format
Every session log entry below MUST follow this exact template — no free-form summaries.

```
### YYYY-MM-DD — Session N
**Goal for this session:**
**Done:**
-
**Files changed:**
-
**Left / not done:**
-
**Next session should start with:**
-
**Open questions for teammate:**
-
**Blockers:**
-

```

At the START of a new session, read the most recent entry's **"Next session should start
with"** field first — that's the actual to-do list, not a summary to skim.

---

### 2026-09-11 — Session 11 (Robustness Test)
**Goal for this session:** Test robustness of face recognition models (dlib vs insightface) against degraded/blurry photos for new enrollments.
**Done:**
- Verified 4 new test images in `test-images/` for newly enrolled students Abhishek and Naveen.
- Confirmed dual embeddings (dlib `face_embedding` 128-D + InsightFace `face_embedding_v2` 512-D) exist for both students.
- Identified both students belong to institution ID `70881552-0663-494b-8b95-59cfdd5fb246` (with no current class enrollments).
- Executed direct pipeline matching of clear and blur photos against enrollment embeddings for both dlib and InsightFace logic side-by-side to observe score drop-off.
**Files changed:**
- `docs/PROGRESS-camera.md`
**Left / not done:**
- Live threshold tuning in `services/camera-service/app/recognition/pipeline.py`.
**Next session should start with:**
- Review recent test results to tune the `0.5` match and `0.6` low_confidence threshold placeholders in `services/camera-service/app/recognition/pipeline.py`.
**Open questions for teammate:**
- None.
**Blockers:**
- None.

---

### 2026-09-11 — Session 10 (Live InsightFace Session 1 Test)
**Goal for this session:** Run live InsightFace verification test on an existing session to evaluate matcher behavior before tuning constants.
**Done:**
- On `main` branch, manually updated DB `class_sessions` row for Session 1 (`3ac542c7-bbc5-45d4-865a-a7b5aa67e237`) setting `recognition_model = 'insightface'`.
- Ran `test_pipeline.py` using the dedicated `psys-camera` python environment to bypass missing `supabase` deps in the default env.
- Ran tests against `ansh.jpg`, `rohan.jpeg`, `aditya raj.jpeg`, and `akhil.jpg`.
- Verified that students with InsightFace 512-D embeddings match with high confidence, while students lacking InsightFace embeddings (Akhil Sharma) are correctly handled as `unknown_face` during matching because the candidate list is scoped to available model embeddings.
- Left the session's model configured as `recognition_model = 'insightface'` in the DB.
**Files changed:**
- `docs/PROGRESS-camera.md`
**Left / not done:**
- Tuning thresholds based on the exact Cosine Similarity bounds observed (placeholder 0.5/0.6 remain).
**Next session should start with:**
- Review the `test_pipeline.py` results to tune the `0.5` match and `0.6` low_confidence threshold placeholders in `services/camera-service/app/recognition/pipeline.py` to match the exact distances recorded.
**Open questions for teammate:**
- None.
**Blockers:**
- None.

---

### 2026-09-10 — Session 9 (Per-Session Recognition Model Selection & InsightFace Pipeline Wiring)
**Goal for this session:** Wire `InsightFaceRecognitionProvider` into live recognition pipeline via per-session `class_sessions.recognition_model` selection.
**Done:**
- Created migration `0038_add_session_recognition_model.sql` adding nullable `recognition_model` column to `class_sessions`.
- Updated `services/camera-service/app/recognition/pipeline.py` to dynamically load `DlibFaceRecognitionProvider` or `InsightFaceRecognitionProvider` per session.
- Configured model-aware `fetch_candidate_embeddings` call passing `model=model` (fetches `face_embedding_v2` for `insightface` sessions, `face_embedding` for default/dlib).
- Set unvalidated placeholder thresholds for InsightFace in `pipeline.py` (0.5 for match, 0.6 for low confidence).
- Documented per-session model selection in `docs/DECISIONS.md`.
**Files changed:**
- `supabase/migrations/0038_add_session_recognition_model.sql`
- `services/camera-service/app/recognition/pipeline.py`
- `docs/DECISIONS.md`
- `docs/PROGRESS-camera.md`
**Left / not done:**
- Threshold validation and tuning for InsightFace cosine similarity scale.
- Real hardware / live session end-to-end testing with `insightface` session.
- **Current System State:** InsightFace is fully wired into the live pipeline and is functional, but ZERO sessions currently have `recognition_model` set to 'insightface' — every live session today is still running dlib-only. This is a deliberate pause point, not a bug.
**Next session should start with:**
- Manually set one test session's `recognition_model` to 'insightface' via SQL, run a live test, then use real results to validate/tune the placeholder thresholds (0.5 match, 0.6 low-confidence — currently unvalidated).
**Open questions for teammate:**
- None.
**Blockers:**
- None.

---
### 2026-09-02 — Session (Step 6: Supabase Link & Migration 0033 Verification)
**Goal for this session:** Link Supabase CLI, verify migration 0033 state, and prepare for 3-person hardware test.
**Done:**
- Linked Supabase CLI to remote project `enugorwmjtzxcmnsxizm`.
- Verified migration state using `supabase migration list` (all migrations 0001–0033 local and remote).
- Migration 0033 confirmed live on remote (verified via direct query of derive_session_roster() function body — aliases present). Exact timing/mechanism of when it was applied is unconfirmed — possibly applied directly during troubleshooting in this session rather than via a tracked db push. No further action needed since the live state is verified correct.
**Files changed:**
- docs/PROGRESS.md
**Left / not done:**
- Re-run 3-person hardware test (`test_present_absent.py`).
**Next session should start with:**
- Re-run the 3-person hardware test (`test_present_absent.py`).
**Open questions for teammate:**
- None.
**Blockers:**
- None.
