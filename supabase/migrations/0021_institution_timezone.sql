-- generate_sessions.py was computing "which day is it, what's the local
-- time" using UTC directly. For any institution not in UTC (e.g. IST,
-- UTC+5:30), this can pick the wrong day near date boundaries -- a class
-- recurring "MON 09:00" local time is "SUN 03:30" UTC on a different
-- weekday. Defaulting to UTC (not assuming IST) so nothing changes for
-- existing rows until an institution explicitly sets its real timezone.

alter table institutions
  add column timezone text not null default 'UTC';
