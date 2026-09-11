-- Migration 0039: Set default recognition_model to 'insightface'

ALTER TABLE class_sessions
ALTER COLUMN recognition_model SET DEFAULT 'insightface';
