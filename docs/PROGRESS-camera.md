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
**Next session should start with:**
- Calibrate and validate InsightFace thresholds on empirical dataset.
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
