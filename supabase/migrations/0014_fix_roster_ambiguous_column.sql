-- Fix: derive_session_roster() had an unqualified `student_id` reference in
-- its check-in-count query, which Postgres treated as ambiguous against the
-- function's own `returns table (student_id uuid)` OUT parameter. Qualifying
-- every reference with its table alias resolves it.

create or replace function derive_session_roster(p_session_id uuid)
returns table (student_id uuid)
language plpgsql
as $$
declare
  v_class_id uuid;
  v_checkin_count int;
begin
  select cs.class_id into v_class_id
  from class_sessions cs
  where cs.id = p_session_id;

  if v_class_id is null then
    raise exception 'session % not found', p_session_id;
  end if;

  select count(*) into v_checkin_count
  from external_checkin_events ece
  where ece.session_id = p_session_id
    and ece.student_id is not null;

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
