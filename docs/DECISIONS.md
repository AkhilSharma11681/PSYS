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
