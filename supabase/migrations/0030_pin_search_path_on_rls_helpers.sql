-- SEC-Harden: Pin search_path on all SECURITY DEFINER functions to prevent hijacking
-- Also DRY up is_student_in_session by using public.current_student_id()

-- 1. Redefine is_teacher_for_session with search_path pinned
create or replace function public.is_teacher_for_session(p_session_id uuid)
returns boolean
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from class_sessions cs
    join classes c on cs.class_id = c.id
    where cs.id = p_session_id
      and c.teacher_id = auth.uid()
  );
$$;

-- 2. Redefine is_student_in_session using current_student_id() and search_path pinned
create or replace function public.is_student_in_session(p_session_id uuid)
returns boolean
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from final_attendance
    where session_id = p_session_id
      and student_id = public.current_student_id()
  );
$$;

-- 3. Also fix current_student_id (from 0027) which is also SECURITY DEFINER
create or replace function public.current_student_id()
returns uuid
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select id from students where user_id = auth.uid() limit 1;
$$;
