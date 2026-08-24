-- Phase 7 (disputes) schema. Applied directly via SQL Editor earlier in
-- this session -- this migration file exists so a fresh Supabase project
-- setup can replay full history, not because it's pending application
-- on the current project.

create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  final_attendance_id uuid references final_attendance(id) not null,
  student_id uuid references students(id) not null,
  reason text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  evidence_photo_url text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

alter table attendance_config add column if not exists dispute_window_hours int not null default 48;
