# camera-service setup

## 1. Python environment

Do NOT use plain venv + pip for dlib on Apple Silicon + Python 3.14.
Use conda instead:

```bash
conda create -n psys-camera python=3.11 -y
conda activate psys-camera
conda install -c conda-forge dlib -y
pip install -r requirements.txt
pip install git+https://github.com/ageitgey/face_recognition_models
```

Every new terminal tab, activate with:
```bash
conda activate psys-camera
```
(not source venv/bin/activate — there is no venv)

Pinned versions — do not casually upgrade:
```bash
numpy<2        # dlib bindings break on numpy 2.x (ABI mismatch)
setuptools<81  # face_recognition_models needs pkg_resources, removed in setuptools 81+
```

## 2. Environment variables

Copy .env.example to .env and fill in:
```bash
cp .env.example .env
```

- SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — from Supabase dashboard, Settings, API
- Per-camera credentials — one env var per camera, named after that camera's
  credential_ref column (uppercased), e.g. a camera with
  credential_ref = 'camera_1_creds' needs:
```bash
CAMERA_1_CREDS=admin:yourpassword
```

.env is gitignored — never commit it.

## 3. Database setup

Run migrations in order via the Supabase SQL editor:
```bash
supabase/migrations/0001_cameras.sql
supabase/migrations/0002_replace_students_biometrics_stub.sql
supabase/migrations/0003_add_student_identity_fields.sql
supabase/migrations/0004_enrollment_jobs.sql
```

Also create the Storage bucket used for captured frames (run once via SQL editor):
```bash
insert into storage.buckets (id, name, public)
values ('capture-frames', 'capture-frames', false)
on conflict (id) do nothing;
```

## 4. Running the API server

```bash
uvicorn app.main:app --reload --port 8000
```

Key endpoints:
- GET /health
- POST /cameras/{camera_id}/capture-and-recognize — runs one capture+recognition cycle for a session
- POST /internal/embed — multipart image upload, used by the enrollment-feature; returns faces_detected, quality_score, embedding, embedding_model, or 422 on 0/multiple faces

## 5. Running the capture queue (scheduler + worker)

Two separate processes — the scheduler seeds jobs, the worker polls and processes them:

```bash
python scheduler.py <institution_id> <session_id> <camera_id> [duration_seconds]
```
duration_seconds defaults to 60 — production default per spec is
5-8 minutes between captures; this uses seconds so you can test
end-to-end in under a minute.

```bash
python worker.py
```

The worker polls capture_jobs, atomically claims pending rows, and calls
the same capture+recognize logic as the API endpoint. A single job failure
never crashes the worker — it's marked failed and the worker keeps going.

## 6. Dev/test scripts

- test_camera.py, test_recognition.py, test_match.py, test_pipeline.py — component-level checks against test_face.jpg / test_face_2.jpg
- test_webcam_pipeline.py — full pipeline against your Mac's live webcam
- test_storage.py — verifies frame upload to Supabase Storage against your Mac's live webcam
- enroll_test_student.py — enrolls a test student for match testing
- debug_compare.py — compares two photos' embeddings/quality directly

## ⚠️ KNOWN GAP: No auth / tenant-isolation on HTTP endpoints

None of the endpoints (`/sessions/{id}/finalize`, `/review`, `/export.csv`)
verify that the caller has access to the institution that `session_id`
belongs to. The DB client uses the `service_role` key (bypasses RLS by
design, since this is a trusted backend), so this isolation MUST happen
at the application layer -- and currently doesn't.

This is acceptable ONLY because:
- Single-institution pilot (no real multi-tenant exposure risk yet)
- Auth is entirely unimplemented across the project (teammate's
  `apps/web` also hardcodes `DEV_INSTITUTION_ID`, no real login yet)

**Before any multi-institution deployment**, this needs:
1. Real auth (Supabase Auth JWT, per spec Section 2) wired into every
   HTTP endpoint here
2. Each endpoint verifying `session.institution_id` (or `camera.institution_id`)
   matches the authenticated caller's institution before proceeding
3. `run_capture_job()` already has the pattern for this (checks
   `camera.institution_id == session.institution_id`) -- but that's a
   cross-object consistency check, not an auth check. Both are needed.

Do NOT add a cosmetic/partial check here without real auth backing it --
that would create a false sense of security without closing the gap.
Coordinate with teammate before starting this (shared concern, not
camera-service-only).

## Deployment status — UPDATED

- **Web Service**: deployed on Render (free tier), live at
  https://psys-camera-service.onrender.com
- **Autonomous lifecycle**: NOT via a dedicated Background Worker
  (Render has no free tier for that, min $7/month). Instead:
  - Added POST /tick endpoint (gated by TICK_SECRET shared-secret
    header, not real auth -- see the auth-gap note above) that wraps
    run_tick()
  - cron-job.org (free, no credit card) hits this endpoint every 5
    minutes
  - This also keeps the free Web Service from spinning down on
    inactivity (bonus side effect)
  - Verified working end-to-end: cron-job.org shows successful runs,
    run_tick() genuinely executes on Render
- TICK_SECRET env var must match exactly between Render's environment
  variables and cron-job.org's X-Tick-Secret header value
