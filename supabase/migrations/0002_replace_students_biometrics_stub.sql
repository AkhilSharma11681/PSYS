-- Replaces camera-feature's temporary stub tables (students, student_biometrics)
-- with the real Phase 1 schema per spec Section 4.
-- Safe to run even if the stub tables already have test rows in them —
-- if you have real data you care about, back it up first; otherwise this
-- assumes dev/stub data only.

drop table if exists student_biometrics cascade;
drop table if exists students cascade;

-- status added: a student isn't just "exists" — they can be inactive
-- (semester break), graduated, or transferred, all of which must stop
-- matching without deleting historical attendance records.
create table students (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  user_id uuid references users(id),
  status text not null default 'active'
    check (status in ('active','inactive','graduated','transferred')),
  enrollment_photo_count int default 0
);

-- One row PER ENROLLMENT PHOTO, not one embedding per student.
-- A single photo produces a fragile embedding (one angle, one lighting
-- condition). Storing each of the 4-5 enrollment photos as its own row
-- lets matching compare against the best available representation
-- (or an average) instead of one brittle vector. is_primary marks the
-- one used for quick previews in the dashboard.
create table student_biometrics (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  student_id uuid references students(id) not null,
  face_embedding vector(128),
  embedding_model text not null default 'dlib_resnet_v1',
  embedding_version int not null default 1,
  is_primary boolean default false,
  quality_score float,
  created_at timestamptz default now()
);

create index on student_biometrics using ivfflat (face_embedding vector_cosine_ops);
