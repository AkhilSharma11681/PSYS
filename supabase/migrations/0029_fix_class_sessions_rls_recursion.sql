-- Fixes an infinite RLS recursion error between class_sessions and final_attendance.
-- The previous policy (0027) checked final_attendance from class_sessions,
-- and final_attendance checked class_sessions, triggering infinite recursion.
-- We fix this by introducing SECURITY DEFINER helper functions that bypass RLS
-- when determining if a user (student/teacher) has access to the record.

-- 1. Helper function for verifying if a user is a teacher for a given session.
-- Since this is SECURITY DEFINER, it runs without RLS constraints.
create or replace function public.is_teacher_for_session(p_session_id uuid)
returns boolean
language sql
stable security definer
as $$
  select exists (
    select 1
    from class_sessions cs
    join classes c on cs.class_id = c.id
    where cs.id = p_session_id
      and c.teacher_id = auth.uid()
  );
$$;

-- 2. Helper function for verifying if a user is a student in a finalized session.
create or replace function public.is_student_in_session(p_session_id uuid)
returns boolean
language sql
stable security definer
as $$
  select exists (
    select 1
    from final_attendance
    where session_id = p_session_id
      and student_id = (select id from public.students where user_id = auth.uid() limit 1)
  );
$$;


-- Now recreate the final_attendance policy to use the helper instead of a direct subquery:
drop policy if exists "select final_attendance in own institution" on final_attendance;
create policy "select final_attendance in own institution" on final_attendance
  for select using (
    institution_id = public.current_institution_id()
    and (
      public.current_user_role() = 'admin'
      or (public.current_user_role() = 'student' and student_id = public.current_student_id())
      or (public.current_user_role() = 'teacher' and public.is_teacher_for_session(session_id))
    )
  );

-- Recreate the class_sessions policy to use the helper instead of a direct subquery:
drop policy if exists "select sessions in own institution" on class_sessions;
create policy "select sessions in own institution" on class_sessions
  for select using (
    institution_id = public.current_institution_id()
    and (
      public.current_user_role() = 'admin'
      or (public.current_user_role() = 'student' and public.is_student_in_session(id))
      or (
        public.current_user_role() = 'teacher'
        and class_id in (
          select id from classes where teacher_id = auth.uid()
        )
      )
    )
  );

-- Also update disputes for safety, as it also joins through final_attendance -> class_sessions
drop policy if exists "select disputes in own institution" on disputes;
create policy "select disputes in own institution" on disputes
  for select using (
    institution_id = public.current_institution_id()
    and (
      public.current_user_role() = 'admin'
      or (public.current_user_role() = 'student' and student_id = public.current_student_id())
      or (
        public.current_user_role() = 'teacher'
        and public.is_teacher_for_session(
            (select session_id from final_attendance where id = final_attendance_id limit 1)
        )
      )
    )
  );
