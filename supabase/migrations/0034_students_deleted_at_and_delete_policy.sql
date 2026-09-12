-- Migration 0034: Add deleted_at column and DELETE RLS policy for students

-- 1. Soft-delete timestamp column
alter table students
  add column if not exists deleted_at timestamptz default null;

-- 2. Index on deleted_at to optimize listing operational vs soft-deleted students
-- (Most UI lists will need to filter out soft-deleted students)
create index if not exists idx_students_deleted_at on students (deleted_at);

-- 3. RLS DELETE policy for hard deletion ("no history, hard delete" path)
-- Allows admins to permanently delete student records in their own institution.
drop policy if exists "delete students for admin in own institution" on students;
create policy "delete students for admin in own institution" on students
  for delete using (
    institution_id = public.current_institution_id()
    and public.current_user_role() = 'admin'
  );
