-- Spec Section 9 (Privacy & Biometric Data Lifecycle): "students should be
-- informed and, where required by institutional policy, give consent
-- before enrollment." Tracked explicitly rather than assumed -- an admin
-- checks this box per student before enrollment photos can be uploaded.
alter table students add column if not exists consent_given boolean not null default false;
alter table students add column if not exists consent_recorded_at timestamptz;
