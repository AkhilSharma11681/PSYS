-- Migration 0032: Add DELETE policy for enrollment_jobs
-- Allows admins and teachers to delete/dismiss failed enrollment jobs
-- belonging to their own institution.
create policy "delete enrollment_jobs for admin/teacher in own institution" on enrollment_jobs
  for delete using (
    institution_id = public.current_institution_id()
    and public.current_user_role() in ('admin', 'teacher')
  );
