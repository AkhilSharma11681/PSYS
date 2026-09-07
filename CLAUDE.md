# PSYS — Project Memory for Claude Code

> Read this file first, every session. It replaces re-explaining the project by hand.
> Deeper detail lives in the linked docs — read them too before writing code.

@docs/ARCHITECTURE.md
@docs/PROGRESS-enrollment.md
@docs/PROGRESS-camera.md
@docs/DECISIONS.md
@OPERATIONS.md

## Start of every session
Before doing anything else, read the **most recent entry** in YOUR OWN progress file — `docs/PROGRESS-enrollment.md` if working on `feature/enrollment`, or `docs/PROGRESS-camera.md` if working on `feature/camera-service` (do not follow the other owner's file) — and treat its "Next session should start with" field as the actual to-do list for right now.

## End of every session
Before the session closes, add a new entry to YOUR OWN progress file (`docs/PROGRESS-enrollment.md` if working on `feature/enrollment`, or `docs/PROGRESS-camera.md` if working on `feature/camera-service` — not the other owner's file) following the `Entry Format` template defined at the top of that file exactly — do not free-form it. Then remind the user to commit and push your progress file.

## What this project is
Multi-tenant classroom attendance system using face recognition.
Repo: https://github.com/AkhilSharma11681/PSYS

## Team split
- **You (this branch owner): `feature/enrollment`** — students, enrollment, class rosters, external check-in sync, finalization logic that touches roster/enrollment data.
- **Teammate: `feature/camera-service`** — camera capture, face matching, attendance observations, quorum/session-timing detection (Python side).
- These two sides share tables with live foreign keys into each other (`class_sessions`, `attendance_observations`, `class_enrollments`). **Never rename/restructure a shared table without checking `docs/ARCHITECTURE.md` for who else depends on it.**

## Stack (do not add new dependencies outside this without flagging it explicitly)
- Frontend: Next.js (App Router) + TypeScript, hosted on Vercel
- DB: Supabase (Postgres + pgvector for face embeddings)
- Auth: Supabase Auth
- File/photo storage: Supabase Storage
- Payments: Razorpay (not needed yet)

## Working rules for Claude Code in this repo
1. Before implementing anything, check either `docs/PROGRESS-enrollment.md` or `docs/PROGRESS-camera.md` (depending on your branch) for current phase/status, and `docs/DECISIONS.md` for prior decisions — don't redo or contradict them without saying so explicitly.
2. Shared-boundary tables (`class_sessions`, `attendance_observations`, `class_enrollments`, `session_exceptions`, `final_attendance`) are jointly owned with the teammate's camera-service side. Flag any schema change to these before writing migrations.
3. Migrations live in `supabase/migrations/`, numbered sequentially. Check the highest existing number before creating a new one — both branches have collided on numbers before.
4. After finishing a unit of work in a session, update your owner's progress file (`docs/PROGRESS-enrollment.md` or `docs/PROGRESS-camera.md`) (what changed, what's next, any open questions for the teammate) before ending the session. This is how the *next* session gets context — not by re-reading old chat logs.
5. Prefer SQL functions (Postgres) over app-layer logic for anything both the Next.js side and the Python camera-service need to consume identically (e.g. roster derivation) — avoids duplicate logic drifting apart between the two codebases.
