-- Enforces Spec Section 9 "Access" requirements that were documented
-- in OPERATIONS.md as satisfied but were missing SQL implementations:
-- - Students see only their own attendance
-- - Teachers see only their assigned classes (and sessions/attendance for them)
--
-- Modifies existing "select ... in own institution" policies.
-- Does NOT drop INSERT/UPDATE policies; they are kept separate.
-- Uses drop-then-create for idempotency.

create or replace function public.current_student_id()
returns uuid
language sql
stable security definer
as $$
  select id from public.students where user_id = auth.uid() limit 1;
$$;

-- 1. final_attendance (Students only own; Teachers only assigned to class_sessions->classes)
drop policy if exists "select final_attendance in own institution" on final_attendance;
create policy "select final_attendance in own institution" on final_attendance
  for select using (
    institution_id = public.current_institution_id()
    and (
      public.current_user_role() = 'admin'
      or (public.current_user_role() = 'student' and student_id = public.current_student_id())
      or (
        public.current_user_role() = 'teacher'
        and session_id in (
          select cs.id from class_sessions cs
          join classes c on cs.class_id = c.id
          where c.teacher_id = auth.uid()
        )
      )
    )
  );

-- 2. class_sessions (Students only enrolled; Teachers only assigned)
drop policy if exists "select sessions in own institution" on class_sessions;
create policy "select sessions in own institution" on class_sessions
  for select using (
    institution_id = public.current_institution_id()
    and (
      public.current_user_role() = 'admin'
      or (
        public.current_user_role() = 'student'
        and id in (
          select session_id from final_attendance where student_id = public.current_student_id()
        )
      )
      or (
        public.current_user_role() = 'teacher'
        and class_id in (
          select id from classes where teacher_id = auth.uid()
        )
      )
    )
  );

-- 3. classes (Students only enrolled classes; Teachers only assigned classes)
-- (assuming classes table had a similar broad policy, let's just make sure)
drop policy if exists "select classes in own institution" on classes;
create policy "select classes in own institution" on classes
  for select using (
    institution_id = public.current_institution_id()
    and (
      public.current_user_role() = 'admin'
      or (
        public.current_user_role() = 'student'
        and id in (
          select class_id from class_enrollments where student_id = public.current_student_id()
        )
      )
      or (public.current_user_role() = 'teacher' and teacher_id = auth.uid())
    )
  );

-- 4. disputes (Students only their own; Teachers only assigned)
drop policy if exists "select disputes in own institution" on disputes;
create policy "select disputes in own institution" on disputes
  for select using (
    institution_id = public.current_institution_id()
    and (
      public.current_user_role() = 'admin'
      or (public.current_user_role() = 'student' and student_id = public.current_student_id())
      or (
        public.current_user_role() = 'teacher'
        and final_attendance_id in (
          select fa.id from final_attendance fa
          join class_sessions cs on fa.session_id = cs.id
          join classes c on cs.class_id = c.id
          where c.teacher_id = auth.uid()
        )
      )
    )
  );
