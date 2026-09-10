-- Migration 0038: Add recognition_model to class_sessions
-- Allows individual sessions to opt into specific recognition models (e.g. 'insightface')
-- Defaults to NULL, which falls back to institution-level attendance_config or platform default.

alter table class_sessions
  add column if not exists recognition_model text default null;
