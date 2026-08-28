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
  windows** — treated like a camera outage against the student, not counted as absence.
- **Occlusion/camera-condition gaps are never auto-marked `left_early`** — only clean
  `no_face`/`poor_quality` gaps past `max_gap_minutes` are. Anything ambiguous is `uncertain` and
  goes to human review with evidence, never silently resolved.
- **Finalization is idempotent by construction:** `update class_sessions set finalized_at =
  now() where id = $1 and finalized_at is null returning id` — a worker that gets no row back
  must exit without side effects, since another worker already finalized it.
- **Phase 5 (Finalization) is split into three explicit handoff contracts** rather than divided
  by table ownership, because gap-check needs both sides' data. See `ARCHITECTURE.md` for the
  three contracts. Both sides agreed to align on exact function signatures/schemas via a call
  before writing code — same pattern used successfully before splitting Phase 1.5.
