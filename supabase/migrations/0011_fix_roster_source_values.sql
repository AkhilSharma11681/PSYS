-- 0009 introduced roster_source with values that don't match the spec
-- (class_enrollments/external_checkin/manual, default class_enrollments).
-- Spec requires: external_checkin / full_enrollment_fallback, default
-- external_checkin. Without this fix, the teammate's roster-derivation
-- code would hit a CHECK constraint violation trying to set
-- 'full_enrollment_fallback'.

alter table class_sessions drop constraint if exists class_sessions_roster_source_check;

update class_sessions set roster_source = 'external_checkin' where roster_source = 'class_enrollments';
update class_sessions set roster_source = 'full_enrollment_fallback' where roster_source = 'manual';

alter table class_sessions alter column roster_source set default 'external_checkin';

alter table class_sessions add constraint class_sessions_roster_source_check
  check (roster_source in ('external_checkin', 'full_enrollment_fallback'));
