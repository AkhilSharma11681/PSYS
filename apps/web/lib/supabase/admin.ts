import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// TEMPORARY: uses service_role (bypasses RLS) because there's no login/session
// system yet. Once auth is wired, admin-only writes should go through the
// regular server client with proper RLS policies, and this file should be
// restricted to truly-admin-only operations only.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
