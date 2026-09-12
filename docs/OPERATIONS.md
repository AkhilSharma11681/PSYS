# OPERATIONS.md — Running, deploying, testing this project

## Local dev environment (Mac, Akhil's machine)

```bash
cd ~/Documents/PSYS/services/camera-service
conda activate psys-camera   # NEVER skip this in a new terminal tab
```

Full first-time setup (dlib, cmake, etc.) is documented in
`services/camera-service/SETUP.md` — read that if setting up fresh, don't
duplicate it here.

Running the API server:
```bash
uvicorn app.main:app --reload
```

Running the background pieces manually (production runs these via Render +
cron-job.org instead, see Deployment section):
```bash
python worker.py              # polls capture_jobs
python scheduler.py <institution_id> <session_id> <camera_id> [duration_seconds]
python lifecycle_runner.py    # loops run_tick() every 2 min
python retention_runner.py    # loops privacy cleanup every hour
```

`apps/web` (Ansh's dashboard, Next.js) needs its own `.env.local`
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the
publishable key, NOT the secret key):
```bash
cd ~/Documents/PSYS/apps/web
npm install   # first time only
npm run dev   # http://localhost:3000
```

`services/enrollment-worker` (Ansh's, polls `enrollment_jobs`, calls
camera-service's `/internal/embed`) needs its own `.env`
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — the new-style `sb_secret_...`
key):
```bash
cd ~/Documents/PSYS/services/enrollment-worker
pip install -r requirements.txt
python app/worker.py
```

## Environment variables (camera-service `.env`, gitignored)
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_... # new-style secret key, not legacy service_role JWT
CAMERA_1_CREDS=admin:yourpassword # one var per camera, named after credential_ref (uppercased)
PHONE_TEST_CAM_CREDS= # empty = explicitly no-auth camera
TICK_SECRET=<random-string> # must match cron-job.org's X-Tick-Secret header exactly

## Deployment (Render)

- **Web Service** `psys-camera-service` deployed from `services/camera-service`
  (Root Directory set explicitly, since it's a monorepo), free tier, live and
  confirmed working.
- Environment variables set in Render dashboard: `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, per-camera creds, `TICK_SECRET` (must match
  cron-job.org).
- **No Background Worker deployed** (Render free tier has none). Instead:
  `POST /tick` on the Web Service, hit every 5 min by a free cron-job.org
  account (method must be set to POST, with header `X-Tick-Secret: <value>`
  matching Render's `TICK_SECRET` exactly — mismatches silently produce 403,
  double-check both sides if `/tick` stops working).
- Dockerfile build takes several minutes (dlib compile, single-threaded by
  design — see DECISIONS.md). If Render build fails with an OOM message,
  that's the parallel-compile issue resurfacing; if it fails with a git-not-
  found or module-not-found error, check the Dockerfile still has `git`
  installed and the `face_recognition_models` pip-from-git step intact.

## Test fixtures already in the DB (reuse these, don't recreate)

| What | Value |
|---|---|
| Institution ("Test College") | `485a5846-54c5-48bf-a523-6f86ecb54c42` |
| Test camera (dummy RTSP, host may get repointed for live tests) | `fa955acb-1b5b-4330-83c1-e10f3fa11810` |
| Test `class_sessions` row | `b8a2512c-ed44-4116-8dbf-6b557e123592` |
| Test student w/ embedding attached ("Akhil Sharma" / person_a) | `c8efd6a6-e899-4686-a537-6f252efaf9d2` |
| Test room | `75e293be-bedb-452d-b9cc-15981c50b26c` |

Live-camera testing uses a phone running an RTSP server app (OctoStream on
iOS — default opens in a "test pattern" demo mode, must explicitly switch to
"Camera" source or you'll capture color bars, not a real image). If the
laptop can't reach the phone's RTSP URL ("No route to host" from `ping`),
the most common cause on an institutional/college WiFi is client/AP
isolation — the fix used successfully was switching the laptop to the
phone's own Personal Hotspot instead of shared WiFi (note: this changes the
phone's IP, re-check the RTSP URL in the app and update the `cameras.host`
row accordingly).

Standard test-data cleanup pattern after any live test (temp classes,
enrollments, observations, config overrides) — always null/delete
FK-children before parents:
```sql
update class_sessions set class_id = null, finalized_at = null, actual_start = null, actual_end = null, processing_status = 'pending' where id = '<session>';
delete from attendance_observations where session_id = '<session>';
delete from capture_events where session_id = '<session>';
delete from class_enrollments where class_id = '<temp-class>';
delete from classes where id = '<temp-class>';
delete from attendance_config where institution_id = '<test-institution>'; -- only if you inserted an override row
```

## Common failure modes and fixes (things that have actually happened)

- **`git push` rejected with "fetch first"** → `git pull origin main
  --no-rebase`, accept the default merge commit (if Vim opens: `Esc` then
  `:wq` then Enter), then `git push` again. Happens routinely because Ansh
  pushes to the same branch concurrently.
- **`ModuleNotFoundError` for something that's clearly installed** → wrong
  Python is being used. Run `which python` — if it's not
  `/opt/anaconda3/envs/psys-camera/bin/python`, run `conda activate
  psys-camera` again, and use `python` not `python3` going forward in that
  session.
- **A curl test that used to work now 404s or 403s on a route that should
  exist** → the server likely needs restarting to pick up new code (or on
  Render, a manual "Clear build cache & deploy" if an env var change alone
  didn't trigger a real rebuild).
- **`invalid input syntax for type uuid`** → a placeholder string wasn't
  replaced with a real UUID before running the command. Always double-check
  before running.
- **Foreign key violation on delete** → deleting a parent before its
  children. Null/delete children first (see cleanup pattern above).
- **RLS policy silently returns 0 rows / 0 rows affected, no error** →
  check `pg_policies` directly for the table+command in question. This
  project has hit "the policy exists live but was never captured in a
  migration file" more than once — don't assume the migrations folder
  reflects live DB state, verify with a live query when debugging.