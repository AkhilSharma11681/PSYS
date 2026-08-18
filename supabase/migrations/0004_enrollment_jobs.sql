-- Queue table for enrollment photo processing (Postgres-based queue,
-- per spec Section 2 decision — no Redis). enrollment-worker polls this
-- for pending rows, calls camera-service's /internal/embed, and writes
-- the result into student_biometrics. Keeps ML inference out of the
-- Next.js request/response cycle (spec Section 7 robustness rule).
create table enrollment_jobs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  student_id uuid references students(id) not null,
  storage_path text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed')),
  error text,
  created_at timestamptz default now(),
  processed_at timestamptz
);

create index on enrollment_jobs (status, created_at);
