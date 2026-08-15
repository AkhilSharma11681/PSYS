create table cameras (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  room_id uuid references rooms(id) not null,
  host text not null,
  stream_path text not null,
  credential_ref text not null, -- key name in secret manager, never the raw credential
  label text default 'primary',
  is_active boolean default true
);

create table camera_health (
  camera_id uuid primary key references cameras(id),
  last_frame_at timestamptz,
  consecutive_failures int default 0,
  status text default 'unknown' check (status in ('unknown','healthy','degraded','offline')),
  last_error text
);

create table capture_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  session_id uuid references class_sessions(id) not null,
  camera_id uuid references cameras(id) not null,
  attempted_at timestamptz not null,
  succeeded boolean not null,
  error text,
  frame_stored boolean default false,
  unique(session_id, attempted_at)
);
