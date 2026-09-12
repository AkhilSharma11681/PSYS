-- Migration 0036: Add optional rotation_degrees to cameras table
-- Supported values: 0 (default/no rotation), 90 (clockwise), 180, 270 (counter-clockwise)

alter table cameras
  add column if not exists rotation_degrees int not null default 0
  check (rotation_degrees in (0, 90, 180, 270));
