-- Phase 1.5 completion: session monitoring roster derivation (spec Section 5,
-- Phase C). Given a class_sessions row, returns the student_ids that should
-- be watched for during that session's live capture window, and records how
-- the roster was derived (roster_source) so a sync outage is visible in the
-- data rather than silently assumed.
--
-- Shared SQL function so both apps/web (scheduler, when moving a session to
-- 'in_progress') and services/camera-service (matching.py, via Supabase RPC)
-- call the exact same derivation logic -- no duplicate roster-building code
-- on either side (same pattern as embed() reuse).

create or replace function derive_session_roster(p_session_id uuid)
returns table (student_id uuid)
language plpgsql
as $$
declare
  v_class_id uuid;
  v_checkin_count int;
begin
  select class_id into v_class_id
  from class_sessions
  where id = p_session_id;

  if v_class_id is null then
    raise exception 'session % not found', p_session_id;
  end if;

  -- has any check-in data already synced + resolved to this session?
  select count(*) into v_checkin_count
  from external_checkin_events
  where session_id = p_session_id
    and student_id is not null;

  if v_checkin_count > 0 then
    update class_sessions
      set roster_source = 'external_checkin'
      where id = p_session_id;

    return query
    select ce.student_id
    from class_enrollments ce
    where ce.class_id = v_class_id
      and ce.status = 'active'
      and ce.student_id in (
        select ece.student_id
        from external_checkin_events ece
        where ece.session_id = p_session_id
          and ece.student_id is not null
      );
  else
    update class_sessions
      set roster_source = 'full_enrollment_fallback'
      where id = p_session_id;

    return query
    select ce.student_id
    from class_enrollments ce
    where ce.class_id = v_class_id
      and ce.status = 'active';
  end if;
end;
$$;
