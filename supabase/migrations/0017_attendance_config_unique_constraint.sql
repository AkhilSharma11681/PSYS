-- Fixes a real bug teammate found: attendance_config had no unique
-- constraint on institution_id, so every upsert without an explicit
-- on_conflict silently inserted a new row instead of updating. This
-- meant get_recognition_config() could pick a stale/wrong row with no
-- error -- caused a real test failure (quorum_not_reached when quorum
-- should've been met, wrong threshold from a duplicate row).
--
-- Partial indexes because institution_id is nullable (null = platform
-- default row) -- a plain unique constraint would allow unlimited nulls.
create unique index attendance_config_institution_unique
  on attendance_config (institution_id)
  where institution_id is not null;

create unique index attendance_config_platform_default_unique
  on attendance_config ((institution_id is null))
  where institution_id is null;
