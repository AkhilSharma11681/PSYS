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
