-- SEC-Harden: Pin search_path on remaining SECURITY DEFINER functions to prevent hijacking
-- Extending the pattern from migration 0030 to these two helpers used extensively in RLS policies.
-- Uses CREATE OR REPLACE so dependent RLS policies are not interrupted.

create or replace function public.current_institution_id()
returns uuid
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select institution_id from public.users where id = auth.uid()
$$;

create or replace function public.current_user_role()
returns text
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select role from public.users where id = auth.uid()
$$;
