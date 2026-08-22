-- Phase 5 (Finalization) — my scope: session_exceptions + final_attendance.
-- Draft for teammate sync call, per spec Section 4/5 Phase E.
-- NOT applied to Supabase yet — reviewing schema on the call first.

create or replace function public.current_user_role()
returns text
language sql
stable security definer
as $$
  select role from public.users where id = auth.uid()
$$;

create table session_exceptions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  session_id uuid references class_sessions(id) not null,
  student_id uuid references students(id) not null,
  marked_by uuid references users(id) not null,
  reason text,
  exit_at timestamptz not null default now(),
  return_at timestamptz,
  created_at timestamptz default now()
);
alter table session_exceptions enable row level security;

create policy "select session_exceptions in own institution" on session_exceptions
  for select using (institution_id = public.current_institution_id());

create policy "write session_exceptions in own institution" on session_exceptions
  for insert with check (
    institution_id = public.current_institution_id()
    and public.current_user_role() in ('teacher', 'admin')
    and marked_by = auth.uid()
  );

create policy "update session_exceptions in own institution" on session_exceptions
  for update using (
    institution_id = public.current_institution_id()
    and public.current_user_role() in ('teacher', 'admin')
  );

create table final_attendance (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  session_id uuid references class_sessions(id) not null,
  student_id uuid references students(id) not null,
  presence_score float,
  status text not null
    check (status in ('present', 'absent', 'left_early', 'uncertain', 'camera_issue')),
  exception_applied boolean default false,
  finalized_at timestamptz default now(),
  unique(session_id, student_id)
);
alter table final_attendance enable row level security;

create policy "select final_attendance in own institution" on final_attendance
  for select using (institution_id = public.current_institution_id());
create policy "write final_attendance in own institution" on final_attendance
  for insert with check (institution_id = public.current_institution_id());
create policy "update final_attendance in own institution" on final_attendance
  for update using (institution_id = public.current_institution_id());

-- Returns each student's exception window for a session, already resolved
-- (return_at vs actual_end fallback applied here, not left to the caller).
-- Same pattern as derive_session_roster() -- one shared function so
-- gap-check logic (wherever it ends up living) never re-implements this.
create or replace function get_session_exceptions(p_session_id uuid)
returns table (student_id uuid, window_start timestamptz, window_end timestamptz)
language plpgsql
as $$
declare
  v_actual_end timestamptz;
  v_scheduled_end timestamptz;
begin
  select cs.actual_end, cs.scheduled_end
    into v_actual_end, v_scheduled_end
  from class_sessions cs
  where cs.id = p_session_id;

  if not found then
    raise exception 'session % not found', p_session_id;
  end if;

  return query
  select
    se.student_id,
    se.exit_at as window_start,
    coalesce(se.return_at, v_actual_end, v_scheduled_end) as window_end
  from session_exceptions se
  where se.session_id = p_session_id;
end;
$$;
