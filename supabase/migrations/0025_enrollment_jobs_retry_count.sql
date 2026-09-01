-- Enables auto-retry in enrollment-worker instead of jobs sitting
-- "failed" forever after a transient issue (e.g. camera-service being
-- temporarily down). Worker increments this on each failure; only marks
-- a job permanently 'failed' after exceeding the retry limit.
alter table enrollment_jobs add column if not exists retry_count int not null default 0;
